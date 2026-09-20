import { describe, it, expect } from "vitest";
import {
  createClickAfterDragGuard,
  dragThresholdFor,
  resolveDropSlot,
  resolveTokenPointerOutcome,
  MOUSE_DRAG_THRESHOLD,
  TOUCH_DRAG_THRESHOLD,
  type ChipRect,
} from "./pointer-drag";

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

// Client-coordinate stand-ins for rendered chips, laid out the way the
// canvas lays them out (lib/canvas-layout.ts): a fixed chip size, a gap
// between chips in a row, and a uniform stride between rows. The numbers
// don't have to match the canvas's design units - resolveDropSlot only ever
// compares points against the rects it's given - but keeping the same shape
// (uniform rows, a real gap between chips) is the whole point: the gap is
// where the old elementFromPoint hit-test fell through.
const CHIP_W = 96;
const CHIP_H = 68;
const GAP = 16;
const ROW_STRIDE = CHIP_H + GAP + 14;
const PER_ROW = 6;

function chipRects(count: number, perRow = PER_ROW): ChipRect[] {
  return Array.from({ length: count }, (_, index) => {
    const left = (index % perRow) * (CHIP_W + GAP);
    const top = Math.floor(index / perRow) * ROW_STRIDE;
    return { index, left, right: left + CHIP_W, top, bottom: top + CHIP_H };
  });
}

/** Vertical middle of a row, where an ordinary hover over its chips lands. */
function rowMidY(row: number): number {
  return row * ROW_STRIDE + CHIP_H / 2;
}

describe("resolveDropSlot", () => {
  it("drops at the front of a step with no chips at all", () => {
    expect(resolveDropSlot(0, 0, [])).toEqual({ index: 0, row: 0 });
    expect(resolveDropSlot(500, 300, [])).toEqual({ index: 0, row: 0 });
  });

  it("inserts before a chip on its left half and after it on its right half", () => {
    const rects = chipRects(5);
    const chip = rects[2];
    expect(resolveDropSlot(chip.left + 4, rowMidY(0), rects)).toEqual({ index: 2, row: 0 });
    expect(resolveDropSlot(chip.right - 4, rowMidY(0), rects)).toEqual({ index: 3, row: 0 });
  });

  it("resolves the gap between two chips to the boundary it sits on, not the end of the step", () => {
    const rects = chipRects(5);
    // The whole gap between chips 1 and 2 - the dead zone that used to miss
    // every chip and fall through to "append to the end of the step".
    for (const x of [rects[1].right, rects[1].right + GAP / 2, rects[2].left]) {
      expect(resolveDropSlot(x, rowMidY(0), rects)).toEqual({ index: 2, row: 0 });
    }
  });

  it("inserts at the front when the pointer is left of the first chip", () => {
    const rects = chipRects(5);
    expect(resolveDropSlot(-40, rowMidY(0), rects)).toEqual({ index: 0, row: 0 });
  });

  it("appends past the last chip of the last row", () => {
    const rects = chipRects(4);
    expect(resolveDropSlot(rects[3].right + 200, rowMidY(0), rects)).toEqual({ index: 4, row: 0 });
  });

  it("reports the same index but a different row on each side of a row boundary", () => {
    const rects = chipRects(12);
    // Past the end of row 0 and before the start of row 1 are the same
    // insertion - index 6 - drawn a row apart. Only `row` tells them apart.
    expect(resolveDropSlot(rects[5].right + 40, rowMidY(0), rects)).toEqual({ index: 6, row: 0 });
    expect(resolveDropSlot(rects[6].left - 4, rowMidY(1), rects)).toEqual({ index: 6, row: 1 });
  });

  it("scans within the hovered row, not the flat token order", () => {
    const rects = chipRects(12);
    const chip = rects[8];
    expect(resolveDropSlot(chip.left + 4, rowMidY(1), rects)).toEqual({ index: 8, row: 1 });
    expect(resolveDropSlot(chip.right - 4, rowMidY(1), rects)).toEqual({ index: 9, row: 1 });
  });

  it("clamps to the nearest row above and below the chips", () => {
    const rects = chipRects(12);
    // The step's header band, above row 0.
    expect(resolveDropSlot(rects[2].left + 4, -50, rects)).toEqual({ index: 2, row: 0 });
    // The step's bottom padding, below the last row.
    expect(resolveDropSlot(rects[11].right + 40, ROW_STRIDE * 5, rects)).toEqual({ index: 12, row: 1 });
  });

  it("clamps a point in the gap between two rows to whichever row is nearer", () => {
    const rects = chipRects(12);
    const gapTop = rects[0].bottom;
    const gapBottom = rects[6].top;
    const x = rects[1].left + 4;
    expect(resolveDropSlot(x, gapTop + 1, rects)).toEqual({ index: 1, row: 0 });
    expect(resolveDropSlot(x, gapBottom - 1, rects)).toEqual({ index: 7, row: 1 });
  });

  it("treats a single-row (mobile) layout as one row however wide it gets", () => {
    const rects = chipRects(9, 9);
    expect(resolveDropSlot(rects[7].left + 4, rowMidY(0), rects)).toEqual({ index: 7, row: 0 });
    expect(resolveDropSlot(rects[8].right + 4, rowMidY(0), rects)).toEqual({ index: 9, row: 0 });
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
