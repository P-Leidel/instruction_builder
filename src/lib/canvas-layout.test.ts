import { describe, it, expect } from "vitest";
import {
  chipPosition,
  widestRowWidth,
  buildConnectors,
  insertionMarkerPosition,
  computeCanvasLayout,
  CHIP_WIDTH,
  CHIP_HEIGHT,
  CHIP_GAP,
  HEADER_HEIGHT,
  PADDING,
  BASE_CANVAS_WIDTH,
} from "./canvas-layout";
import { createEmptyStep, createToken } from "../model/instruction";

describe("chipPosition", () => {
  it("places the first chip at the header's top-left", () => {
    expect(chipPosition(0, 6)).toEqual({ cx: 0, cy: HEADER_HEIGHT, col: 0, row: 0 });
  });

  it("advances columns within a row", () => {
    expect(chipPosition(1, 6)).toEqual({
      cx: CHIP_WIDTH + CHIP_GAP,
      cy: HEADER_HEIGHT,
      col: 1,
      row: 0,
    });
  });

  it("wraps to a new row after chipsPerRow columns", () => {
    expect(chipPosition(6, 6)).toEqual({
      cx: 0,
      cy: HEADER_HEIGHT + (CHIP_HEIGHT + CHIP_GAP),
      col: 0,
      row: 1,
    });
  });
});

describe("widestRowWidth", () => {
  it("is zero for no tokens", () => {
    expect(widestRowWidth(0, 6)).toBe(0);
  });

  it("is the full row width when a row isn't full", () => {
    expect(widestRowWidth(3, 6)).toBe(3 * CHIP_WIDTH + 2 * CHIP_GAP);
  });

  it("caps at chipsPerRow even with more tokens than fit in one row", () => {
    expect(widestRowWidth(10, 6)).toBe(6 * CHIP_WIDTH + 5 * CHIP_GAP);
  });
});

describe("buildConnectors", () => {
  it("draws nothing for zero or one token", () => {
    expect(buildConnectors(0, 6)).toEqual([]);
    expect(buildConnectors(1, 6)).toEqual([]);
  });

  it("draws one connector per consecutive pair", () => {
    expect(buildConnectors(4, 6)).toHaveLength(3);
  });

  it("draws a plain straight line within one row", () => {
    const [segment] = buildConnectors(2, 6);
    const fromMidY = HEADER_HEIGHT + CHIP_HEIGHT / 2;
    expect(segment.key).toBe("0-1");
    expect(segment.d).toBe(`M ${CHIP_WIDTH} ${fromMidY} L ${CHIP_WIDTH + CHIP_GAP} ${fromMidY}`);
    expect(segment.d).not.toContain("Q");
  });

  it("draws a curved bend across a row wrap", () => {
    // chipsPerRow=1 forces every consecutive pair onto a different row.
    const [segment] = buildConnectors(2, 1);
    const fromMidY = HEADER_HEIGHT + CHIP_HEIGHT / 2;
    const toMidY = HEADER_HEIGHT + (CHIP_HEIGHT + CHIP_GAP) + CHIP_HEIGHT / 2;
    expect(segment.d).toContain("Q");
    expect(segment.d.startsWith(`M ${CHIP_WIDTH} ${fromMidY}`)).toBe(true);
    expect(segment.d.endsWith(`L 0 ${toMidY}`)).toBe(true);
  });
});

describe("insertionMarkerPosition", () => {
  it("matches the target chip's own position in the ordinary case", () => {
    expect(insertionMarkerPosition(2, 5, 6)).toEqual(chipPosition(2, 6));
  });

  it("appends just past the last chip of an exactly-full row, instead of starting a phantom new row", () => {
    const marker = insertionMarkerPosition(6, 6, 6);
    const last = chipPosition(5, 6);
    expect(marker).toEqual({ ...last, cx: last.cx + CHIP_WIDTH });
  });

  it("starts a real new row when the last row isn't full", () => {
    // 7 tokens at 6/row leaves the second row with only 1 chip - dropping at
    // the end (index 7) is a genuine new row, not the exactly-full case above.
    expect(insertionMarkerPosition(7, 7, 6)).toEqual(chipPosition(7, 6));
  });
});

describe("computeCanvasLayout", () => {
  it("returns an empty layout for no steps", () => {
    const layout = computeCanvasLayout([], true);
    expect(layout.layouts).toEqual([]);
    expect(layout.totalHeight).toBe(PADDING * 2);
    expect(layout.canvasWidth).toBe(BASE_CANVAS_WIDTH);
  });

  it("produces one layout entry per step, in order", () => {
    const steps = [createEmptyStep(), createEmptyStep(), createEmptyStep()];
    const layout = computeCanvasLayout(steps, true);
    expect(layout.layouts.map((l) => l.step.id)).toEqual(steps.map((s) => s.id));
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

  it("gives every step in the document one chip per row on mobile", () => {
    const step = {
      ...createEmptyStep(),
      tokens: [createToken("action", "a"), createToken("action", "b")],
    };
    const layout = computeCanvasLayout([step], false);
    expect(layout.layouts[0].chipsPerRow).toBe(step.tokens.length);
  });

  it("uses no header band and no displayed time for a step with no time", () => {
    const layout = computeCanvasLayout([createEmptyStep()], true);
    expect(layout.layouts[0].headerHeight).toBe(0);
    expect(layout.layouts[0].displayedTime).toBeUndefined();
  });

  it("widens the canvas to fit a wider-than-base row of tokens", () => {
    // Enough tokens on mobile (one chip per row = tokens.length columns) to
    // exceed BASE_CANVAS_WIDTH's content area.
    const manyTokens = Array.from({ length: 10 }, () => createToken("action", "a"));
    const layout = computeCanvasLayout([{ ...createEmptyStep(), tokens: manyTokens }], false);
    expect(layout.canvasWidth).toBeGreaterThan(BASE_CANVAS_WIDTH);
  });
});
