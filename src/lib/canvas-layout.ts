import { validateStep, shouldFlagIncompleteStep } from "../model/validate";
import { stepDisplayedTime } from "./duration";
import type { InstructionStep, InstructionToken, DurationAttachment } from "../model/instruction";

/**
 * Pure canvas geometry - document (+ a desktop/mobile flag) in, positioned
 * layout out, no rendering or DOM. Pulled out of `InstructionCanvas.tsx`
 * (task 15 prep, per an external architecture audit - see
 * docs/known-issues.md and docs/planned-additions.md item 2) so the same
 * geometry that decides where a chip sits on screen doesn't exist only
 * inside a render function: `InstructionCanvas` renders this, and SVG/PNG
 * export read the resulting DOM back out of the same rendered canvas rather
 * than recomputing geometry a second way. PDF export instead takes a
 * `CanvasLayout` directly from its caller (2026-09-17 remediation, part 2 -
 * see `lib/pdf-export.ts`'s own comment) - it needs the numbers themselves
 * (`cardY`/`height` per step) for pagination, not just a DOM node to
 * serialize, so reading them straight from this module's own output rather
 * than parsing them back out of rendered SVG attributes avoids a redundant
 * round-trip.
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
  /** Whether the persistent "!" badge should render - see shouldFlagIncompleteStep (model/validate.ts). */
  shouldFlagIncomplete: boolean;
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
 * dragged over. The slot's `index` (already clamped to
 * [0, chipPositions.length]) is usually just the target chip's own position
 * - except at a row boundary, where one index means two different places on
 * screen and its `row` is what says which of them the pointer is actually
 * at. It takes the whole `ChipSlot` rather than those two fields
 * separately: only the pair is meaningful here, and every branch below
 * reads both.
 *
 * At `dropIndex = N * chipsPerRow` the token lands in the same slot whether
 * the user reads it as "after the last chip of row N-1" or "before the first
 * chip of row N" - identical insertions, a full row apart visually. Drawing
 * the marker at the naive position (the chip now at `dropIndex`) puts it at
 * the start of the *next* row while the pointer is still at the end of the
 * current one, so the preview contradicts the pointer by a whole row. When
 * `hoveredRow` is the row before the boundary, the marker is drawn just past
 * that row's last chip instead. Appending to an exactly-full last row is the
 * same case and falls out of the same branch: without it the marker would
 * start a phantom new row below the step's actual (unchanged, until drop)
 * height.
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
  slot: ChipSlot,
  chipPositions: ChipPosition[],
  chipsPerRow: number,
): ChipPosition {
  const { index: dropIndex, row: hoveredRow } = slot;
  if (chipPositions.length === 0) {
    // Matches computeRowStartYs' first row exactly (HEADER_HEIGHT + the
    // unconditional CHIP_TIME_HEADER_HEIGHT band) - otherwise the marker
    // would preview one y for an empty step's first drop, then the actual
    // chip would land CHIP_TIME_HEADER_HEIGHT lower once dropped.
    return { cx: 0, cy: HEADER_HEIGHT + CHIP_TIME_HEADER_HEIGHT, col: 0, row: 0 };
  }
  if (dropIndex > 0 && dropIndex % chipsPerRow === 0 && hoveredRow === dropIndex / chipsPerRow - 1) {
    // End of the row the pointer is in, not the start of the next one.
    const lastInRow = chipPositions[dropIndex - 1];
    return { ...lastInRow, cx: lastInRow.cx + CHIP_WIDTH };
  }
  if (dropIndex < chipPositions.length) {
    return chipPositions[dropIndex];
  }
  const last = chipPositions[chipPositions.length - 1];
  const col = dropIndex % chipsPerRow;
  return { cx: col * (CHIP_WIDTH + CHIP_GAP), cy: last.cy, col, row: last.row };
}

/**
 * Lays out every step top-to-bottom, then sizes the canvas to the widest
 * row actually used (with room on both sides for a row-wrap connector's
 * lead-out/lead-in stubs - see `buildConnectors`) rather than a fixed width,
 * so a document with only short steps doesn't carry a canvas full of empty
 * horizontal space. `isDesktop` switches between the wrapped multi-row
 * desktop layout and mobile's single-row-per-step layout (see the
 * `isDesktop` signal in state/canvas.ts, which is where both of the app's
 * layouts are derived).
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
      shouldFlagIncomplete: shouldFlagIncompleteStep(step, validation),
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

/* ------------------------------------------------------------------ *
 * Drop resolution
 *
 * Where a pointer is, expressed as a place in the document. This used to
 * live in lib/pointer-drag.ts and read the rendered DOM - `elementFromPoint`
 * for the step, then one `getBoundingClientRect()` per chip for the slot.
 * It lives here now because this module already knows every one of those
 * numbers exactly: re-deriving them from markup meant the same geometry
 * existed twice, and the measured copy was subtly not the computed one (a
 * chip's `<g>` also contains its token-time label, so a timed chip measured
 * CHIP_TIME_HEADER_HEIGHT taller than an untimed sibling and pulled its
 * whole row's span up with it - see the 2026-09-20 candidate 1 write-up).
 *
 * Everything below is pure, over design units. The DOM read that turns a
 * pointer event into a CanvasPoint is `clientToCanvasPoint` in
 * lib/pointer-drag.ts, and `state/canvas.ts` is what puts the two together
 * for the live editable canvas - with one further read, `isInsideViewport`,
 * rejecting points the canvas is clipped away from before either runs.
 * ------------------------------------------------------------------ */

/**
 * A point in the canvas's own design units - the same coordinate space
 * every `cardY`/`cx`/`cy` above is in, and what `clientToCanvasPoint`
 * (lib/pointer-drag.ts) converts a pointer event's client coordinates into.
 */
export interface CanvasPoint {
  x: number;
  y: number;
}

export interface TokenDropTarget {
  stepId: string;
  /** Drop-before insertion index within the target step's tokens, always within [0, tokens.length]. */
  index: number;
}

/**
 * A resolved drop position within *one step's* existing chips: where the
 * token lands (`index`) plus which row of chips the pointer read as being
 * in (`row`). The row is redundant for the move itself - `moveToken`/
 * `addTokenToStep` only ever take a `TokenDropTarget` - but not for drawing
 * the live insertion marker, because a row boundary is exactly where the
 * index alone stops being enough: on a 6-per-row layout, index 6 is both
 * "after the last chip of row 0" and "before the first chip of row 1". Those
 * are the same insertion, and a marker has to pick one place to draw. See
 * `insertionMarkerPosition` above, which takes one of these.
 *
 * Deliberately *not* named for the glossary's "drop slot": CONTEXT.md
 * reserves that term for a drop target plus the row - a step id included -
 * and this is that minus the step. Naming both after one glossary term would
 * leave the term meaning two types, the narrower of which cannot say which
 * step it belongs to.
 */
export interface ChipSlot {
  index: number;
  row: number;
}

/**
 * A `ChipSlot` plus the step it belongs to - the glossary's drop slot, and
 * what a live drag hover resolves to.
 */
export type TokenDropSlot = TokenDropTarget & ChipSlot;

/**
 * One chip's extent in canvas design units, tagged with the token index it
 * stands for. Built from a StepLayout's own `chipPositions` (see
 * `chipRects`), never measured - which is what makes every rect exactly
 * CHIP_WIDTH by CHIP_HEIGHT regardless of what a chip happens to render
 * inside itself.
 */
interface ChipRect {
  index: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Groups chips into rendered rows. Chips that wrapped onto the same row
 * share a top exactly (every row is one uniform stride below the last - see
 * `computeRowStartYs`), so this compares each chip's vertical *center*
 * against the row's span rather than its top against a tolerance: two real
 * rows can never merge, since they're a full chip height plus a gap apart.
 *
 * Kept as a scan rather than `Math.floor(index / chipsPerRow)` because the
 * comparison it feeds (`nearestRow`) needs each row's actual y span, not
 * just which row an index belongs to.
 */
function groupIntoRows(rects: ChipRect[]): ChipRect[][] {
  const sorted = [...rects].sort((a, b) => a.top - b.top || a.left - b.left);
  const rows: ChipRect[][] = [];
  for (const rect of sorted) {
    const row = rows[rows.length - 1];
    const centerY = (rect.top + rect.bottom) / 2;
    if (row && centerY > row[0].top && centerY < row[0].bottom) {
      row.push(rect);
    } else {
      rows.push([rect]);
    }
  }
  return rows;
}

/**
 * The row `y` is nearest to, by distance to that row's own vertical span (0
 * while inside it). Every point in the step resolves to some row - there is
 * deliberately no "outside the chips entirely" case, so hovering a step's
 * header band or the padding below its last row still previews a real slot
 * rather than nothing. The consequence, accepted when this replaced the
 * original hit-test: the far left of the header band clamps to row 0 and so
 * reads as *insert at front*, not append. The live insertion marker shows
 * that before release, which is why one uniform rule beat carving out a
 * special case for the bands around the chips - recorded, with the
 * alternative that was weighed, in
 * docs/adr/0004-every-point-in-a-step-resolves-to-a-slot.md.
 */
function nearestRow(y: number, rows: ChipRect[][]): number {
  let nearest = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (let row = 0; row < rows.length; row++) {
    const { top, bottom } = rows[row][0];
    const distance = y < top ? top - y : y > bottom ? y - bottom : 0;
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = row;
    }
  }
  return nearest;
}

/**
 * Where a drop at `point` lands among one step's chips: clamp to the
 * nearest row, then compare x against each chip's horizontal midpoint -
 * left half inserts before that chip, right half after it.
 *
 * A midpoint scan rather than "whichever chip is under the pointer": the
 * CHIP_GAP between two chips belongs to neither chip, so a hit-test found
 * nothing there and could only fall back to "append to the end of the
 * step". Dropping a token into the visible gap *between* two chips, the
 * most natural way to express "put it here", silently sent it to the end
 * instead. A midpoint scan has no such dead zone: every point in the step
 * belongs to exactly one slot, and the gap resolves to the boundary it
 * straddles.
 */
function resolveDropSlot(point: CanvasPoint, rects: ChipRect[]): ChipSlot {
  if (rects.length === 0) return { index: 0, row: 0 };
  const rows = groupIntoRows(rects);
  const row = nearestRow(point.y, rows);
  const chips = rows[row];
  for (const chip of chips) {
    if (point.x < (chip.left + chip.right) / 2) return { index: chip.index, row };
  }
  // Past the midpoint of the row's last chip: insert after it. On a full
  // row that index is also the next row's first slot - which is exactly
  // what `row` is carried along to disambiguate.
  return { index: chips[chips.length - 1].index + 1, row };
}

/**
 * One step's chips as canvas-unit rects. The chain mirrors exactly what
 * StepCard renders: the card group is translated by (PADDING, cardY), the
 * token group inside it by (tokensOffsetX, 0), and each chip by its own
 * (cx, cy). Every rect is exactly one chip's size, so a chip that happens
 * to carry a duration label, a warning badge, or a quantity pill has the
 * same hit box as one that carries none.
 */
function chipRects(layout: StepLayout): ChipRect[] {
  const originX = PADDING + layout.tokensOffsetX;
  return layout.chipPositions.map((position, index) => ({
    index,
    left: originX + position.cx,
    right: originX + position.cx + CHIP_WIDTH,
    top: layout.cardY + position.cy,
    bottom: layout.cardY + position.cy + CHIP_HEIGHT,
  }));
}

/**
 * Which step - and which slot within it - a point in canvas units falls in,
 * or null when it falls outside every step card. The whole resolution a
 * token drag needs, from one layout value: both the drag's live insertion
 * marker and the move it eventually commits come from this one call, so the
 * preview and the drop cannot disagree about geometry.
 *
 * A point outside every card resolves to nothing rather than to the nearest
 * step: a mis-aimed drag should do nothing, not move a token somewhere the
 * user never pointed at. The x bounds are the step card's own - it spans
 * PADDING to canvasWidth - PADDING, the same rect StepCard draws - which is
 * what keeps a pointer beside the canvas (over a side panel, or the page
 * margin) from resolving into whichever step happens to share its y.
 */
export function resolveDropTarget(point: CanvasPoint, layout: CanvasLayout): TokenDropSlot | null {
  if (point.x < PADDING || point.x >= layout.canvasWidth - PADDING) return null;
  const step = layout.layouts.find((l) => point.y >= l.cardY && point.y < l.cardY + l.height);
  if (!step) return null;
  return { stepId: step.step.id, ...resolveDropSlot(point, chipRects(step)) };
}

/**
 * The index a step dragged by its reorder handle should land at - a flat
 * vertical list, so one midpoint comparison per step, falling through to
 * `layouts.length` for a drop below the last card. Only the point's y
 * matters; it takes the whole point anyway so both drag resolutions read
 * the same currency (see `resolveDropTarget` above).
 *
 * Unlike a token drop, this has no "outside every step" case: a step
 * reorder always lands somewhere in the list, exactly as the rect scan it
 * replaces did. `reorderSteps` (state/document.ts) is what no-ops when the
 * index it gets is the step's own.
 */
export function resolveStepDropIndex(point: CanvasPoint, layout: CanvasLayout): number {
  for (let index = 0; index < layout.layouts.length; index++) {
    const { cardY, height } = layout.layouts[index];
    if (point.y < cardY + height / 2) return index;
  }
  return layout.layouts.length;
}
