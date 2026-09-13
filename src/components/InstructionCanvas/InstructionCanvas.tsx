import { useEffect, useMemo, useState } from "preact/hooks";
import {
  document,
  selectedStepId,
  selectedTokenId,
  selectStep,
  selectToken,
  removeTokenFromStep,
  moveToken,
} from "../../state/document";
import { dragGhost, dropTarget } from "../../state/drag";
import { beginPointerDrag, resolveTokenDropTarget } from "../../lib/pointer-drag";
import { validateStep } from "../../model/validate";
import { iconMarkup, ICON_PRESENTATION_PROPS } from "../../data/icon-library";
import { stepDisplayedTime } from "../../lib/duration";
import type { InstructionStep, TokenAttachment, DurationAttachment } from "../../model/instruction";

// Keep in sync with the `min-width: 800px` breakpoint in global.css.
const DESKTOP_QUERY = "(min-width: 800px)";

const BASE_CANVAS_WIDTH = 720;
const PADDING = 16;
const HEADER_HEIGHT = 32;
const CHIP_WIDTH = 96;
// Raised from 56: a chip now reserves a dedicated bottom band for the
// Quantity badge's visible text (see QuantityBadge) - it needs more room
// than an icon-only badge did, and cramming text into the old height risked
// colliding with the token's own label right above it.
const CHIP_HEIGHT = 68;
// Wide enough that the connector line drawn in this gap (below) is actually
// visible - an 8-unit gap made the line nearly imperceptible against the
// light chip/step backgrounds even with correct color/geometry.
const CHIP_GAP = 16;
const ROW_GAP = 16;
const BADGE_SIZE = 22;
const MARKER_WIDTH = 3;
// Both kept equal and reasonably large (not just big enough to round the
// corner) - at the old value (8 design units, only a handful of actual
// screen pixels once the canvas is scaled down for a wide/tall document),
// the curve was small enough that rasterization made different bends read
// as inconsistently "tight" even though their path geometry was identical.
// A more generous radius renders as an unambiguous, consistent curve at any
// canvas scale.
const CONNECTOR_CORNER_RADIUS = 12;
// How far the row-wrap bend pokes out past the last chip of one row, and
// (mirrored) past the first chip of the next, before curving - so both ends
// of the bend read as distinct stubs rather than one end poking out while
// the other stays flush against its chip's border. Kept equal to the corner
// radius so the straight stub and the curve read as one deliberate shape
// rather than a curve that's noticeably bigger/smaller than its lead-in.
const CONNECTOR_LEAD_OUT = 12;
// Lucide's native viewBox is 24x24 - drawing at that size needs no rescale.
const ICON_DRAW_SIZE = 24;

// Warning badge (see InstructionToken.warning): a small, fixed-corner
// icon-only marker on a chip, chosen over resizing the chip so the existing
// row/wrap layout math never has to account for a token being "taller"
// because it happens to have a warning. Quantity's own badge (below) needs
// visible text instead, so it gets a different shape (a pill, not a
// circle) - Time has no chip badge at all, see InstructionCanvas's
// step-level duration header instead.
const WARNING_BADGE_RADIUS = 9;
const WARNING_BADGE_ICON_SIZE = 12;
const WARNING_BADGE_POS = { cx: WARNING_BADGE_RADIUS + 1, cy: WARNING_BADGE_RADIUS + 1 };

/** The chip's top-left warning marker. */
function WarningBadge({ attachment }: { attachment: TokenAttachment }) {
  const { cx, cy } = WARNING_BADGE_POS;
  const iconScale = WARNING_BADGE_ICON_SIZE / ICON_DRAW_SIZE;
  return (
    <g class="instruction-canvas__chip-badge instruction-canvas__chip-badge--warning" aria-hidden="true">
      <circle cx={cx} cy={cy} r={WARNING_BADGE_RADIUS} />
      <g
        class="instruction-canvas__chip-badge-icon"
        transform={`translate(${cx - WARNING_BADGE_ICON_SIZE / 2}, ${cy - WARNING_BADGE_ICON_SIZE / 2}) scale(${iconScale})`}
        {...ICON_PRESENTATION_PROPS}
        dangerouslySetInnerHTML={{ __html: iconMarkup(attachment.iconId) ?? "" }}
      />
      <title>{attachment.label ?? "Warning"}</title>
    </g>
  );
}

// Quantity's badge shows its actual value ("250 g") as text, unlike
// Warning's icon-only marker - a fixed-size pill (rather than sizing to the
// text) keeps every chip's badge the same footprint regardless of how long
// the amount+unit string happens to be, comfortably fitting the longest
// realistic value ("99999 pinch") without measuring text at render time.
const QUANTITY_PILL_WIDTH = 80;
const QUANTITY_PILL_HEIGHT = 16;
const QUANTITY_PILL_MARGIN_BOTTOM = 4;

/** The chip's bottom-center quantity value pill - text only, no icon, so it never crowds the token's own icon/label above it. */
function QuantityBadge({ attachment }: { attachment: TokenAttachment }) {
  const cx = CHIP_WIDTH / 2;
  const y = CHIP_HEIGHT - QUANTITY_PILL_HEIGHT - QUANTITY_PILL_MARGIN_BOTTOM;
  return (
    <g class="instruction-canvas__chip-badge instruction-canvas__chip-badge--quantity" aria-hidden="true">
      <rect
        x={cx - QUANTITY_PILL_WIDTH / 2}
        y={y}
        width={QUANTITY_PILL_WIDTH}
        height={QUANTITY_PILL_HEIGHT}
        rx={QUANTITY_PILL_HEIGHT / 2}
      />
      <text x={cx} y={y + QUANTITY_PILL_HEIGHT / 2 + 3} text-anchor="middle">
        {attachment.label}
      </text>
    </g>
  );
}

// Step-level duration header (see InstructionStep.time): reserved above a
// step's card only when it has a displayable duration - see
// stepDisplayedTime in lib/duration.ts for the step-time-wins-else-sum-of-
// tokens rule.
const TIME_HEADER_HEIGHT = 22;

interface StepLayout {
  step: InstructionStep;
  /** y of the card itself - the duration header, if any, sits just above this. */
  cardY: number;
  /** 0 when the step has no displayable duration, else TIME_HEADER_HEIGHT. */
  headerHeight: number;
  displayedTime: DurationAttachment | undefined;
  height: number;
  chipsPerRow: number;
  isComplete: boolean;
  issues: string[];
}

interface ChipPosition {
  cx: number;
  cy: number;
  col: number;
  row: number;
}

/** Top-left position (in step-local design units) of the chip at `index`. */
function chipPosition(index: number, chipsPerRow: number): ChipPosition {
  const col = index % chipsPerRow;
  const row = Math.floor(index / chipsPerRow);
  return {
    cx: col * (CHIP_WIDTH + CHIP_GAP),
    cy: HEADER_HEIGHT + row * (CHIP_HEIGHT + CHIP_GAP),
    col,
    row,
  };
}

function desktopChipsPerRow(): number {
  const available = BASE_CANVAS_WIDTH - PADDING * 2;
  return Math.max(1, Math.floor((available + CHIP_GAP) / (CHIP_WIDTH + CHIP_GAP)));
}

function stepHeight(tokenCount: number, chipsPerRow: number): number {
  if (tokenCount === 0) {
    // No chip row to reserve space for - the "Empty step" hint fits in the header band.
    return HEADER_HEIGHT + PADDING;
  }
  const lines = Math.ceil(tokenCount / chipsPerRow);
  return HEADER_HEIGHT + lines * CHIP_HEIGHT + (lines - 1) * CHIP_GAP + PADDING;
}

/** Width (in design units) of the widest single row a step actually uses. */
function widestRowWidth(tokenCount: number, chipsPerRow: number): number {
  if (tokenCount === 0) return 0;
  const cols = Math.min(tokenCount, chipsPerRow);
  return cols * CHIP_WIDTH + (cols - 1) * CHIP_GAP;
}

/**
 * One thin connector per pair of consecutive tokens, in array order - a
 * plain straight line within a row. A row wrap routes through the middle of
 * the gap *between* those two specific rows (not either row's mid-height),
 * confining it to that row-pair's own band - otherwise, since every full
 * row's last chip sits at the same x, consecutive wraps' vertical segments
 * would land on the same x and chain into one continuous line spanning
 * every row instead of reading as distinct "end of row N -> start of row
 * N+1" hooks, and the horizontal leg would overlap/hide behind the next
 * row's own same-row connectors (both drawn at that row's mid-height).
 */
function buildConnectors(tokenCount: number, chipsPerRow: number): { key: string; d: string }[] {
  const segments: { key: string; d: string }[] = [];
  for (let i = 1; i < tokenCount; i++) {
    const from = chipPosition(i - 1, chipsPerRow);
    const to = chipPosition(i, chipsPerRow);
    const fromRightX = from.cx + CHIP_WIDTH;
    const fromMidY = from.cy + CHIP_HEIGHT / 2;
    const toLeftX = to.cx;
    const toMidY = to.cy + CHIP_HEIGHT / 2;

    let d: string;
    if (from.row === to.row) {
      d = `M ${fromRightX} ${fromMidY} L ${toLeftX} ${toMidY}`;
    } else {
      // `stroke-linejoin: round` alone isn't enough here - its rounding
      // radius is tied to stroke-width (2px), too small to read as rounded.
      // Building the curve into the path itself gives a radius independent
      // of stroke width, at each of the bend's two corners.
      //
      // The two vertical legs are mirrored: `leadOutX` pokes out past the
      // source chip's right border by CONNECTOR_LEAD_OUT before curving
      // down, and `leadInX` mirrors that same distance past the target
      // chip's left border before a final straight run into it - so both
      // ends of the bend read as an equal, deliberate stub rather than one
      // end poking out while the other lands flush against its chip.
      const gapMidY = to.cy - CHIP_GAP / 2;
      const r = CONNECTOR_CORNER_RADIUS;
      const leadOutX = fromRightX + CONNECTOR_LEAD_OUT;
      const leadInX = toLeftX - CONNECTOR_LEAD_OUT;
      d = [
        `M ${fromRightX} ${fromMidY}`,
        `L ${leadOutX} ${fromMidY}`,
        `L ${leadOutX} ${gapMidY - r}`,
        `Q ${leadOutX} ${gapMidY} ${leadOutX - r} ${gapMidY}`,
        `L ${leadInX + r} ${gapMidY}`,
        `Q ${leadInX} ${gapMidY} ${leadInX} ${gapMidY + r}`,
        `L ${leadInX} ${toMidY}`,
        `L ${toLeftX} ${toMidY}`,
      ].join(" ");
    }

    segments.push({ key: `${i - 1}-${i}`, d });
  }
  return segments;
}

/**
 * Where to draw the live drag insertion marker for a step currently being
 * dragged over. `dropIndex` (already clamped to [0, tokenCount]) is usually
 * just the target chip's position - except appending to a row that's
 * exactly full, where the naive position would start a phantom new row
 * below the step's actual (unchanged, until drop) height. Clamped instead
 * to just after the last chip in the existing last row.
 */
function insertionMarkerPosition(
  dropIndex: number,
  tokenCount: number,
  chipsPerRow: number,
): ChipPosition {
  if (dropIndex === tokenCount && tokenCount > 0 && tokenCount % chipsPerRow === 0) {
    const last = chipPosition(tokenCount - 1, chipsPerRow);
    return { ...last, cx: last.cx + CHIP_WIDTH };
  }
  return chipPosition(dropIndex, chipsPerRow);
}

/**
 * Tracks the `min-width: 800px` breakpoint so layout can switch between
 * desktop's wrapped multi-row chips and mobile's single row per step. Kept
 * as a plain hook (not a signal) since it's a local rendering concern, not
 * shared app state.
 */
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia(DESKTOP_QUERY).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => setIsDesktop(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isDesktop;
}

interface InstructionCanvasProps {
  /**
   * Task 8 (Live Preview): renders the same SVG with every editing
   * affordance (badges, remove controls, drag, selection) turned off,
   * standing in for "what this looks like exported" ahead of the real
   * export pipeline (tasks 15-17), instead of a second rendering pipeline.
   */
  readOnly?: boolean;
}

/**
 * Phase 2 task 6: renders the whole document as native SVG, replacing
 * StepBuilder's HTML prototype now that Phase 1 validated the interaction
 * model. Token icons (task 7) are inlined Lucide path markup resolved by
 * `iconId` via data/icon-library.ts - inlined rather than referenced with
 * `<image href>` so a future SVG export (task 15) stays self-contained.
 *
 * Each step's "select" control is a small header badge, kept as a sibling
 * of the token chips (not a wrapper around them) so no interactive element
 * ends up nested inside another.
 *
 * Selection is two-stage: clicking anywhere on a step that isn't already
 * selected (its background, badge, or one of its tokens) selects the step.
 * Once a step is already selected, clicking one of its tokens selects that
 * token instead (surfaced in the TokenDetails panel). Tokens carry no
 * keyboard role - the header badge stays the only keyboard-reachable way to
 * select a step.
 *
 * Task 9 (Drag-and-Drop): a token chip is also a drag source - dragging it
 * over a step (`data-step-id`) or a specific chip (`data-token-index`)
 * moves it there via `moveToken`. A quick tap with no real movement still
 * runs the plain select logic above (see `beginPointerDrag`'s `wasDrag`).
 * While dragging, the step being hovered shows a live insertion marker at
 * the exact slot the token would land in (`dropTarget`'s index), not just a
 * highlight on the step as a whole.
 * Task 10 (Touch Support) is largely "this already works on touch" since
 * Pointer Events unify the input types - `touch-action: none` on the chips
 * (global.css) stops the browser from scrolling the page mid-drag instead.
 *
 * Connector lines: a plain line is drawn between each pair of consecutive
 * tokens within a step (array order), so the sequence reads clearly even
 * before adding per-connection styling. Steps stay visually separate - no
 * lines are drawn between steps. Lines are computed purely from token order,
 * not stored - see docs/Planned-Additions.md #3 for what per-connection
 * style/labels would need later.
 *
 * On mobile (below the 800px breakpoint) each step's tokens stay in a
 * single row instead of wrapping, and the SVG's rendered width is clamped
 * (see .instruction-canvas__svg in global.css) so icons neither shrink
 * below nor grow past a reasonable size - both are easy to revisit later
 * (swap the mobile chipsPerRow back to the wrapped desktop formula, or
 * change the clamp bounds).
 */
export function InstructionCanvas({ readOnly = false }: InstructionCanvasProps) {
  const steps = document.value.steps;
  const isDesktop = useIsDesktop();
  const perRowOnDesktop = desktopChipsPerRow();

  const layouts = useMemo<StepLayout[]>(() => {
    let cursor = PADDING;
    const result: StepLayout[] = [];
    for (const step of steps) {
      const chipsPerRow = isDesktop ? perRowOnDesktop : Math.max(1, step.tokens.length);
      const height = stepHeight(step.tokens.length, chipsPerRow);
      const validation = validateStep(step);
      const displayedTime = stepDisplayedTime(step);
      const headerHeight = displayedTime ? TIME_HEADER_HEIGHT : 0;
      const cardY = cursor + headerHeight;
      result.push({
        step,
        cardY,
        headerHeight,
        displayedTime,
        height,
        chipsPerRow,
        isComplete: validation.isComplete,
        issues: validation.issues,
      });
      cursor = cardY + height + ROW_GAP;
    }
    return result;
  }, [steps, isDesktop, perRowOnDesktop]);

  const totalHeight =
    layouts.length > 0
      ? layouts[layouts.length - 1].cardY + layouts[layouts.length - 1].height + PADDING
      : PADDING * 2;

  const widestContent = layouts.reduce(
    (max, l) => Math.max(max, widestRowWidth(l.step.tokens.length, l.chipsPerRow)),
    0,
  );
  // Reserves room on *both* sides for the row-wrap bend's lead-out/lead-in
  // stubs (above): the widest row is centered with exactly CONNECTOR_LEAD_OUT
  // of slack on its left and right (see tokensOffsetX below), so neither
  // stub can ever poke past a step card's own border, even when a row's own
  // width exactly matches the canvas's widest content.
  const canvasWidth = Math.max(
    BASE_CANVAS_WIDTH,
    widestContent + CONNECTOR_LEAD_OUT * 2 + PADDING * 2,
  );

  return (
    <div class={`instruction-canvas${readOnly ? " instruction-canvas--readonly" : ""}`}>
      <h2 class="instruction-canvas__heading">Instructions</h2>
      <svg
        class="instruction-canvas__svg"
        viewBox={`0 0 ${canvasWidth} ${totalHeight}`}
        role="group"
        aria-label={
          readOnly
            ? `${steps.length} instruction step${steps.length === 1 ? "" : "s"}, read-only preview`
            : `${steps.length} instruction step${steps.length === 1 ? "" : "s"}, each with a select button and removable tokens`
        }
      >
        {layouts.map(({ step, cardY, headerHeight, displayedTime, height, chipsPerRow, isComplete, issues }, index) => {
          const isSelected = !readOnly && step.id === selectedStepId.value;
          const isDropTarget = !readOnly && dropTarget.value?.stepId === step.id;
          const dropIndex = isDropTarget
            ? Math.min(dropTarget.value!.index, step.tokens.length)
            : null;
          const stepNumber = index + 1;
          const selectLabel = isComplete
            ? `Select step ${stepNumber}`
            : `Select step ${stepNumber}, incomplete: ${issues.join(", ")}`;
          const connectors = buildConnectors(step.tokens.length, chipsPerRow);
          // Center the token block horizontally within the step card instead
          // of leaving it flush against the left edge - a step with only a
          // couple of tokens on a wide card otherwise reads as lopsided.
          // Computed per step (each step's own content width), not once for
          // the whole canvas, so a short step centers within the same card
          // width a long step fills edge-to-edge.
          const rowWidth = widestRowWidth(step.tokens.length, chipsPerRow);
          const tokensOffsetX = Math.max(0, (canvasWidth - PADDING * 2 - rowWidth) / 2);

          return (
            <g key={step.id} transform={`translate(${PADDING}, ${cardY})`} data-step-id={step.id}>
              {displayedTime && (
                <text
                  class="instruction-canvas__step-time"
                  x={(canvasWidth - PADDING * 2) / 2}
                  y={-headerHeight + 15}
                  text-anchor="middle"
                >
                  {displayedTime.label}
                </text>
              )}
              <rect
                class={`instruction-canvas__step-bg${isSelected ? " instruction-canvas__step-bg--selected" : ""}${isDropTarget ? " instruction-canvas__step-bg--drop-target" : ""}`}
                x={0}
                y={0}
                width={canvasWidth - PADDING * 2}
                height={height}
                rx={8}
                onClick={readOnly ? undefined : () => selectStep(step.id)}
              />
              {readOnly ? (
                <g class="instruction-canvas__badge" aria-hidden="true">
                  <circle cx={12} cy={12} r={BADGE_SIZE / 2} />
                  <text x={12} y={16} text-anchor="middle">
                    {stepNumber}
                  </text>
                </g>
              ) : (
                <g
                  class="instruction-canvas__badge"
                  role="button"
                  tabindex={0}
                  aria-current={isSelected ? "step" : undefined}
                  aria-label={selectLabel}
                  onClick={() => selectStep(step.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      selectStep(step.id);
                    }
                  }}
                >
                  <circle cx={12} cy={12} r={BADGE_SIZE / 2} />
                  <text x={12} y={16} text-anchor="middle" aria-hidden="true">
                    {stepNumber}
                  </text>
                </g>
              )}
              {!isComplete && (
                <g aria-hidden="true">
                  <text class="instruction-canvas__flag" x={canvasWidth - PADDING * 2 - 14} y={20}>
                    !<title>{issues.join(", ")}</title>
                  </text>
                </g>
              )}
              {step.tokens.length === 0 && (
                <text class="instruction-canvas__hint" x={BADGE_SIZE + 12} y={20} aria-hidden="true">
                  Empty step
                </text>
              )}
              <g transform={`translate(${tokensOffsetX}, 0)`}>
                <g class="instruction-canvas__connectors" aria-hidden="true">
                  {connectors.map((segment) => (
                    <path key={segment.key} class="instruction-canvas__connector" d={segment.d} />
                  ))}
                </g>
                <g class="instruction-canvas__tokens">
                  {step.tokens.map((token, tokenIndex) => {
                    const { cx, cy } = chipPosition(tokenIndex, chipsPerRow);
                    const label = token.label ?? token.iconId;
                    const isTokenSelected = isSelected && token.id === selectedTokenId.value;
                    return (
                      <g
                        key={token.id}
                        class="instruction-canvas__token"
                        transform={`translate(${cx}, ${cy})`}
                        data-step-id={step.id}
                        data-token-index={tokenIndex}
                        onPointerDown={
                          readOnly
                            ? undefined
                            : (event) => {
                                beginPointerDrag(event, {
                                  onMove: (x, y2) => {
                                    dragGhost.value = { label, x, y: y2 };
                                    dropTarget.value = resolveTokenDropTarget(x, y2);
                                  },
                                  onDrop: (x, y2, wasDrag) => {
                                    dragGhost.value = null;
                                    dropTarget.value = null;
                                    if (!wasDrag) {
                                      if (isSelected) {
                                        selectToken(step.id, token.id);
                                      } else {
                                        selectStep(step.id);
                                      }
                                      return;
                                    }
                                    const target = resolveTokenDropTarget(x, y2);
                                    if (target) {
                                      moveToken(step.id, token.id, target.stepId, target.index);
                                    }
                                  },
                                });
                              }
                        }
                      >
                        <rect
                          class={`instruction-canvas__chip${
                            token.category === "warning" ? " instruction-canvas__chip--warning" : ""
                          }${isTokenSelected ? " instruction-canvas__chip--selected" : ""}`}
                          width={CHIP_WIDTH}
                          height={CHIP_HEIGHT}
                          rx={8}
                          aria-hidden="true"
                        />
                        <g
                          class="instruction-canvas__chip-icon"
                          transform={`translate(${(CHIP_WIDTH - ICON_DRAW_SIZE) / 2}, 4)`}
                          aria-hidden="true"
                          {...ICON_PRESENTATION_PROPS}
                          dangerouslySetInnerHTML={{ __html: iconMarkup(token.iconId) ?? "" }}
                        />
                        <text
                          class="instruction-canvas__chip-label"
                          x={CHIP_WIDTH / 2}
                          y={40}
                          text-anchor="middle"
                          aria-hidden="true"
                        >
                          {label}
                        </text>
                        {token.warning && <WarningBadge attachment={token.warning} />}
                        {token.quantity && <QuantityBadge attachment={token.quantity} />}
                        {!readOnly && (
                          <g
                            class="instruction-canvas__chip-remove"
                            role="button"
                            tabindex={0}
                            aria-label={`Remove ${label}`}
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.stopPropagation();
                              removeTokenFromStep(step.id, token.id);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                event.stopPropagation();
                                removeTokenFromStep(step.id, token.id);
                              }
                            }}
                          >
                            <circle cx={CHIP_WIDTH - 10} cy={10} r={9} />
                            <text x={CHIP_WIDTH - 10} y={13} text-anchor="middle" aria-hidden="true">
                              ×
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                </g>
                {dropIndex !== null &&
                  (() => {
                    const marker = insertionMarkerPosition(dropIndex, step.tokens.length, chipsPerRow);
                    return (
                      <rect
                        class="instruction-canvas__insertion-marker"
                        x={marker.cx - MARKER_WIDTH / 2}
                        y={marker.cy}
                        width={MARKER_WIDTH}
                        height={CHIP_HEIGHT}
                        rx={1.5}
                        aria-hidden="true"
                      />
                    );
                  })()}
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
