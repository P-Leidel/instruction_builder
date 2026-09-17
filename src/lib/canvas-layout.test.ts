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
    expect(insertionMarkerPosition(0, [], 6)).toEqual({ cx: 0, cy: rowY(0), col: 0, row: 0 });
  });

  it("reads the target chip's own position straight off chipPositions in the ordinary case", () => {
    const chipPositions = Array.from({ length: 5 }, (_, i) => plainChipPosition(i, 6));
    expect(insertionMarkerPosition(2, chipPositions, 6)).toBe(chipPositions[2]);
  });

  it("appends just past the last chip of an exactly-full row, instead of starting a phantom new row", () => {
    const chipPositions = Array.from({ length: 6 }, (_, i) => plainChipPosition(i, 6));
    const last = chipPositions[5];
    expect(insertionMarkerPosition(6, chipPositions, 6)).toEqual({ ...last, cx: last.cx + CHIP_WIDTH });
  });

  it("starts a real new row when the last row isn't full", () => {
    // 7 tokens at 6/row leaves the second row with only 1 chip - dropping at
    // the end (index 7) is a genuine new row, not the exactly-full case above.
    const chipPositions = Array.from({ length: 7 }, (_, i) => plainChipPosition(i, 6));
    expect(insertionMarkerPosition(7, chipPositions, 6)).toEqual({
      cx: CHIP_WIDTH + CHIP_GAP,
      cy: HEADER_HEIGHT + (CHIP_HEIGHT + CHIP_GAP),
      col: 1,
      row: 1,
    });
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
