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

export interface DragHandlers {
  /** Called on every pointermove once the drag has passed `threshold`. */
  onMove?: (clientX: number, clientY: number) => void;
  /**
   * Called on pointerup/pointercancel. `wasDrag` is false when the pointer
   * never moved past `threshold` - callers use that to fall back to their
   * normal click/tap behavior instead of a drop.
   */
  onDrop: (clientX: number, clientY: number, wasDrag: boolean) => void;
  /** Pixels of movement before this counts as a drag. Default 6. */
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
  const threshold = handlers.threshold ?? 6;
  let moved = false;
  // A trackpad/high-polling-rate mouse can fire several pointermove events
  // per animation frame; each one otherwise triggered a synchronous
  // elementFromPoint hit-test (resolveTokenDropTarget) and a signal write
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

  function onPointerCancel(e: PointerEvent) {
    cleanup();
    handlers.onDrop(e.clientX, e.clientY, false);
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
 * InstructionCanvas's step-reorder drag handle. Bounding-rect-based (not
 * elementFromPoint, unlike resolveTokenDropTarget below) since step
 * reordering only ever needs a position relative to a flat, fully-visible
 * list of steps, including landing past the last one - elementFromPoint
 * can't report a slot when the pointer is over empty canvas space below the
 * last step, but a bounding-rect scan naturally falls through to
 * `items.length` there.
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
  /** Insertion index within the target step's tokens; Infinity means "append". */
  index: number;
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

/**
 * Hit-tests the point under the pointer (via `elementFromPoint`, which
 * works regardless of SVG transforms) against `data-step-id`/
 * `data-token-index` attributes rendered by InstructionCanvas, to find
 * which step - and, if the pointer is over an existing chip, which
 * position within it - a token drag is currently over.
 */
export function resolveTokenDropTarget(clientX: number, clientY: number): TokenDropTarget | null {
  const el = window.document.elementFromPoint(clientX, clientY);
  if (!el) return null;

  const chipEl = el.closest("[data-token-index]");
  if (chipEl) {
    const stepId = chipEl.getAttribute("data-step-id");
    const index = Number(chipEl.getAttribute("data-token-index"));
    if (stepId !== null && !Number.isNaN(index)) return { stepId, index };
  }

  const stepEl = el.closest("[data-step-id]");
  if (stepEl) {
    const stepId = stepEl.getAttribute("data-step-id");
    if (stepId !== null) return { stepId, index: Number.POSITIVE_INFINITY };
  }

  return null;
}
