import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import {
  document,
  selectedStepId,
  selectedTokenId,
  selectStep,
  selectToken,
  removeTokenFromStep,
  moveToken,
  addStep,
  removeStep,
  moveStepUp,
  moveStepDown,
  reorderSteps,
} from "../../state/document";
import { dragGhost, dropTarget } from "../../state/drag";
import { beginPointerDrag, resolveTokenDropTarget, resolveStepDropIndex } from "../../lib/pointer-drag";
import { iconMarkup, ICON_PRESENTATION_PROPS } from "../../data/icon-library";
import {
  DESKTOP_QUERY,
  PADDING,
  CHIP_WIDTH,
  CHIP_HEIGHT,
  CHIP_TIME_HEADER_HEIGHT,
  BADGE_SIZE,
  MARKER_WIDTH,
  ICON_DRAW_SIZE,
  STEP_CONTROL_CX,
  STEP_CONTROL_RADIUS,
  REORDER_HANDLE_CY,
  MOVE_UP_CY,
  MOVE_DOWN_CY,
  ADD_STEP_ROW_HEIGHT,
  insertionMarkerPosition,
  computeCanvasLayout,
} from "../../lib/canvas-layout";
import type { TokenAttachment } from "../../model/instruction";

// Warning badge (see InstructionToken.warning): a small, fixed-corner
// icon-only marker on a chip, chosen over resizing the chip so the existing
// row/wrap layout math (lib/canvas-layout.ts) never has to account for a
// token being "taller" because it happens to have a warning. Quantity's own
// badge (below) needs visible text instead, so it gets a different shape (a
// pill, not a circle) - Time has no chip badge at all, see this file's
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

// A step's remove control (×), top-right corner of the card - same visual
// language as the chip's own remove button (below), sized to match. The
// incomplete-step flag (!) shares that corner, positioned this button's
// STEP_FLAG_GAP to its left rather than at a fixed offset from the card
// edge - simpler than branching the flag's own x on whether the remove
// button happens to be shown for this particular step (it isn't, for the
// sole remaining step - see steps.length guard below).
const STEP_REMOVE_RADIUS = 9;
const STEP_REMOVE_CY = 12;
const STEP_REMOVE_MARGIN = 14; // distance from the card's right edge to the remove button's center
const STEP_FLAG_GAP = 28;

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
   * Task 15 (SVG Export) reuses this exact mode: `App` keeps one hidden,
   * always-rendered `readOnly` instance around purely so the export button
   * has a live, always-current SVG node to serialize (see
   * `lib/svg-export.ts`) - export never re-renders or recomputes layout on
   * its own.
   */
  readOnly?: boolean;
}

/**
 * Phase 2 task 6: renders the whole document as native SVG, replacing
 * StepBuilder's HTML prototype now that Phase 1 validated the interaction
 * model. Token icons (task 7) are inlined Lucide path markup resolved by
 * `iconId` via data/icon-library.ts - inlined rather than referenced with
 * `<image href>` so a future SVG export (task 15) stays self-contained.
 * Layout geometry (chip/connector/insertion-marker positions, canvas
 * sizing) lives in `lib/canvas-layout.ts`, not here - this component only
 * renders whatever that module computes (task 15 prep, per an external
 * architecture audit - see docs/known-issues.md).
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
 * not stored - see docs/planned-additions.md #3 for what per-connection
 * style/labels would need later.
 *
 * On mobile (below the 800px breakpoint) each step's tokens stay in a
 * single row instead of wrapping, and the SVG's rendered width is clamped
 * (see .instruction-canvas__svg in global.css) so icons neither shrink
 * below nor grow past a reasonable size - both are easy to revisit later
 * (swap the mobile chipsPerRow back to the wrapped desktop formula, or
 * change the clamp bounds).
 *
 * A token with its own `time` (see InstructionToken.time) shows it above
 * its chip, the same idea as a step's own duration header above its card -
 * `lib/canvas-layout.ts` reserves the room per row of chips (only when a
 * row actually has a timed token in it), not here; this just renders the
 * label for whichever tokens have one.
 *
 * Step management (previously a standalone StepList side panel) lives on the
 * canvas itself: each step's title renders next to its select badge, a
 * left-edge control column below the badge holds a drag-to-reorder handle
 * (pointer-only, same `beginPointerDrag`/`dragGhost` pattern as a token
 * drag, drop slot resolved via `resolveStepDropIndex`) plus click-only move
 * up/down buttons (the keyboard-operable path, each disabled at its end of
 * the list), and a remove (×) button sits in the card's top-right corner -
 * both the reorder controls and remove are hidden for the sole remaining
 * step, same rule StepList used. A dashed "+ Add step" row renders inside
 * the SVG just past the last step. All of it is hidden when `readOnly`, same
 * as the token-level editing controls above.
 */
export function InstructionCanvas({ readOnly = false }: InstructionCanvasProps) {
  const steps = document.value.steps;
  const isDesktop = useIsDesktop();
  const svgRef = useRef<SVGSVGElement>(null);

  const { layouts, totalHeight, canvasWidth, addStepRowY } = useMemo(
    () => computeCanvasLayout(steps, isDesktop),
    [steps, isDesktop],
  );
  // computeCanvasLayout stays read-only-agnostic (document + isDesktop is its
  // whole interface - see its own comment), so the "+ Add step" row's extra
  // height only applies here, where readOnly is actually known: the read-only/
  // export canvas stays exactly totalHeight tall (no trailing gap for a row
  // it never draws), the editable one reserves ADD_STEP_ROW_HEIGHT + PADDING
  // past addStepRowY for it.
  const svgHeight = readOnly ? totalHeight : addStepRowY + ADD_STEP_ROW_HEIGHT + PADDING;

  return (
    <div class={`instruction-canvas${readOnly ? " instruction-canvas--readonly" : ""}`}>
      <h2 class="instruction-canvas__heading">Instructions</h2>
      <svg
        ref={svgRef}
        class="instruction-canvas__svg"
        viewBox={`0 0 ${canvasWidth} ${svgHeight}`}
        role="group"
        aria-label={
          readOnly
            ? `${steps.length} instruction step${steps.length === 1 ? "" : "s"}, read-only preview`
            : `${steps.length} instruction step${steps.length === 1 ? "" : "s"}, each with a select button and removable tokens`
        }
      >
        {layouts.map(
          (
            {
              step,
              cardY,
              headerHeight,
              displayedTime,
              height,
              chipsPerRow,
              isComplete,
              issues,
              chipPositions,
              connectors,
              tokensOffsetX,
            },
            index,
          ) => {
          const isSelected = !readOnly && step.id === selectedStepId.value;
          const isDropTarget = !readOnly && dropTarget.value?.stepId === step.id;
          const dropIndex = isDropTarget
            ? Math.min(dropTarget.value!.index, step.tokens.length)
            : null;
          const stepNumber = index + 1;
          // See model/validate.ts's shouldFlagIncompleteStep: a step with zero
          // tokens is always technically incomplete, but the persistent badge
          // (and this label) is deferred until the user has actually added
          // one, so a brand-new document doesn't flag itself before anything
          // has been built. Export's own incomplete-step warning toast still
          // checks `isComplete` directly and is unaffected.
          const showIncompleteFlag = !isComplete && step.tokens.length > 0;
          const selectLabel = showIncompleteFlag
            ? `Select step ${stepNumber}, incomplete: ${issues.join(", ")}`
            : `Select step ${stepNumber}`;

          const canMoveUp = index > 0;
          const canMoveDown = index < steps.length - 1;
          const canReorder = !readOnly && steps.length > 1;
          const canRemove = !readOnly && steps.length > 1;

          return (
            <g
              key={step.id}
              transform={`translate(${PADDING}, ${cardY})`}
              data-step-id={step.id}
              data-step-index={index}
            >
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
              <text
                class="instruction-canvas__step-title"
                x={BADGE_SIZE + 12}
                y={16}
                aria-hidden="true"
              >
                {step.title || "Untitled step"}
              </text>
              {showIncompleteFlag && (
                <g aria-hidden="true">
                  <text
                    class="instruction-canvas__flag"
                    x={canvasWidth - PADDING * 2 - STEP_REMOVE_MARGIN - STEP_FLAG_GAP}
                    y={20}
                  >
                    !<title>{issues.join(", ")}</title>
                  </text>
                </g>
              )}
              {canRemove && (
                <g
                  class="instruction-canvas__step-remove"
                  role="button"
                  tabindex={0}
                  aria-label={`Remove step ${stepNumber}`}
                  onClick={() => removeStep(step.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      removeStep(step.id);
                    }
                  }}
                >
                  <circle
                    cx={canvasWidth - PADDING * 2 - STEP_REMOVE_MARGIN}
                    cy={STEP_REMOVE_CY}
                    r={STEP_REMOVE_RADIUS}
                  />
                  <text
                    x={canvasWidth - PADDING * 2 - STEP_REMOVE_MARGIN}
                    y={STEP_REMOVE_CY + 3}
                    text-anchor="middle"
                    aria-hidden="true"
                  >
                    ×
                  </text>
                </g>
              )}
              {canReorder && (
                <g class="instruction-canvas__step-controls">
                  <g
                    class="instruction-canvas__step-drag-handle"
                    aria-hidden="true"
                    onPointerDown={(event) => {
                      beginPointerDrag(event, {
                        onMove: (x, y) => {
                          dragGhost.value = { label: step.title || "Untitled step", x, y };
                        },
                        onDrop: (_x, y, wasDrag) => {
                          dragGhost.value = null;
                          if (!wasDrag || !svgRef.current) return;
                          reorderSteps(index, resolveStepDropIndex(y, svgRef.current));
                        },
                      });
                    }}
                  >
                    <circle cx={STEP_CONTROL_CX} cy={REORDER_HANDLE_CY} r={STEP_CONTROL_RADIUS} />
                    <text x={STEP_CONTROL_CX} y={REORDER_HANDLE_CY + 3} text-anchor="middle">
                      ⠿
                    </text>
                  </g>
                  <g
                    class={`instruction-canvas__step-move instruction-canvas__step-move--up${canMoveUp ? "" : " instruction-canvas__step-move--disabled"}`}
                    role="button"
                    tabindex={canMoveUp ? 0 : -1}
                    aria-disabled={canMoveUp ? undefined : "true"}
                    aria-label={`Move step ${stepNumber} up`}
                    onClick={() => canMoveUp && moveStepUp(step.id)}
                    onKeyDown={(event) => {
                      if ((event.key === "Enter" || event.key === " ") && canMoveUp) {
                        event.preventDefault();
                        moveStepUp(step.id);
                      }
                    }}
                  >
                    <circle cx={STEP_CONTROL_CX} cy={MOVE_UP_CY} r={STEP_CONTROL_RADIUS} />
                    <text x={STEP_CONTROL_CX} y={MOVE_UP_CY + 3} text-anchor="middle" aria-hidden="true">
                      ↑
                    </text>
                  </g>
                  <g
                    class={`instruction-canvas__step-move instruction-canvas__step-move--down${canMoveDown ? "" : " instruction-canvas__step-move--disabled"}`}
                    role="button"
                    tabindex={canMoveDown ? 0 : -1}
                    aria-disabled={canMoveDown ? undefined : "true"}
                    aria-label={`Move step ${stepNumber} down`}
                    onClick={() => canMoveDown && moveStepDown(step.id)}
                    onKeyDown={(event) => {
                      if ((event.key === "Enter" || event.key === " ") && canMoveDown) {
                        event.preventDefault();
                        moveStepDown(step.id);
                      }
                    }}
                  >
                    <circle cx={STEP_CONTROL_CX} cy={MOVE_DOWN_CY} r={STEP_CONTROL_RADIUS} />
                    <text x={STEP_CONTROL_CX} y={MOVE_DOWN_CY + 3} text-anchor="middle" aria-hidden="true">
                      ↓
                    </text>
                  </g>
                </g>
              )}
              <g transform={`translate(${tokensOffsetX}, 0)`}>
                <g class="instruction-canvas__connectors" aria-hidden="true">
                  {connectors.map((segment) => (
                    <path key={segment.key} class="instruction-canvas__connector" d={segment.d} />
                  ))}
                </g>
                <g class="instruction-canvas__tokens">
                  {step.tokens.map((token, tokenIndex) => {
                    const { cx, cy } = chipPositions[tokenIndex];
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
                                  onMove: (x, y) => {
                                    dragGhost.value = { label, x, y };
                                    const target = resolveTokenDropTarget(x, y);
                                    // Reassigning an equal-but-new object would
                                    // still re-render the whole canvas below
                                    // (it reads dropTarget.value directly) even
                                    // though nothing about the hovered slot
                                    // actually changed - skip the write when
                                    // the target is the same one already set.
                                    const current = dropTarget.value;
                                    if (
                                      current?.stepId !== target?.stepId ||
                                      current?.index !== target?.index
                                    ) {
                                      dropTarget.value = target;
                                    }
                                  },
                                  onDrop: (x, y, wasDrag) => {
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
                                    const target = resolveTokenDropTarget(x, y);
                                    if (target) {
                                      moveToken(step.id, token.id, target.stepId, target.index);
                                    }
                                  },
                                });
                              }
                        }
                      >
                        {token.time && (
                          <text
                            class="instruction-canvas__chip-time"
                            x={CHIP_WIDTH / 2}
                            y={-CHIP_TIME_HEADER_HEIGHT + 10}
                            text-anchor="middle"
                          >
                            {token.time.label}
                          </text>
                        )}
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
                    const marker = insertionMarkerPosition(dropIndex, chipPositions, chipsPerRow);
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
        {!readOnly && (
          <g
            class="instruction-canvas__add-step"
            role="button"
            tabindex={0}
            aria-label="Add step"
            transform={`translate(${PADDING}, ${addStepRowY})`}
            onClick={addStep}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                addStep();
              }
            }}
          >
            <rect
              class="instruction-canvas__add-step-bg"
              x={0}
              y={0}
              width={canvasWidth - PADDING * 2}
              height={ADD_STEP_ROW_HEIGHT}
              rx={8}
            />
            <text
              x={(canvasWidth - PADDING * 2) / 2}
              y={ADD_STEP_ROW_HEIGHT / 2 + 5}
              text-anchor="middle"
              aria-hidden="true"
            >
              + Add step
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
