/**
 * Phase 2 task 9 (Drag-and-Drop) / task 10 (Touch Support): a small,
 * framework-agnostic Pointer Events drag tracker, shared by TokenPicker and
 * InstructionCanvas (which uses it for both token drag and, since the
 * standalone StepList panel was folded into the canvas, step-reorder drag
 * too). Pointer Events (rather than the HTML5
 * Drag-and-Drop API) unify mouse/touch/pen input into one code path per the
 * plan's task 9 note - task 10 is largely "verify this works on touch,"
 * not a separate implementation.
 */

/**
 * Pixels of movement before a press counts as a drag, per pointer type. A
 * finger contact patch is far larger and less steady than a mouse cursor, so
 * the same 6px that reads as "deliberate movement" from a mouse is ordinary
 * wobble from a thumb: a plain tap on a chip exceeded it, became a drag, and
 * was then swallowed as a drop onto the token's own slot instead of running
 * the tap's select. Touch gets a higher bar; mouse and pen keep the original
 * one. Deliberately conservative rather than as high as it could go - the
 * own-slot fallback in `resolveTokenPointerOutcome` is the real correctness
 * backstop for a wobbly tap at *any* distance, so this only has to catch the
 * common case without making a real touch drag feel sticky to start.
 */
export const MOUSE_DRAG_THRESHOLD = 6;
export const TOUCH_DRAG_THRESHOLD = 12;

/** The drag threshold for a `PointerEvent.pointerType` - see the constants above. */
export function dragThresholdFor(pointerType: string): number {
  return pointerType === "touch" ? TOUCH_DRAG_THRESHOLD : MOUSE_DRAG_THRESHOLD;
}

export interface DragHandlers {
  /** Called on every pointermove once the drag has passed `threshold`. */
  onMove?: (clientX: number, clientY: number) => void;
  /**
   * Called on pointerup. `wasDrag` is false when the pointer never moved past
   * `threshold` - callers use that to fall back to their normal click/tap
   * behavior instead of a drop. A `pointercancel` does *not* come through
   * here; see `onCancel`.
   */
  onDrop: (clientX: number, clientY: number, wasDrag: boolean) => void;
  /**
   * Called on pointercancel - the browser taking the pointer away (a system
   * gesture, the pointer leaving the screen, a touch becoming a scroll).
   * Required, not optional: a cancel used to be forwarded as
   * `onDrop(..., wasDrag: false)`, which is indistinguishable from a
   * deliberate tap, so an interrupted drag silently performed the tap's
   * action (selecting a token) instead of doing nothing. Every caller has to
   * tear down its own transient drag state (`dragGhost`/`dropTarget`) here,
   * since `onDrop` no longer runs to do it for them.
   */
  onCancel: () => void;
  /** Pixels of movement before this counts as a drag. Defaults to `dragThresholdFor` the event's pointer type. */
  threshold?: number;
}

/**
 * Starts tracking a drag from a `pointerdown` event. Pointer capture keeps
 * delivering move/up events to the origin element even once the pointer
 * moves elsewhere on the page (e.g. from a TokenPicker button onto the
 * canvas), so callers don't need their own document-level listeners.
 */
export function beginPointerDrag(event: PointerEvent, handlers: DragHandlers): void {
  const target = event.currentTarget as Element;
  const startX = event.clientX;
  const startY = event.clientY;
  const threshold = handlers.threshold ?? dragThresholdFor(event.pointerType);
  let moved = false;
  // A trackpad/high-polling-rate mouse can fire several pointermove events
  // per animation frame; each one otherwise triggered a synchronous
  // layout read (resolveTokenDropTarget's hit-test and rect scan) and a signal write
  // that re-renders the whole canvas (task 24 perf pass - see
  // docs/phase-2/progress/task-24-performance.md). Coalescing onMove to at
  // most once per frame, driven by the *last* pointer position seen before
  // that frame paints, keeps the visible result identical - the eye only
  // ever sees one position per frame anyway - while cutting the hit-test/
  // re-render work down to the display's actual refresh rate.
  let latestX = startX;
  let latestY = startY;
  let rafId: number | null = null;

  target.setPointerCapture(event.pointerId);

  function flush() {
    rafId = null;
    handlers.onMove?.(latestX, latestY);
  }

  function onPointerMove(e: PointerEvent) {
    if (!moved && Math.hypot(e.clientX - startX, e.clientY - startY) > threshold) {
      moved = true;
    }
    if (!moved) return;
    latestX = e.clientX;
    latestY = e.clientY;
    if (rafId === null) {
      rafId = requestAnimationFrame(flush);
    }
  }

  function onPointerUp(e: PointerEvent) {
    cleanup();
    handlers.onDrop(e.clientX, e.clientY, moved);
  }

  function onPointerCancel() {
    cleanup();
    handlers.onCancel();
  }

  function cleanup() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    // Plain `Element`'s addEventListener only types its small ElementEventMap
    // (fullscreen events etc.) - pointer events live on HTMLElement/
    // SVGElement's GlobalEventHandlersEventMap instead, and `target` here is
    // typed broadly to cover both. Casting the listener avoids narrowing
    // `target` to a union that TS can't resolve a shared overload for.
    target.removeEventListener("pointermove", onPointerMove as EventListener);
    target.removeEventListener("pointerup", onPointerUp as EventListener);
    target.removeEventListener("pointercancel", onPointerCancel as EventListener);
  }

  target.addEventListener("pointermove", onPointerMove as EventListener);
  target.addEventListener("pointerup", onPointerUp as EventListener);
  target.addEventListener("pointercancel", onPointerCancel as EventListener);
}

/**
 * Finds the index a step dropped at clientY should land at, among
 * `[data-step-index]` groups within `container` - shared by
 * InstructionCanvas's step-reorder drag handle. Bounding-rect-based, for the
 * same reason `resolveDropSlot` below now is: a hit-test can only report the
 * one element actually under the pointer, so it has nothing to say about
 * empty canvas space below the last step, while a rect scan naturally falls
 * through to `items.length` there. The difference between the two is only
 * that steps are a flat vertical list (one midpoint comparison per step),
 * where chips wrap into rows and need the row resolved first.
 */
export function resolveStepDropIndex(clientY: number, container: Element): number {
  const items = Array.from(container.querySelectorAll<Element>("[data-step-index]"));
  for (const item of items) {
    const rect = item.getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) {
      return Number(item.getAttribute("data-step-index"));
    }
  }
  return items.length;
}

export interface TokenDropTarget {
  stepId: string;
  /** Drop-before insertion index within the target step's tokens, always within [0, tokens.length]. */
  index: number;
}

/**
 * A resolved drop position within one step's existing chips: *where* the
 * token lands (`index`) plus *which row of chips the pointer read as being
 * in* (`row`). The row is redundant for the move itself - `moveToken`/
 * `addTokenToStep` only ever take a `TokenDropTarget` - but not for drawing
 * the live insertion marker, because a row boundary is exactly where the
 * index alone stops being enough: on a 6-per-row layout, index 6 is both
 * "after the last chip of row 0" and "before the first chip of row 1". Those
 * are the same insertion, and a marker has to pick one place to draw. See
 * `insertionMarkerPosition` in lib/canvas-layout.ts.
 */
export interface DropSlot {
  index: number;
  row: number;
}

/** A `DropSlot` plus the step it belongs to - what a live drag hover resolves to. */
export type TokenDropSlot = TokenDropTarget & { row: number };

/**
 * One chip's live position on screen, in client coordinates, tagged with the
 * token index it stands for. Client rects (rather than the SVG-user-unit
 * `ChipPosition`s in lib/canvas-layout.ts) because a pointer event's
 * coordinates are already client coordinates: comparing the two directly
 * sidesteps the canvas's viewBox scaling entirely, instead of having to undo
 * it first.
 */
export interface ChipRect {
  index: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * A real drag ends with a `pointerup` that also fires the browser's
 * compatibility `click` event right after - needed for keyboard/simple-tap
 * activation, but not wanted a second time when `onDrop` already handled the
 * drop. Call `markDragged()` from `onDrop` when `wasDrag` is true, and check
 * `wasJustDragged()` at the top of the element's own `onClick` to swallow
 * that one synthetic click. Plain module-scope state (not a hook) to match
 * `beginPointerDrag`/`resolveTokenDropTarget` above - callers that need one
 * of these keep exactly one instance for their component's lifetime, same
 * as the `let` this replaces.
 */
export function createClickAfterDragGuard(): {
  wasJustDragged: () => boolean;
  markDragged: () => void;
} {
  let justDragged = false;
  return {
    wasJustDragged: () => {
      if (!justDragged) return false;
      justDragged = false;
      return true;
    },
    markDragged: () => {
      justDragged = true;
    },
  };
}

export type TokenPointerOutcome =
  | { kind: "selectStep" }
  | { kind: "selectToken" }
  | { kind: "move"; target: TokenDropTarget }
  | { kind: "none" };

/**
 * Turns a token pointer interaction's raw facts - did it drag, was its step
 * already selected, and (if it dragged) what's under the pointer now - into
 * what should happen, replacing the same branch InstructionCanvas used to
 * hand-write inline in its `onDrop` closure. A tap (`wasDrag` false) is a
 * two-stage select: it selects the step if that step wasn't already
 * selected, or the token itself if it was. A real drag moves the token to
 * `target` when the drop landed somewhere valid, and does nothing when it
 * didn't (dropped over empty space, `target` null).
 *
 * `own` - where the dragged token currently sits - is what makes a drag that
 * goes nowhere fall back to the tap. Dropping a token onto its *own* slot is
 * not a move: `moveTokenCore` (state/document.ts) compares the resulting
 * token order against the old one and returns early when nothing changed, so
 * the drag did nothing at all, and the `move` branch never fell through to
 * select either. The user pressed a token and the app did nothing - the exact
 * complaint `TOUCH_DRAG_THRESHOLD` addresses from the other side. Treating an
 * own-slot drop as the tap it was meant to be is the backstop that holds at
 * any drift distance, not just below a threshold.
 *
 * Both `own.index` and `own.index + 1` count as the token's own slot: they
 * are the drop-before positions on either side of it, and `adjustIndexForRemoval`
 * maps both back to the position it already occupies.
 */
export function resolveTokenPointerOutcome(
  wasDrag: boolean,
  isSelected: boolean,
  target: TokenDropTarget | null,
  own: TokenDropTarget,
): TokenPointerOutcome {
  const tap: TokenPointerOutcome = isSelected ? { kind: "selectToken" } : { kind: "selectStep" };
  if (!wasDrag) return tap;
  if (!target) return { kind: "none" };
  if (target.stepId === own.stepId && (target.index === own.index || target.index === own.index + 1)) {
    return tap;
  }
  return { kind: "move", target };
}

/**
 * Groups chips into rendered rows. Chips that wrapped onto the same row
 * share a top exactly (every row is one uniform stride below the last - see
 * `computeRowStartYs` in lib/canvas-layout.ts), so this compares each chip's
 * vertical *center* against the row's span rather than its top against a
 * tolerance: sub-pixel differences from the canvas's viewBox scaling can
 * never split one row in two, and two real rows can never merge, since
 * they're a full chip height plus a gap apart.
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
 * The row `clientY` is nearest to, by distance to that row's own vertical
 * span (0 while inside it). Every point in the step resolves to some row -
 * there is deliberately no "outside the chips entirely" case, so hovering a
 * step's header band or the padding below its last row still previews a real
 * slot rather than nothing. The consequence, accepted when this replaced the
 * old hit-test: the far left of the header band clamps to row 0 and so reads
 * as *insert at front*, not append. The live insertion marker shows that
 * before release, which is why one uniform rule beat carving out a special
 * case for the bands around the chips.
 */
function nearestRow(clientY: number, rows: ChipRect[][]): number {
  let nearest = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (let row = 0; row < rows.length; row++) {
    const { top, bottom } = rows[row][0];
    const distance = clientY < top ? top - clientY : clientY > bottom ? clientY - bottom : 0;
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = row;
    }
  }
  return nearest;
}

/**
 * Where a drop at (`clientX`, `clientY`) lands among one step's chips: clamp
 * to the nearest row, then compare x against each chip's horizontal midpoint
 * - left half inserts before that chip, right half after it.
 *
 * This is the whole reason the chip lookup is a bounding-rect scan rather
 * than `elementFromPoint` (which is still how the *step* is found, above).
 * Hit-testing only ever reports the one element actually under the pointer,
 * so the CHIP_GAP between two chips - which has no element of its own -
 * missed every chip and fell through to the step background, where the old
 * code could only treat it as "append to the end of the step". Dropping a
 * token into the visible gap *between* two chips, the most natural way to
 * express "put it here", silently sent it to the end instead. A midpoint
 * scan has no such dead zone: every point in the step belongs to exactly one
 * slot, and the gap resolves to the boundary it straddles.
 *
 * Pure, over an array of rects, so all of that is testable without a DOM -
 * `resolveTokenDropTarget` below is the thin part that reads the rects.
 */
export function resolveDropSlot(clientX: number, clientY: number, rects: ChipRect[]): DropSlot {
  if (rects.length === 0) return { index: 0, row: 0 };
  const rows = groupIntoRows(rects);
  const row = nearestRow(clientY, rows);
  const chips = rows[row];
  for (const chip of chips) {
    if (clientX < (chip.left + chip.right) / 2) return { index: chip.index, row };
  }
  // Past the midpoint of the row's last chip: insert after it. On a full
  // row that index is also the next row's first slot - which is exactly
  // what `row` is carried along to disambiguate.
  return { index: chips[chips.length - 1].index + 1, row };
}

/**
 * Finds which step - and which slot within it - a token drag is currently
 * over. The step is hit-tested with `elementFromPoint` (which works
 * regardless of SVG transforms) against the `data-step-index` group
 * InstructionCanvas renders per step; the slot within it is then a
 * bounding-rect scan of that step's own `data-token-index` chips, via
 * `resolveDropSlot` above - see there for why the chip half can't be a
 * hit-test.
 *
 * The step is looked up by `data-step-index`, not `data-step-id`, only
 * because a chip carries its step's id too (TokenChip needs it to report
 * where the drag started): `closest("[data-step-id]")` from a point over a
 * chip would stop at the chip itself. `data-step-index` is on the step card
 * alone, so it's the unambiguous "which card is this" attribute - the same
 * one `resolveStepDropIndex` scans.
 */
export function resolveTokenDropTarget(clientX: number, clientY: number): TokenDropSlot | null {
  const el = window.document.elementFromPoint(clientX, clientY);
  const stepEl = el?.closest("[data-step-index]");
  const stepId = stepEl?.getAttribute("data-step-id");
  if (!stepEl || stepId == null) return null;

  const rects: ChipRect[] = [];
  for (const chipEl of stepEl.querySelectorAll<Element>("[data-token-index]")) {
    const index = Number(chipEl.getAttribute("data-token-index"));
    if (Number.isNaN(index)) continue;
    const { left, right, top, bottom } = chipEl.getBoundingClientRect();
    rects.push({ index, left, right, top, bottom });
  }

  return { stepId, ...resolveDropSlot(clientX, clientY, rects) };
}
