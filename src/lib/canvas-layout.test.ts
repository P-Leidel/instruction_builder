import { describe, it, expect } from "vitest";
import {
  insertionMarkerPosition,
  computeCanvasLayout,
  CHIP_WIDTH,
  CHIP_HEIGHT,
  CHIP_GAP,
  CHIP_TIME_HEADER_HEIGHT,
  HEADER_HEIGHT,
  PADDING,
  ROW_GAP,
  BASE_CANVAS_WIDTH,
  STEP_CONTROLS_WIDTH,
  STEP_CONTROL_RADIUS,
  MOVE_DOWN_CY,
  resolveDropTarget,
  resolveStepDropIndex,
  type CanvasLayout,
  type CanvasPoint,
} from "./canvas-layout";
import { createEmptyStep, createToken } from "../model/instruction";
import type { InstructionToken } from "../model/instruction";

// Desktop's fixed chips-per-row, derived the same way desktopChipsPerRow()
// does internally: floor((688 + 16) / (96 + 16)) = 6. Hardcoded here (like
// the old direct-primitive tests did) since computeCanvasLayout doesn't
// expose the raw figure - only the resulting chipsPerRow on each StepLayout,
// which every test below asserts against instead of trusting this constant.
const DESKTOP_CHIPS_PER_ROW = 6;

/**
 * Every row's own y, matching computeRowStartYs: HEADER_HEIGHT, plus the
 * unconditional CHIP_TIME_HEADER_HEIGHT band every row reserves regardless
 * of whether any of its tokens have a time, plus one (CHIP_HEIGHT + CHIP_GAP
 * + CHIP_TIME_HEADER_HEIGHT) stride per row before this one.
 */
function rowY(row: number): number {
  return HEADER_HEIGHT + CHIP_TIME_HEADER_HEIGHT + row * (CHIP_HEIGHT + CHIP_GAP + CHIP_TIME_HEADER_HEIGHT);
}

function tokens(count: number) {
  return Array.from({ length: count }, () => createToken("action", "a"));
}

/** A copy of `token` with a `time` attached - the actual seconds/iconId don't matter to canvas-layout, only that `time` is set. */
function withTime(token: InstructionToken): InstructionToken {
  return { ...token, time: { iconId: "time", label: "30m", seconds: 1800 } };
}

describe("chip positions (via computeCanvasLayout)", () => {
  it("places the first chip at the header's top-left", () => {
    const step = { ...createEmptyStep(), tokens: tokens(1) };
    const layout = computeCanvasLayout([step], true);
    expect(layout.layouts[0].chipsPerRow).toBe(DESKTOP_CHIPS_PER_ROW);
    expect(layout.layouts[0].chipPositions[0]).toEqual({ cx: 0, cy: rowY(0), col: 0, row: 0 });
  });

  it("advances columns within a row", () => {
    const step = { ...createEmptyStep(), tokens: tokens(2) };
    const layout = computeCanvasLayout([step], true);
    expect(layout.layouts[0].chipPositions[1]).toEqual({
      cx: CHIP_WIDTH + CHIP_GAP,
      cy: rowY(0),
      col: 1,
      row: 0,
    });
  });

  it("wraps to a new row after chipsPerRow columns", () => {
    const step = { ...createEmptyStep(), tokens: tokens(DESKTOP_CHIPS_PER_ROW + 1) };
    const layout = computeCanvasLayout([step], true);
    expect(layout.layouts[0].chipPositions[DESKTOP_CHIPS_PER_ROW]).toEqual({
      cx: 0,
      cy: rowY(1),
      col: 0,
      row: 1,
    });
  });
});

describe("token time labels (via computeCanvasLayout)", () => {
  it("reserves the same band above a row whether or not any of its tokens have a time", () => {
    const untimed = { ...createEmptyStep(), tokens: tokens(2) };
    const timed = {
      ...createEmptyStep(),
      tokens: [withTime(createToken("action", "a")), createToken("action", "b")],
    };
    const untimedLayout = computeCanvasLayout([untimed], true);
    const timedLayout = computeCanvasLayout([timed], true);
    // Both tokens land in row 0 (desktop fits 6/row) - every chip in the row
    // shares the same y, and that y doesn't move whether or not a token in
    // it has a time (see CHIP_TIME_HEADER_HEIGHT's comment: the reservation
    // is unconditional, exactly so this can't happen).
    expect(untimedLayout.layouts[0].chipPositions[0].cy).toBe(rowY(0));
    expect(untimedLayout.layouts[0].chipPositions[1].cy).toBe(rowY(0));
    expect(timedLayout.layouts[0].chipPositions[0].cy).toBe(rowY(0));
    expect(timedLayout.layouts[0].chipPositions[1].cy).toBe(rowY(0));
  });

  it("reserves the band for every row uniformly, not just rows with a timed token", () => {
    // 7 tokens at 6/row: only the 7th (row 1) has a time, but row 0's chips
    // (none timed) still sit at the same y as row 1's would if row 0 had
    // been timed instead - the band no longer depends on which row actually
    // has a time.
    const stepTokens = tokens(DESKTOP_CHIPS_PER_ROW + 1);
    stepTokens[DESKTOP_CHIPS_PER_ROW] = withTime(stepTokens[DESKTOP_CHIPS_PER_ROW]);
    const step = { ...createEmptyStep(), tokens: stepTokens };
    const layout = computeCanvasLayout([step], true);
    expect(layout.layouts[0].chipPositions[0].cy).toBe(rowY(0));
    expect(layout.layouts[0].chipPositions[DESKTOP_CHIPS_PER_ROW].cy).toBe(rowY(1));
  });

  it("keeps a step's own height identical whether or not one of its tokens has a time attached", () => {
    // The bug this guards against: attaching (or removing) a token's own
    // duration after a step is already placed on the canvas must not resize
    // that step - see the 2026-09-17 "tokenTime affects step size" fix.
    const untimed = computeCanvasLayout(
      [{ ...createEmptyStep(), tokens: [createToken("action", "a")] }],
      true,
    );
    const timed = computeCanvasLayout(
      [{ ...createEmptyStep(), tokens: [withTime(createToken("action", "a"))] }],
      true,
    );
    expect(timed.layouts[0].height).toBe(untimed.layouts[0].height);
  });

  it("keeps the row-wrap connector's bend anchored to the same row positions regardless of which tokens have a time", () => {
    const stepTokens = tokens(DESKTOP_CHIPS_PER_ROW + 1);
    stepTokens[DESKTOP_CHIPS_PER_ROW] = withTime(stepTokens[DESKTOP_CHIPS_PER_ROW]);
    const step = { ...createEmptyStep(), tokens: stepTokens };
    const layout = computeCanvasLayout([step], true);
    const segment = layout.layouts[0].connectors[DESKTOP_CHIPS_PER_ROW - 1];
    const fromMidY = rowY(0) + CHIP_HEIGHT / 2;
    const toMidY = rowY(1) + CHIP_HEIGHT / 2;
    const fromRightX = (DESKTOP_CHIPS_PER_ROW - 1) * (CHIP_WIDTH + CHIP_GAP) + CHIP_WIDTH;
    expect(segment.d).toContain("Q");
    expect(segment.d.startsWith(`M ${fromRightX} ${fromMidY}`)).toBe(true);
    expect(segment.d.endsWith(`L 0 ${toMidY}`)).toBe(true);
  });
});

describe("connectors (via computeCanvasLayout)", () => {
  it("draws nothing for zero or one token", () => {
    const zero = computeCanvasLayout([{ ...createEmptyStep(), tokens: tokens(0) }], true);
    const one = computeCanvasLayout([{ ...createEmptyStep(), tokens: tokens(1) }], true);
    expect(zero.layouts[0].connectors).toEqual([]);
    expect(one.layouts[0].connectors).toEqual([]);
  });

  it("draws one connector per consecutive pair", () => {
    const step = { ...createEmptyStep(), tokens: tokens(4) };
    const layout = computeCanvasLayout([step], true);
    expect(layout.layouts[0].connectors).toHaveLength(3);
  });

  it("draws a plain straight line within one row", () => {
    const step = { ...createEmptyStep(), tokens: tokens(2) };
    const layout = computeCanvasLayout([step], true);
    const [segment] = layout.layouts[0].connectors;
    const fromMidY = rowY(0) + CHIP_HEIGHT / 2;
    expect(segment.key).toBe("0-1");
    expect(segment.d).toBe(`M ${CHIP_WIDTH} ${fromMidY} L ${CHIP_WIDTH + CHIP_GAP} ${fromMidY}`);
    expect(segment.d).not.toContain("Q");
  });

  it("draws a curved bend across a row wrap", () => {
    // DESKTOP_CHIPS_PER_ROW + 1 tokens forces exactly one pair (the last of
    // row 0, the first of row 1) onto different rows.
    const step = { ...createEmptyStep(), tokens: tokens(DESKTOP_CHIPS_PER_ROW + 1) };
    const layout = computeCanvasLayout([step], true);
    const segment = layout.layouts[0].connectors[DESKTOP_CHIPS_PER_ROW - 1];
    const fromMidY = rowY(0) + CHIP_HEIGHT / 2;
    const toMidY = rowY(1) + CHIP_HEIGHT / 2;
    const fromRightX = (DESKTOP_CHIPS_PER_ROW - 1) * (CHIP_WIDTH + CHIP_GAP) + CHIP_WIDTH;
    const toLeftX = 0;
    expect(segment.d).toContain("Q");
    expect(segment.d.startsWith(`M ${fromRightX} ${fromMidY}`)).toBe(true);
    expect(segment.d.endsWith(`L ${toLeftX} ${toMidY}`)).toBe(true);
  });
});

describe("tokensOffsetX centering (via computeCanvasLayout)", () => {
  it("centers within the full available width when a step has no tokens", () => {
    const step = { ...createEmptyStep(), tokens: tokens(0) };
    const layout = computeCanvasLayout([step], true);
    expect(layout.canvasWidth).toBe(BASE_CANVAS_WIDTH + STEP_CONTROLS_WIDTH);
    expect(layout.layouts[0].tokensOffsetX).toBe(
      STEP_CONTROLS_WIDTH + (BASE_CANVAS_WIDTH - PADDING * 2) / 2,
    );
  });

  it("centers a partial row using that row's own (not the full chipsPerRow's) width", () => {
    const step = { ...createEmptyStep(), tokens: tokens(3) };
    const layout = computeCanvasLayout([step], true);
    const rowWidth = 3 * CHIP_WIDTH + 2 * CHIP_GAP;
    expect(layout.canvasWidth).toBe(BASE_CANVAS_WIDTH + STEP_CONTROLS_WIDTH);
    expect(layout.layouts[0].tokensOffsetX).toBe(
      STEP_CONTROLS_WIDTH + (BASE_CANVAS_WIDTH - PADDING * 2 - rowWidth) / 2,
    );
  });

  it("caps the centered row width at chipsPerRow even with more tokens than fit in one row", () => {
    const step = { ...createEmptyStep(), tokens: tokens(10) };
    const layout = computeCanvasLayout([step], true);
    const cappedRowWidth = DESKTOP_CHIPS_PER_ROW * CHIP_WIDTH + (DESKTOP_CHIPS_PER_ROW - 1) * CHIP_GAP;
    expect(layout.canvasWidth).toBe(BASE_CANVAS_WIDTH + STEP_CONTROLS_WIDTH);
    expect(layout.layouts[0].tokensOffsetX).toBe(
      STEP_CONTROLS_WIDTH + (BASE_CANVAS_WIDTH - PADDING * 2 - cappedRowWidth) / 2,
    );
  });
});

// A plain, no-time-band chip position, for building the chipPositions arrays
// insertionMarkerPosition reads from below - equivalent to what
// computeCanvasLayout would produce for a step with no token times set.
function plainChipPosition(index: number, chipsPerRow: number) {
  const col = index % chipsPerRow;
  const row = Math.floor(index / chipsPerRow);
  return {
    cx: col * (CHIP_WIDTH + CHIP_GAP),
    cy: HEADER_HEIGHT + row * (CHIP_HEIGHT + CHIP_GAP),
    col,
    row,
  };
}

describe("insertionMarkerPosition", () => {
  it("returns the empty-step default when there are no existing chips, matching row 0's real position", () => {
    expect(insertionMarkerPosition({ index: 0, row: 0 }, [], 6)).toEqual({ cx: 0, cy: rowY(0), col: 0, row: 0 });
  });

  it("reads the target chip's own position straight off chipPositions in the ordinary case", () => {
    const chipPositions = Array.from({ length: 5 }, (_, i) => plainChipPosition(i, 6));
    expect(insertionMarkerPosition({ index: 2, row: 0 }, chipPositions, 6)).toBe(chipPositions[2]);
  });

  it("appends just past the last chip of an exactly-full row, instead of starting a phantom new row", () => {
    const chipPositions = Array.from({ length: 6 }, (_, i) => plainChipPosition(i, 6));
    const last = chipPositions[5];
    expect(insertionMarkerPosition({ index: 6, row: 0 }, chipPositions, 6)).toEqual({ ...last, cx: last.cx + CHIP_WIDTH });
  });

  it("starts a real new row when the last row isn't full", () => {
    // 7 tokens at 6/row leaves the second row with only 1 chip - dropping at
    // the end (index 7) is a genuine new row, not the exactly-full case above.
    const chipPositions = Array.from({ length: 7 }, (_, i) => plainChipPosition(i, 6));
    expect(insertionMarkerPosition({ index: 7, row: 1 }, chipPositions, 6)).toEqual({
      cx: CHIP_WIDTH + CHIP_GAP,
      cy: HEADER_HEIGHT + (CHIP_HEIGHT + CHIP_GAP),
      col: 1,
      row: 1,
    });
  });

  // One drop index, two places to draw it: index 6 on a 6-per-row layout is
  // both the end of row 0 and the start of row 1. The hovered row is the
  // only thing that distinguishes them, so both directions are asserted
  // against the same index.
  it("draws at the end of the hovered row when the drop index sits on a row boundary", () => {
    const chipPositions = Array.from({ length: 12 }, (_, i) => plainChipPosition(i, 6));
    const lastInRow = chipPositions[5];
    expect(insertionMarkerPosition({ index: 6, row: 0 }, chipPositions, 6)).toEqual({
      ...lastInRow,
      cx: lastInRow.cx + CHIP_WIDTH,
    });
  });

  it("draws at the start of the next row for that same index when the pointer is in that row", () => {
    const chipPositions = Array.from({ length: 12 }, (_, i) => plainChipPosition(i, 6));
    expect(insertionMarkerPosition({ index: 6, row: 1 }, chipPositions, 6)).toBe(chipPositions[6]);
  });

  it("applies the same rule at a later row boundary", () => {
    const chipPositions = Array.from({ length: 18 }, (_, i) => plainChipPosition(i, 6));
    const lastInRow = chipPositions[11];
    expect(insertionMarkerPosition({ index: 12, row: 1 }, chipPositions, 6)).toEqual({
      ...lastInRow,
      cx: lastInRow.cx + CHIP_WIDTH,
    });
    expect(insertionMarkerPosition({ index: 12, row: 2 }, chipPositions, 6)).toBe(chipPositions[12]);
  });
});

describe("computeCanvasLayout", () => {
  it("returns an empty layout for no steps", () => {
    const layout = computeCanvasLayout([], true);
    expect(layout.layouts).toEqual([]);
    expect(layout.totalHeight).toBe(PADDING * 2);
    expect(layout.canvasWidth).toBe(BASE_CANVAS_WIDTH + STEP_CONTROLS_WIDTH);
    expect(layout.addStepRowY).toBe(PADDING);
  });

  it("produces one layout entry per step, in order", () => {
    const steps = [createEmptyStep(), createEmptyStep(), createEmptyStep()];
    const layout = computeCanvasLayout(steps, true);
    expect(layout.layouts.map((l) => l.step.id)).toEqual(steps.map((s) => s.id));
  });

  it("grows an empty step's height so its reorder stack (drag handle + move up/down) always fits", () => {
    const layout = computeCanvasLayout([{ ...createEmptyStep(), tokens: [] }], true);
    // Matches canvas-layout.ts's own MIN_HEIGHT_FOR_CONTROLS derivation -
    // MOVE_DOWN_CY + STEP_CONTROL_RADIUS + PADDING - via the constants it
    // exports, rather than duplicating a hardcoded number here.
    expect(layout.layouts[0].height).toBe(MOVE_DOWN_CY + STEP_CONTROL_RADIUS + PADDING);
  });

  it("positions the add-step row just past the last step, with the usual ROW_GAP before it", () => {
    const step = { ...createEmptyStep(), tokens: [createToken("action", "a")] };
    const layout = computeCanvasLayout([step], true);
    expect(layout.addStepRowY).toBe(layout.layouts[0].cardY + layout.layouts[0].height + ROW_GAP);
  });

  it("stacks steps without overlap", () => {
    const steps = [
      { ...createEmptyStep(), tokens: [createToken("action", "a")] },
      { ...createEmptyStep(), tokens: [createToken("action", "b")] },
    ];
    const [first, second] = computeCanvasLayout(steps, true).layouts;
    expect(second.cardY).toBeGreaterThanOrEqual(first.cardY + first.height);
  });

  it("flags an empty step as incomplete, mirroring model/validate.ts", () => {
    const layout = computeCanvasLayout([createEmptyStep()], true);
    expect(layout.layouts[0].isComplete).toBe(false);
  });

  it("defers the persistent incomplete flag for an empty step, but not once it has a token", () => {
    // shouldFlagIncomplete (2026-09-17 audit remediation, finding 5/item 10)
    // mirrors model/validate.ts's shouldFlagIncompleteStep, called here where
    // computeCanvasLayout already has the full validation result - a brand
    // new step is `isComplete: false` but shouldn't flag itself before the
    // user has added anything.
    const empty = computeCanvasLayout([createEmptyStep()], true);
    expect(empty.layouts[0].isComplete).toBe(false);
    expect(empty.layouts[0].shouldFlagIncomplete).toBe(false);

    const stepWithNoAction = { ...createEmptyStep(), tokens: [createToken("object", "onion")] };
    const withToken = computeCanvasLayout([stepWithNoAction], true);
    expect(withToken.layouts[0].isComplete).toBe(false);
    expect(withToken.layouts[0].shouldFlagIncomplete).toBe(true);
  });

  it("gives every step in the document one chip per row on mobile", () => {
    const step = {
      ...createEmptyStep(),
      tokens: [createToken("action", "a"), createToken("action", "b")],
    };
    const layout = computeCanvasLayout([step], false);
    expect(layout.layouts[0].chipsPerRow).toBe(step.tokens.length);
  });

  it("has no displayed time for a step with no time", () => {
    const layout = computeCanvasLayout([createEmptyStep()], true);
    expect(layout.layouts[0].displayedTime).toBeUndefined();
  });

  it("widens the canvas to fit a wider-than-base row of tokens", () => {
    // Enough tokens on mobile (one chip per row = tokens.length columns) to
    // exceed BASE_CANVAS_WIDTH's content area.
    const manyTokens = Array.from({ length: 10 }, () => createToken("action", "a"));
    const layout = computeCanvasLayout([{ ...createEmptyStep(), tokens: manyTokens }], false);
    expect(layout.canvasWidth).toBeGreaterThan(BASE_CANVAS_WIDTH);
  });

  it("gives every step one chip position per token, in token order", () => {
    const step = { ...createEmptyStep(), tokens: tokens(3) };
    const layout = computeCanvasLayout([step], true);
    expect(layout.layouts[0].chipPositions).toHaveLength(3);
  });
});

// Every test below drives resolveDropTarget/resolveStepDropIndex with a real
// computeCanvasLayout result, and derives the points it probes from that same
// result - never from a hand-built fixture of "roughly canvas-shaped" rects.
// That is the point: the predecessor of these functions measured the rendered
// DOM, so its tests had to invent a second, parallel model of chip geometry,
// and the two were free to drift (they had). Here the only way to know where
// a chip is, is to ask the layout - which is exactly what the resolver does.

/**
 * A chip's extent in canvas design units, read back out of the layout the
 * same way StepCard's nested transforms compose it: card at (PADDING,
 * cardY), token group at (tokensOffsetX, 0), chip at (cx, cy).
 */
function chipBox(layout: CanvasLayout, stepIndex: number, tokenIndex: number) {
  const step = layout.layouts[stepIndex];
  const { cx, cy } = step.chipPositions[tokenIndex];
  const left = PADDING + step.tokensOffsetX + cx;
  const top = step.cardY + cy;
  return { left, right: left + CHIP_WIDTH, top, bottom: top + CHIP_HEIGHT };
}

/** The middle of a chip - where an ordinary hover over it lands. */
function chipCenter(layout: CanvasLayout, stepIndex: number, tokenIndex: number): CanvasPoint {
  const box = chipBox(layout, stepIndex, tokenIndex);
  return { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 };
}

function layoutOf(tokenCounts: number[], isDesktop = true): CanvasLayout {
  return computeCanvasLayout(
    tokenCounts.map((count) => ({ ...createEmptyStep(), tokens: tokens(count) })),
    isDesktop,
  );
}

describe("resolveDropTarget", () => {
  it("resolves nothing above the first step, below the last, and in the gap between two", () => {
    const layout = layoutOf([3, 3]);
    const x = chipCenter(layout, 0, 0).x;
    const first = layout.layouts[0];
    const second = layout.layouts[1];

    expect(resolveDropTarget({ x, y: first.cardY - 1 }, layout)).toBeNull();
    expect(resolveDropTarget({ x, y: first.cardY + first.height }, layout)).toBeNull();
    expect(resolveDropTarget({ x, y: second.cardY + second.height + 1 }, layout)).toBeNull();
  });

  it("resolves nothing beside the canvas, however well the y lines up with a step", () => {
    // The case a bounding-rect scan got for free and a coordinate transform
    // has to state: a pointer over a side panel converts to a canvas point
    // whose y is squarely inside a step card.
    const layout = layoutOf([3]);
    const y = chipCenter(layout, 0, 0).y;
    expect(resolveDropTarget({ x: PADDING - 1, y }, layout)).toBeNull();
    expect(resolveDropTarget({ x: layout.canvasWidth - PADDING, y }, layout)).toBeNull();
    expect(resolveDropTarget({ x: PADDING, y }, layout)).not.toBeNull();
  });

  it("names the step the point is actually in", () => {
    const layout = layoutOf([2, 2, 2]);
    for (const stepIndex of [0, 1, 2]) {
      expect(resolveDropTarget(chipCenter(layout, stepIndex, 0), layout)?.stepId).toBe(
        layout.layouts[stepIndex].step.id,
      );
    }
  });

  it("drops at the front of a step with no tokens at all", () => {
    const layout = layoutOf([0]);
    const step = layout.layouts[0];
    const point = { x: layout.canvasWidth / 2, y: step.cardY + step.height / 2 };
    expect(resolveDropTarget(point, layout)).toEqual({ stepId: step.step.id, index: 0, row: 0 });
  });

  it("inserts before a chip on its left half and after it on its right half", () => {
    const layout = layoutOf([5]);
    const box = chipBox(layout, 0, 2);
    const y = chipCenter(layout, 0, 2).y;
    expect(resolveDropTarget({ x: box.left + 4, y }, layout)).toMatchObject({ index: 2, row: 0 });
    expect(resolveDropTarget({ x: box.right - 4, y }, layout)).toMatchObject({ index: 3, row: 0 });
  });

  it("resolves the gap between two chips to the boundary it sits on, not the end of the step", () => {
    // The gap belongs to no chip, which is why this was never a hit-test.
    const layout = layoutOf([5]);
    const before = chipBox(layout, 0, 1);
    const after = chipBox(layout, 0, 2);
    const y = chipCenter(layout, 0, 1).y;
    for (const x of [before.right, (before.right + after.left) / 2, after.left]) {
      expect(resolveDropTarget({ x, y }, layout)).toMatchObject({ index: 2, row: 0 });
    }
  });

  it("inserts at the front left of the first chip and appends past the last", () => {
    const layout = layoutOf([4]);
    const y = chipCenter(layout, 0, 0).y;
    expect(resolveDropTarget({ x: PADDING, y }, layout)).toMatchObject({ index: 0, row: 0 });
    expect(
      resolveDropTarget({ x: layout.canvasWidth - PADDING - 1, y }, layout),
    ).toMatchObject({ index: 4, row: 0 });
  });

  it("reports the same index but a different row on each side of a row boundary", () => {
    // Index 6 is both "after the last chip of row 0" and "before the first
    // chip of row 1" - the same insertion, a row apart on screen. Only `row`
    // tells them apart, and insertionMarkerPosition needs it to.
    const layout = layoutOf([12]);
    const endOfRow0 = chipBox(layout, 0, 5);
    const startOfRow1 = chipBox(layout, 0, 6);
    expect(
      resolveDropTarget({ x: endOfRow0.right + 4, y: chipCenter(layout, 0, 5).y }, layout),
    ).toMatchObject({ index: 6, row: 0 });
    expect(
      resolveDropTarget({ x: startOfRow1.left - 4, y: chipCenter(layout, 0, 6).y }, layout),
    ).toMatchObject({ index: 6, row: 1 });
  });

  it("scans within the hovered row, not the flat token order", () => {
    const layout = layoutOf([12]);
    const box = chipBox(layout, 0, 8);
    const y = chipCenter(layout, 0, 8).y;
    expect(resolveDropTarget({ x: box.left + 4, y }, layout)).toMatchObject({ index: 8, row: 1 });
    expect(resolveDropTarget({ x: box.right - 4, y }, layout)).toMatchObject({ index: 9, row: 1 });
  });

  it("clamps the header band and the bottom padding to the nearest row", () => {
    // Deliberately no "inside the step but outside the chips" case: every
    // point in a card previews a real slot. The accepted consequence is that
    // the far left of the header band reads as insert-at-front.
    const layout = layoutOf([12]);
    const step = layout.layouts[0];
    const box = chipBox(layout, 0, 2);
    expect(resolveDropTarget({ x: box.left + 4, y: step.cardY + 1 }, layout)).toMatchObject({
      index: 2,
      row: 0,
    });
    expect(
      resolveDropTarget(
        { x: layout.canvasWidth - PADDING - 1, y: step.cardY + step.height - 1 },
        layout,
      ),
    ).toMatchObject({ index: 12, row: 1 });
  });

  it("splits the gap between two rows down its middle", () => {
    // Pins the resolver's rows to the rendered rows in absolute terms, not
    // just relative ones: a mutation that shifted every chip rect by the
    // same amount (say, by re-measuring the chip group including its time
    // band) leaves every within-row and between-row comparison intact and is
    // caught only here, where the boundary itself has moved.
    const layout = layoutOf([12]);
    const above = chipBox(layout, 0, 1);
    const below = chipBox(layout, 0, 7);
    const x = above.left + 4;
    const middle = (above.bottom + below.top) / 2;
    expect(resolveDropTarget({ x, y: middle }, layout)).toMatchObject({ index: 1, row: 0 });
    expect(resolveDropTarget({ x, y: middle + 1 }, layout)).toMatchObject({ index: 7, row: 1 });
  });

  it("treats a mobile single-row step as one row however wide it gets", () => {
    const layout = layoutOf([9], false);
    expect(layout.layouts[0].chipsPerRow).toBe(9);
    const box = chipBox(layout, 0, 7);
    const y = chipCenter(layout, 0, 7).y;
    expect(resolveDropTarget({ x: box.left + 4, y }, layout)).toMatchObject({ index: 7, row: 0 });
    expect(resolveDropTarget({ x: box.right + 4, y }, layout)).toMatchObject({ index: 8, row: 0 });
  });

  // The regression this whole change exists to make impossible. The DOM scan
  // this replaced measured each chip's wrapping <g>, which also contains the
  // token-time label drawn above the chip - so a timed chip reported a box
  // CHIP_TIME_HEADER_HEIGHT taller than an untimed one and, sorting first,
  // pulled its whole row's span up with it. Probed before this change: with
  // the first chip of row 1 timed, a 7-unit band in the gap between the rows
  // resolved to row 1 index 7 where the untimed document resolved to row 0
  // index 1 - a whole row and six slots apart, decided by whether a token
  // happened to have a duration attached.
  it("gives a timed chip exactly the same hit box as an untimed one", () => {
    const plain = tokens(12);
    const timed = plain.map((token, index) => (index === 6 ? withTime(token) : token));
    const withoutTime = computeCanvasLayout([{ ...createEmptyStep(), tokens: plain }], true);
    const withTimed = computeCanvasLayout([{ ...createEmptyStep(), tokens: timed }], true);

    expect(chipBox(withTimed, 0, 6)).toEqual(chipBox(withoutTime, 0, 6));

    const x = chipBox(withoutTime, 0, 1).left + 4;
    const from = chipBox(withoutTime, 0, 0).bottom;
    const to = chipBox(withoutTime, 0, 6).top;
    for (let y = from; y <= to; y++) {
      expect({ y, ...resolveDropTarget({ x, y }, withTimed) }).toMatchObject({
        y,
        ...resolveDropTarget({ x, y }, withoutTime),
        stepId: withTimed.layouts[0].step.id,
      });
    }
  });

  it("never resolves an index outside [0, tokens.length]", () => {
    // StepCard used to clamp this by hand. The guarantee is now structural,
    // so the clamp is gone - this is what holds it up instead.
    const layout = layoutOf([7]);
    const step = layout.layouts[0];
    const indices: number[] = [];
    for (let x = PADDING; x < layout.canvasWidth - PADDING; x += 7) {
      for (let y = step.cardY; y < step.cardY + step.height; y += 5) {
        const slot = resolveDropTarget({ x, y }, layout);
        indices.push(slot ? slot.index : NaN);
      }
    }
    expect(Math.min(...indices)).toBe(0);
    expect(Math.max(...indices)).toBe(7);
  });
});

describe("resolveStepDropIndex", () => {
  it("lands before a step while above its midpoint and after it below", () => {
    const layout = layoutOf([2, 2, 2]);
    const second = layout.layouts[1];
    const x = layout.canvasWidth / 2;
    expect(resolveStepDropIndex({ x, y: second.cardY + second.height / 2 - 1 }, layout)).toBe(1);
    expect(resolveStepDropIndex({ x, y: second.cardY + second.height / 2 + 1 }, layout)).toBe(2);
  });

  it("lands at the front above the first step and at the end below the last", () => {
    const layout = layoutOf([2, 2, 2]);
    const x = layout.canvasWidth / 2;
    const last = layout.layouts[2];
    expect(resolveStepDropIndex({ x, y: 0 }, layout)).toBe(0);
    expect(resolveStepDropIndex({ x, y: last.cardY + last.height + 500 }, layout)).toBe(3);
  });

  it("ignores x entirely - a step is a flat vertical list", () => {
    const layout = layoutOf([2, 2, 2]);
    const y = layout.layouts[1].cardY + 1;
    expect(resolveStepDropIndex({ x: -9999, y }, layout)).toBe(
      resolveStepDropIndex({ x: 9999, y }, layout),
    );
  });

  it("resolves against steps of differing heights, not a uniform stride", () => {
    // A one-row step and a two-row step have different heights, so the
    // midpoints are not evenly spaced - the reason this reads cardY/height
    // per step rather than dividing the canvas up.
    const layout = layoutOf([1, 12, 1]);
    const tall = layout.layouts[1];
    const x = layout.canvasWidth / 2;
    expect(resolveStepDropIndex({ x, y: tall.cardY + 1 }, layout)).toBe(1);
    expect(resolveStepDropIndex({ x, y: tall.cardY + tall.height - 1 }, layout)).toBe(2);
  });
});
