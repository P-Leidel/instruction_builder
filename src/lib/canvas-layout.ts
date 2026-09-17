import { validateStep } from "../model/validate";
import { stepDisplayedTime } from "./duration";
import type { InstructionStep, InstructionToken, DurationAttachment } from "../model/instruction";

/**
 * Pure canvas geometry - document (+ a desktop/mobile flag) in, positioned
 * layout out, no rendering or DOM. Pulled out of `InstructionCanvas.tsx`
 * (task 15 prep, per an external architecture audit - see
 * docs/known-issues.md and docs/planned-additions.md item 2) so the same
 * geometry that decides where a chip sits on screen doesn't exist only
 * inside a render function: `InstructionCanvas` renders this, and the
 * export pipeline (task 15) reads the resulting DOM back out of the same
 * canvas rather than recomputing or scraping geometry a second way.
 *
 * `computeCanvasLayout` is the module's whole public interface for document
 * geometry: each StepLayout it returns carries every chip position,
 * connector path, and centering offset a step needs, so InstructionCanvas
 * never has to call a geometry primitive itself mid-render (a 2026-09-15
 * architecture review deepened this module for that reason - see
 * docs/phase-3/audits/2026-09-15-canvas-architecture-review.html). The chip/
 * connector/row-width primitives below are private to this file. The one
 * function that stays a separate public seam is `insertionMarkerPosition` -
 * it depends on live drag state, not the document, so it can't be folded
 * into a memo keyed on the document alone (see its own comment).
 *
 * Also reserves - as fixed-position, document-independent geometry, not
 * something a StepLayout computes per step - room for the per-step
 * management controls (select badge, drag-to-reorder handle, move up/down,
 * remove) that replaced the standalone StepList panel: `STEP_CONTROLS_WIDTH`
 * and the other exported STEP_CONTROL, REORDER_HANDLE, and MOVE_UP/DOWN
 * constants below place that left edge column, and `addStepRowY` positions
 * the "+ Add step" row past the last step. InstructionCanvas.tsx renders all
 * of it; this module only guarantees the space exists and stays clear of
 * chips.
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

// Token-level duration label, drawn above a chip - reserved for every row
// unconditionally (see computeRowStartYs below), whether or not any token in
// that row actually has its own `time` (InstructionToken.time) to show
// there. It used to be reserved only for a row that actually had a timed
// token, which meant a step's rendered height changed the moment someone
// attached (or removed) a token's duration - the same class of bug a step's
// own duration was already fixed to avoid (see stepDisplayedTime/lib/
// duration.ts: a step's own time renders inline before its title instead,
// in space that was already fixed regardless of data). A token chip has no
// equivalent "already fixed" slot to borrow the way a step's title line
// does, so here the fix is the opposite: make the reserved space itself
// unconditional instead, so layout stops depending on which tokens happen
// to have a time.
export const CHIP_TIME_HEADER_HEIGHT = 14;

// A step's left-edge control column (select badge, then drag handle, then
// move up/down - see InstructionCanvas.tsx) is reserved at a fixed width for
// every step, the same way PADDING is a fixed canvas margin rather than
// something derived from content - so tokens never render underneath it
// (see tokensOffsetX below) regardless of how wide or narrow a step's own
// row of chips is.
export const STEP_CONTROLS_WIDTH = 28;
// Horizontal center of the select badge, drag handle, and move up/down
// controls - all four stack in one column at this x, in that vertical order.
export const STEP_CONTROL_CX = 12;
export const STEP_CONTROL_RADIUS = 9;
// The drag handle sits just below the header band (badge/title/flag all
// live within [0, HEADER_HEIGHT), see the module comment) so it never
// overlaps the badge above it.
export const REORDER_HANDLE_CY = HEADER_HEIGHT + 10;
export const MOVE_UP_CY = REORDER_HANDLE_CY + 22;
export const MOVE_DOWN_CY = MOVE_UP_CY + 22;
// A step with no tokens would otherwise be shorter (HEADER_HEIGHT + PADDING)
// than the reorder stack it has to contain - this floor guarantees every
// step, even an empty one, is tall enough for move-down's circle plus its
// own bottom padding.
const MIN_HEIGHT_FOR_CONTROLS = MOVE_DOWN_CY + STEP_CONTROL_RADIUS + PADDING;

// The "+ Add step" row drawn inside the SVG just past the last step (see
// InstructionCanvas.tsx) - full width, like a step card, but its own fixed
// height rather than anything derived from content.
export const ADD_STEP_ROW_HEIGHT = 44;

export interface StepLayout {
  step: InstructionStep;
  /** y of the card itself. */
  cardY: number;
  displayedTime: DurationAttachment | undefined;
  height: number;
  chipsPerRow: number;
  isComplete: boolean;
  issues: string[];
  /** One entry per token, in order - where InstructionCanvas draws each chip. */
  chipPositions: ChipPosition[];
  /** One entry per consecutive token pair, in array order - see buildConnectors. */
  connectors: ConnectorSegment[];
  /** Horizontal offset that centers this step's token block within the card, always at least STEP_CONTROLS_WIDTH. */
  tokensOffsetX: number;
}

export interface CanvasLayout {
  layouts: StepLayout[];
  totalHeight: number;
  canvasWidth: number;
  /**
   * y where the "+ Add step" row starts, just past the last step (or right
   * at the top margin for an empty document) - a separate field from
   * totalHeight since totalHeight deliberately stays tight (no trailing gap)
   * for the read-only/export canvas, which never renders that row; the
   * editable canvas adds ADD_STEP_ROW_HEIGHT + PADDING on top of this itself
   * (see InstructionCanvas.tsx) rather than this module baking in an
   * editable-vs-read-only distinction its own interface (document + isDesktop
   * in) has no other reason to know about.
   */
  addStepRowY: number;
}

export interface ChipPosition {
  cx: number;
  cy: number;
  col: number;
  row: number;
}

export interface ConnectorSegment {
  key: string;
  d: string;
}

/**
 * The y (in step-local design units) where each row of chips starts,
 * indexed by row number - one entry per row, empty for a token-less step.
 * Every row reserves a CHIP_TIME_HEADER_HEIGHT band above itself
 * unconditionally, so `tokens` only decides row *count* (via chipsPerRow),
 * never each row's own y - see CHIP_TIME_HEADER_HEIGHT's comment for why
 * this stays unconditional rather than only reserving the band for rows
 * that happen to have a timed token. Not exported - see chipPosition's
 * comment.
 */
function computeRowStartYs(tokens: InstructionToken[], chipsPerRow: number): number[] {
  if (tokens.length === 0) return [];
  const lines = Math.ceil(tokens.length / chipsPerRow);
  const rowStartYs: number[] = [];
  let y = HEADER_HEIGHT;
  for (let row = 0; row < lines; row++) {
    y += CHIP_TIME_HEADER_HEIGHT;
    rowStartYs.push(y);
    y += CHIP_HEIGHT + CHIP_GAP;
  }
  return rowStartYs;
}

/**
 * Top-left position (in step-local design units) of the chip at `index`.
 * Not exported: `computeCanvasLayout` is the module's real interface (see its
 * own doc comment) - this and the other geometry primitives below are
 * internal to how it builds a StepLayout, not something a caller should call
 * directly. `insertionMarkerPosition` stays exported, but reads finished
 * ChipPosition values back out of a StepLayout instead of calling this
 * itself - see its own comment.
 */
function chipPosition(index: number, chipsPerRow: number, rowStartYs: number[]): ChipPosition {
  const col = index % chipsPerRow;
  const row = Math.floor(index / chipsPerRow);
  return {
    cx: col * (CHIP_WIDTH + CHIP_GAP),
    cy: rowStartYs[row],
    col,
    row,
  };
}

function desktopChipsPerRow(): number {
  const available = BASE_CANVAS_WIDTH - PADDING * 2;
  return Math.max(1, Math.floor((available + CHIP_GAP) / (CHIP_WIDTH + CHIP_GAP)));
}

function stepHeight(tokenCount: number, rowStartYs: number[]): number {
  const contentHeight =
    tokenCount === 0
      // No chip row to reserve space for.
      ? HEADER_HEIGHT + PADDING
      : rowStartYs[rowStartYs.length - 1] + CHIP_HEIGHT + PADDING;
  return Math.max(contentHeight, MIN_HEIGHT_FOR_CONTROLS);
}

/** Width (in design units) of the widest single row a step actually uses. Not exported - see chipPosition's comment. */
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
 *
 * Not exported - see chipPosition's comment.
 */
function buildConnectors(tokenCount: number, chipsPerRow: number, rowStartYs: number[]): ConnectorSegment[] {
  const segments: ConnectorSegment[] = [];
  for (let i = 1; i < tokenCount; i++) {
    const from = chipPosition(i - 1, chipsPerRow, rowStartYs);
    const to = chipPosition(i, chipsPerRow, rowStartYs);
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
      //
      // Measured from `from`'s own bottom, not `to`'s top: the plain
      // CHIP_GAP band between rows always starts right after the source
      // row's chips, regardless of whether the target row reserves its own
      // extra time-label band beyond that gap (see computeRowStartYs) - so
      // this stays correct whether or not `to`'s row has one.
      const gapMidY = from.cy + CHIP_HEIGHT + CHIP_GAP / 2;
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
 * dragged over. `dropIndex` (already clamped to [0, chipPositions.length])
 * is usually just the target chip's own position - except appending to a
 * row that's exactly full, where the naive position would start a phantom
 * new row below the step's actual (unchanged, until drop) height. Clamped
 * instead to just after the last chip in the existing last row.
 *
 * Takes the hovered step's already-computed `chipPositions` (from its
 * StepLayout) rather than raw counts: every *existing* chip's position -
 * including any row's own reserved time-label band (see
 * computeRowStartYs) - is just read back from there, not recomputed. Only
 * the two cases where `dropIndex` points past the last real chip (append to
 * a full row, or append to a row with room) still need their own math, and
 * neither needs to know about time-label bands itself: both derive their y
 * from the *last real chip's* own cy, which already accounts for whatever
 * band its row has.
 *
 * Kept separate from StepLayout/computeCanvasLayout deliberately: this
 * depends on live drag state (the hovered drop slot) that changes on every
 * pointer move, a much higher rate than the document itself. Folding it into
 * the memoized computeCanvasLayout would force either a full canvas relayout
 * on every drag hover, or threading drag state into that memo's
 * dependencies - both worse than calling this directly at render time with
 * whatever slot is currently hovered, reading the rest from the layout
 * InstructionCanvas already has in scope (see InstructionCanvas.tsx).
 */
export function insertionMarkerPosition(
  dropIndex: number,
  chipPositions: ChipPosition[],
  chipsPerRow: number,
): ChipPosition {
  if (chipPositions.length === 0) {
    // Matches computeRowStartYs' first row exactly (HEADER_HEIGHT + the
    // unconditional CHIP_TIME_HEADER_HEIGHT band) - otherwise the marker
    // would preview one y for an empty step's first drop, then the actual
    // chip would land CHIP_TIME_HEADER_HEIGHT lower once dropped.
    return { cx: 0, cy: HEADER_HEIGHT + CHIP_TIME_HEADER_HEIGHT, col: 0, row: 0 };
  }
  if (dropIndex < chipPositions.length) {
    return chipPositions[dropIndex];
  }
  const last = chipPositions[chipPositions.length - 1];
  if (chipPositions.length % chipsPerRow === 0) {
    return { ...last, cx: last.cx + CHIP_WIDTH };
  }
  const col = dropIndex % chipsPerRow;
  return { cx: col * (CHIP_WIDTH + CHIP_GAP), cy: last.cy, col, row: last.row };
}

/**
 * Lays out every step top-to-bottom, then sizes the canvas to the widest
 * row actually used (with room on both sides for a row-wrap connector's
 * lead-out/lead-in stubs - see `buildConnectors`) rather than a fixed width,
 * so a document with only short steps doesn't carry a canvas full of empty
 * horizontal space. `isDesktop` switches between the wrapped multi-row
 * desktop layout and mobile's single-row-per-step layout (see
 * `useIsDesktop` in InstructionCanvas.tsx).
 *
 * This is the module's real interface: every chip position, connector path,
 * and centering offset InstructionCanvas draws comes from the returned
 * StepLayout objects, not from calling the geometry primitives above
 * directly (they're private for exactly this reason). The one exception is
 * `insertionMarkerPosition` - see its own comment for why it has to stay a
 * separate seam.
 */
export function computeCanvasLayout(steps: InstructionStep[], isDesktop: boolean): CanvasLayout {
  const perRowOnDesktop = desktopChipsPerRow();
  let cursor = PADDING;
  const layouts: StepLayout[] = [];
  for (const step of steps) {
    const chipsPerRow = isDesktop ? perRowOnDesktop : Math.max(1, step.tokens.length);
    const rowStartYs = computeRowStartYs(step.tokens, chipsPerRow);
    const height = stepHeight(step.tokens.length, rowStartYs);
    const validation = validateStep(step);
    const displayedTime = stepDisplayedTime(step);
    const cardY = cursor;
    const chipPositions = step.tokens.map((_, index) => chipPosition(index, chipsPerRow, rowStartYs));
    layouts.push({
      step,
      cardY,
      displayedTime,
      height,
      chipsPerRow,
      isComplete: validation.isComplete,
      issues: validation.issues,
      chipPositions,
      connectors: buildConnectors(step.tokens.length, chipsPerRow, rowStartYs),
      // Filled in below, once canvasWidth (which depends on every step's
      // widest row, not just this one) is known.
      tokensOffsetX: 0,
    });
    cursor = cardY + height + ROW_GAP;
  }

  const totalHeight =
    layouts.length > 0
      ? layouts[layouts.length - 1].cardY + layouts[layouts.length - 1].height + PADDING
      : PADDING * 2;
  const addStepRowY = cursor;

  const widestContent = layouts.reduce(
    (max, l) => Math.max(max, widestRowWidth(l.step.tokens.length, l.chipsPerRow)),
    0,
  );
  // Reserves room on *both* sides for the row-wrap bend's lead-out/lead-in
  // stubs (see buildConnectors): the widest row is centered with exactly
  // CONNECTOR_LEAD_OUT of slack on its left and right within this width
  // (see tokensOffsetX below), so neither stub can ever poke past a step
  // card's own border, even when a row's own width exactly matches the
  // canvas's widest content. STEP_CONTROLS_WIDTH is then added on top,
  // uniformly, as the card's own reserved left-edge control column - it
  // isn't part of the centering math above, just extra width every card
  // carries regardless of content.
  const contentWidth = Math.max(
    BASE_CANVAS_WIDTH,
    widestContent + CONNECTOR_LEAD_OUT * 2 + PADDING * 2,
  );
  const canvasWidth = contentWidth + STEP_CONTROLS_WIDTH;

  // Centers each step's own token block horizontally within the space to the
  // right of the reserved control column, instead of leaving it flush
  // against that column - a step with only a couple of tokens on a wide card
  // otherwise reads as lopsided. Computed per step (each step's own content
  // width) against the one shared contentWidth, so a short step centers
  // within the same width a long step fills edge-to-edge. This has to be a
  // second pass: contentWidth isn't known until every step's widest row has
  // been seen above.
  for (const layout of layouts) {
    const rowWidth = widestRowWidth(layout.step.tokens.length, layout.chipsPerRow);
    layout.tokensOffsetX = STEP_CONTROLS_WIDTH + Math.max(0, (contentWidth - PADDING * 2 - rowWidth) / 2);
  }

  return { layouts, totalHeight, canvasWidth, addStepRowY };
}
