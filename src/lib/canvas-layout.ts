import { validateStep } from "../model/validate";
import { stepDisplayedTime } from "./duration";
import type { InstructionStep, DurationAttachment } from "../model/instruction";

/**
 * Pure canvas geometry - document (+ a desktop/mobile flag) in, positioned
 * layout out, no rendering or DOM. Pulled out of `InstructionCanvas.tsx`
 * (task 15 prep, per an external architecture audit - see
 * docs/known-issues.md and docs/planned-additions.md item 2) so the same
 * geometry that decides where a chip sits on screen doesn't exist only
 * inside a render function: `InstructionCanvas` renders this, and the
 * export pipeline (task 15) reads the resulting DOM back out of the same
 * canvas rather than recomputing or scraping geometry a second way.
 */

// Keep in sync with the `min-width: 800px` breakpoint in global.css.
export const DESKTOP_QUERY = "(min-width: 800px)";

export const BASE_CANVAS_WIDTH = 720;
export const PADDING = 16;
export const HEADER_HEIGHT = 32;
export const CHIP_WIDTH = 96;
// Raised from 56: a chip now reserves a dedicated bottom band for the
// Quantity badge's visible text (see QuantityBadge) - it needs more room
// than an icon-only badge did, and cramming text into the old height risked
// colliding with the token's own label right above it.
export const CHIP_HEIGHT = 68;
// Wide enough that the connector line drawn in this gap (below) is actually
// visible - an 8-unit gap made the line nearly imperceptible against the
// light chip/step backgrounds even with correct color/geometry.
export const CHIP_GAP = 16;
export const ROW_GAP = 16;
export const BADGE_SIZE = 22;
export const MARKER_WIDTH = 3;
// Both kept equal and reasonably large (not just big enough to round the
// corner) - at the old value (8 design units, only a handful of actual
// screen pixels once the canvas is scaled down for a wide/tall document),
// the curve was small enough that rasterization made different bends read
// as inconsistently "tight" even though their path geometry was identical.
// A more generous radius renders as an unambiguous, consistent curve at any
// canvas scale.
export const CONNECTOR_CORNER_RADIUS = 12;
// How far the row-wrap bend pokes out past the last chip of one row, and
// (mirrored) past the first chip of the next, before curving - so both ends
// of the bend read as distinct stubs rather than one end poking out while
// the other stays flush against its chip's border. Kept equal to the corner
// radius so the straight stub and the curve read as one deliberate shape
// rather than a curve that's noticeably bigger/smaller than its lead-in.
export const CONNECTOR_LEAD_OUT = 12;
// Lucide's native viewBox is 24x24 - drawing at that size needs no rescale.
export const ICON_DRAW_SIZE = 24;

// Step-level duration header (see InstructionStep.time): reserved above a
// step's card only when it has a displayable duration - see
// stepDisplayedTime in lib/duration.ts for the step-time-wins-else-sum-of-
// tokens rule.
export const TIME_HEADER_HEIGHT = 22;

export interface StepLayout {
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

export interface CanvasLayout {
  layouts: StepLayout[];
  totalHeight: number;
  canvasWidth: number;
}

export interface ChipPosition {
  cx: number;
  cy: number;
  col: number;
  row: number;
}

/** Top-left position (in step-local design units) of the chip at `index`. */
export function chipPosition(index: number, chipsPerRow: number): ChipPosition {
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
export function widestRowWidth(tokenCount: number, chipsPerRow: number): number {
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
export function buildConnectors(tokenCount: number, chipsPerRow: number): { key: string; d: string }[] {
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
export function insertionMarkerPosition(
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
 * Lays out every step top-to-bottom, then sizes the canvas to the widest
 * row actually used (with room on both sides for a row-wrap connector's
 * lead-out/lead-in stubs - see `buildConnectors`) rather than a fixed width,
 * so a document with only short steps doesn't carry a canvas full of empty
 * horizontal space. `isDesktop` switches between the wrapped multi-row
 * desktop layout and mobile's single-row-per-step layout (see
 * `useIsDesktop` in InstructionCanvas.tsx).
 */
export function computeCanvasLayout(steps: InstructionStep[], isDesktop: boolean): CanvasLayout {
  const perRowOnDesktop = desktopChipsPerRow();
  let cursor = PADDING;
  const layouts: StepLayout[] = [];
  for (const step of steps) {
    const chipsPerRow = isDesktop ? perRowOnDesktop : Math.max(1, step.tokens.length);
    const height = stepHeight(step.tokens.length, chipsPerRow);
    const validation = validateStep(step);
    const displayedTime = stepDisplayedTime(step);
    const headerHeight = displayedTime ? TIME_HEADER_HEIGHT : 0;
    const cardY = cursor + headerHeight;
    layouts.push({
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

  const totalHeight =
    layouts.length > 0
      ? layouts[layouts.length - 1].cardY + layouts[layouts.length - 1].height + PADDING
      : PADDING * 2;

  const widestContent = layouts.reduce(
    (max, l) => Math.max(max, widestRowWidth(l.step.tokens.length, l.chipsPerRow)),
    0,
  );
  // Reserves room on *both* sides for the row-wrap bend's lead-out/lead-in
  // stubs (see buildConnectors): the widest row is centered with exactly
  // CONNECTOR_LEAD_OUT of slack on its left and right (see
  // InstructionCanvas's tokensOffsetX), so neither stub can ever poke past a
  // step card's own border, even when a row's own width exactly matches the
  // canvas's widest content.
  const canvasWidth = Math.max(
    BASE_CANVAS_WIDTH,
    widestContent + CONNECTOR_LEAD_OUT * 2 + PADDING * 2,
  );

  return { layouts, totalHeight, canvasWidth };
}
