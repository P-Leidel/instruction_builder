import { describe, it, expect, afterEach } from "vitest";
import {
  beginPointerDrag,
  createClickAfterDragGuard,
  dragThresholdFor,
  resolveTokenPointerOutcome,
  MOUSE_DRAG_THRESHOLD,
  TOUCH_DRAG_THRESHOLD,
} from "./pointer-drag";

// beginPointerDrag needs an element to capture the pointer on and a frame
// scheduler, and nothing else - no layout, no rendering, no document. Both
// are stubbed here rather than reaching for a DOM environment (ADR 0003):
// what these tests are about is *when* the handlers fire relative to the
// frame clock, which is this module's own logic, not the browser's.
function pointerTarget() {
  const listeners = new Map<string, EventListener>();
  return {
    element: {
      setPointerCapture() {},
      addEventListener(type: string, fn: EventListener) {
        listeners.set(type, fn);
      },
      removeEventListener(type: string) {
        listeners.delete(type);
      },
    } as unknown as Element,
    fire(type: string, clientX: number, clientY: number) {
      listeners.get(type)?.({ clientX, clientY, pointerId: 1 } as unknown as Event);
    },
    get listenerCount() {
      return listeners.size;
    },
  };
}

/** Frames only run when a test says so, so "released before the next frame" is expressible. */
function manualFrames() {
  const pending: Array<() => void> = [];
  const globals = globalThis as unknown as {
    requestAnimationFrame: (fn: () => void) => number;
    cancelAnimationFrame: (id: number) => void;
  };
  globals.requestAnimationFrame = (fn) => pending.push(fn);
  globals.cancelAnimationFrame = () => {};
  return {
    paint() {
      pending.shift()?.();
    },
  };
}

afterEach(() => {
  const globals = globalThis as unknown as Record<string, unknown>;
  delete globals.requestAnimationFrame;
  delete globals.cancelAnimationFrame;
});

describe("beginPointerDrag", () => {
  function startDrag(threshold?: number) {
    const target = pointerTarget();
    const moves: Array<[number, number]> = [];
    const drops: Array<[number, number, boolean]> = [];
    let cancels = 0;
    beginPointerDrag(
      {
        clientX: 0,
        clientY: 0,
        pointerId: 1,
        pointerType: "mouse",
        currentTarget: target.element,
      } as unknown as PointerEvent,
      {
        onMove: (x, y) => moves.push([x, y]),
        onDrop: (x, y, wasDrag) => drops.push([x, y, wasDrag]),
        onCancel: () => (cancels += 1),
        threshold,
      },
    );
    return { target, moves, drops, cancels: () => cancels };
  }

  it("reports a press that never passed the threshold as a tap, with no move at all", () => {
    manualFrames();
    const { target, moves, drops } = startDrag();
    target.fire("pointermove", 2, 2);
    target.fire("pointerup", 2, 2);
    expect(moves).toEqual([]);
    expect(drops).toEqual([[2, 2, false]]);
  });

  it("coalesces several moves within one frame into the last position seen", () => {
    const frames = manualFrames();
    const { target, moves } = startDrag();
    target.fire("pointermove", 40, 40);
    target.fire("pointermove", 60, 60);
    target.fire("pointermove", 80, 80);
    expect(moves).toEqual([]);
    frames.paint();
    expect(moves).toEqual([[80, 80]]);
  });

  // The two halves of "the preview and the commit are one resolution". Both
  // were reproduced by probe before the final flush below existed: without
  // it, a caller that commits its stored preview would commit a stale slot,
  // or none at all.
  it("previews the release point before dropping, even when no frame ever painted", () => {
    manualFrames();
    const { target, moves, drops } = startDrag();
    target.fire("pointermove", 40, 40);
    target.fire("pointerup", 40, 40);
    expect(moves).toEqual([[40, 40]]);
    expect(drops).toEqual([[40, 40, true]]);
  });

  it("previews the release point when the pointer travelled past the last painted frame", () => {
    const frames = manualFrames();
    const { target, moves, drops } = startDrag();
    target.fire("pointermove", 40, 40);
    frames.paint();
    target.fire("pointermove", 400, 400);
    target.fire("pointerup", 400, 400);
    expect(moves).toEqual([
      [40, 40],
      [400, 400],
    ]);
    expect(drops).toEqual([[400, 400, true]]);
  });

  it("does not preview a release that was only ever a tap", () => {
    manualFrames();
    const { target, moves, drops } = startDrag();
    target.fire("pointerup", 1, 1);
    expect(moves).toEqual([]);
    expect(drops).toEqual([[1, 1, false]]);
  });

  it("cancels without dropping, and without a farewell preview", () => {
    const frames = manualFrames();
    const drag = startDrag();
    drag.target.fire("pointermove", 40, 40);
    frames.paint();
    drag.target.fire("pointercancel", 40, 40);
    expect(drag.drops).toEqual([]);
    expect(drag.cancels()).toBe(1);
    expect(drag.moves).toEqual([[40, 40]]);
  });

  it("stops listening once the drag ends, either way", () => {
    manualFrames();
    const dropped = startDrag();
    dropped.target.fire("pointerup", 1, 1);
    expect(dropped.target.listenerCount).toBe(0);

    const cancelled = startDrag();
    cancelled.target.fire("pointercancel", 1, 1);
    expect(cancelled.target.listenerCount).toBe(0);
  });
});

describe("createClickAfterDragGuard", () => {
  it("starts as not-just-dragged", () => {
    const guard = createClickAfterDragGuard();
    expect(guard.wasJustDragged()).toBe(false);
  });

  it("reports true exactly once after markDragged, then resets", () => {
    const guard = createClickAfterDragGuard();
    guard.markDragged();
    expect(guard.wasJustDragged()).toBe(true);
    expect(guard.wasJustDragged()).toBe(false);
  });

  it("is independent per instance", () => {
    const a = createClickAfterDragGuard();
    const b = createClickAfterDragGuard();
    a.markDragged();
    expect(a.wasJustDragged()).toBe(true);
    expect(b.wasJustDragged()).toBe(false);
  });
});

describe("dragThresholdFor", () => {
  it("gives touch a higher bar than mouse or pen", () => {
    expect(dragThresholdFor("touch")).toBe(TOUCH_DRAG_THRESHOLD);
    expect(dragThresholdFor("mouse")).toBe(MOUSE_DRAG_THRESHOLD);
    expect(dragThresholdFor("pen")).toBe(MOUSE_DRAG_THRESHOLD);
    expect(TOUCH_DRAG_THRESHOLD).toBeGreaterThan(MOUSE_DRAG_THRESHOLD);
  });

  it("falls back to the mouse threshold for an unknown pointer type", () => {
    expect(dragThresholdFor("")).toBe(MOUSE_DRAG_THRESHOLD);
  });
});

describe("resolveTokenPointerOutcome", () => {
  const own = { stepId: "s1", index: 3 };

  it("selects the step on a tap when its step wasn't already selected", () => {
    expect(resolveTokenPointerOutcome(false, false, null, own)).toEqual({ kind: "selectStep" });
  });

  it("selects the token on a tap when its step was already selected", () => {
    expect(resolveTokenPointerOutcome(false, true, null, own)).toEqual({ kind: "selectToken" });
  });

  it("moves the token on a drag that lands on a valid target", () => {
    const target = { stepId: "s1", index: 6 };
    expect(resolveTokenPointerOutcome(true, true, target, own)).toEqual({ kind: "move", target });
    expect(resolveTokenPointerOutcome(true, false, target, own)).toEqual({ kind: "move", target });
  });

  it("does nothing on a drag that ends over no valid target", () => {
    expect(resolveTokenPointerOutcome(true, true, null, own)).toEqual({ kind: "none" });
    expect(resolveTokenPointerOutcome(true, false, null, own)).toEqual({ kind: "none" });
  });

  it("falls back to the tap when a drag ends on the token's own slot", () => {
    // Both sides of the token are its own position: dropping before it and
    // dropping after it both leave the order untouched, so neither is a move.
    for (const index of [own.index, own.index + 1]) {
      expect(resolveTokenPointerOutcome(true, false, { stepId: "s1", index }, own)).toEqual({
        kind: "selectStep",
      });
      expect(resolveTokenPointerOutcome(true, true, { stepId: "s1", index }, own)).toEqual({
        kind: "selectToken",
      });
    }
  });

  it("still moves for the slots immediately outside the token's own", () => {
    expect(resolveTokenPointerOutcome(true, true, { stepId: "s1", index: 2 }, own)).toEqual({
      kind: "move",
      target: { stepId: "s1", index: 2 },
    });
    expect(resolveTokenPointerOutcome(true, true, { stepId: "s1", index: 5 }, own)).toEqual({
      kind: "move",
      target: { stepId: "s1", index: 5 },
    });
  });

  it("moves for the same index in a different step", () => {
    const target = { stepId: "s2", index: own.index };
    expect(resolveTokenPointerOutcome(true, true, target, own)).toEqual({ kind: "move", target });
  });
});
