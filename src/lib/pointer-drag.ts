import type { CanvasPoint, TokenDropTarget } from "./canvas-layout";

/**
 * Phase 2 task 9 (Drag-and-Drop) / task 10 (Touch Support): a small,
 * framework-agnostic Pointer Events drag tracker, shared by TokenPicker and
 * InstructionCanvas (which uses it for both token drag and, since the
 * standalone StepList panel was folded into the canvas, step-reorder drag
 * too). Pointer Events (rather than the HTML5
 * Drag-and-Drop API) unify mouse/touch/pen input into one code path per the
 * plan's task 9 note - task 10 is largely "verify this works on touch,"
 * not a separate implementation.
 *
 * This is the browser-facing half of dragging, and since the 2026-09-20
 * candidate 1 change it is the *only* half: working out where a drop lands
 * is pure geometry over a CanvasLayout and lives in lib/canvas-layout.ts
 * (`resolveDropTarget`/`resolveStepDropIndex`). The one thing that still has
 * to ask the DOM a question is `clientToCanvasPoint` at the bottom of this
 * file - a pointer event speaks client pixels, the layout speaks design
 * units, and only the rendered `<svg>` knows the matrix between them.
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
   *
   * A token drag's caller does *not* re-resolve these coordinates: `onMove`
   * has just run one final time at exactly this point (see `onPointerUp`),
   * so the drop the caller commits is the slot its own preview last stored.
   * The coordinates are still passed because the step-reorder drag, which
   * keeps no preview of its own, resolves its index here and nowhere else.
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
  // layout read (the old DOM hit-test and per-chip rect scan) and a signal write
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
    // One last onMove, synchronously, at the exact point of release - so the
    // preview a caller has stored (the insertion marker's slot) is the one
    // for these coordinates, and committing it in onDrop commits what the
    // user was actually shown. Without this, the rAF coalescing above leaves
    // two real gaps, both reproduced by probe before this was written:
    // a drag released before its first frame ever painted called onDrop with
    // no onMove at all (nothing previewed, yet a drop to commit), and a drag
    // that travelled on after its last painted frame committed a point the
    // preview never saw. Cheap because onMove is a pure resolve plus a
    // change-guarded signal write (state/drag.ts), and it runs once per drop.
    if (moved) {
      latestX = e.clientX;
      latestY = e.clientY;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      flush();
    }
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
 * A real drag ends with a `pointerup` that also fires the browser's
 * compatibility `click` event right after - needed for keyboard/simple-tap
 * activation, but not wanted a second time when `onDrop` already handled the
 * drop. Call `markDragged()` from `onDrop` when `wasDrag` is true, and check
 * `wasJustDragged()` at the top of the element's own `onClick` to swallow
 * that one synthetic click. Plain module-scope state (not a hook) to match
 * `beginPointerDrag` above - callers that need one of these keep exactly one
 * instance for their component's lifetime, same as the `let` this replaces.
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
 * A pointer event's client coordinates, in the canvas's own design units -
 * one of the two DOM reads the whole drag path still makes, and the reason
 * it is a one-liner rather than a scan: `getScreenCTM()` on the rendered `<svg>`
 * already composes the viewBox scale, every CSS transform on the way up,
 * and the page's scroll position into a single matrix, so inverting it maps
 * a screen point straight into the coordinate space `CanvasLayout` is
 * written in. That replaces `elementFromPoint` plus one
 * `getBoundingClientRect()` per chip with one matrix per resolution.
 *
 * Returns null when the element has no current transform matrix, which is
 * what an SVG that is not rendered (detached, or inside `display: none`)
 * reports - callers treat that the same as "the pointer is over nothing".
 *
 * Deliberately has no unit test: it needs a real element with a real matrix,
 * and this project has no DOM test environment (see
 * docs/adr/0003-no-component-test-environment.md). Coordinate conversion is
 * the browser's job, so verifying it belongs to the Playwright driver -
 * specifically a drag after scrolling, one at the mobile breakpoint, and one
 * at non-default browser zoom, since those are exactly the cases a matrix
 * has to handle that a client rect handled for free.
 */
export function clientToCanvasPoint(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): CanvasPoint | null {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;
  const { x, y } = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
  return { x, y };
}


/**
 * Whether a client point is inside `viewport`'s *visible* area - its client
 * box, which is the padding box minus any scrollbar gutters.
 *
 * Needed because `clientToCanvasPoint` above is pure matrix arithmetic and
 * knows nothing about clipping. At the mobile breakpoint the canvas `<svg>`
 * is held at its 480px floor inside a narrower card, so the card scrolls and
 * a wide strip of the `<svg>` is clipped out of sight. The CTM still maps a
 * client point over that strip - which is page background, not canvas - onto
 * a perfectly valid canvas point inside a step. Hit-testing the element under
 * the pointer used to reject those points for free; resolving against the
 * layout has to reject them on purpose.
 *
 * `getBoundingClientRect()` plus `clientLeft`/`clientTop` rather than the
 * rect alone: the rect is the *border* box, and the border is not a place a
 * drop can land. Scroll position needs no handling here - a scroll moves the
 * content inside this box, never the box itself, which is exactly why the
 * same check holds while the card is scrolled.
 */
export function isInsideViewport(
  viewport: Element,
  clientX: number,
  clientY: number,
): boolean {
  const rect = viewport.getBoundingClientRect();
  const left = rect.left + viewport.clientLeft;
  const top = rect.top + viewport.clientTop;
  return (
    clientX >= left &&
    clientX < left + viewport.clientWidth &&
    clientY >= top &&
    clientY < top + viewport.clientHeight
  );
}
