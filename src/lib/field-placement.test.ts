import { describe, it, expect } from "vitest";
import { resolveFieldPlacement, VIEWPORT_GUTTER } from "./field-placement";

/**
 * A 1024x768 window with a small trigger button sitting comfortably in the
 * middle of it - the case where nothing needs to flip. Each test below
 * moves only the one thing it is about.
 */
function scenario(overrides: {
  anchorLeft?: number;
  anchorTop?: number;
  popoverWidth?: number;
  popoverHeight?: number;
  viewportWidth?: number;
  viewportHeight?: number;
} = {}) {
  const {
    anchorLeft = 100,
    anchorTop = 300,
    popoverWidth = 240,
    popoverHeight = 180,
    viewportWidth = 1024,
    viewportHeight = 768,
  } = overrides;
  return {
    anchor: { left: anchorLeft, right: anchorLeft + 80, top: anchorTop, bottom: anchorTop + 32 },
    popover: { width: popoverWidth, height: popoverHeight },
    viewport: { width: viewportWidth, height: viewportHeight },
  };
}

describe("resolveFieldPlacement", () => {
  it("leaves the panel below-left when it fits there", () => {
    expect(resolveFieldPlacement(scenario())).toEqual({ horizontal: "left", vertical: "below" });
  });

  it("flips to right-aligned when a left-aligned panel would run past the right edge", () => {
    const placement = resolveFieldPlacement(scenario({ anchorLeft: 900 }));
    expect(placement).toEqual({ horizontal: "right", vertical: "below" });
  });

  it("flips above when the panel does not fit below but does fit above", () => {
    // Trigger low in a short window: 40px of room underneath, plenty over.
    const placement = resolveFieldPlacement(scenario({ anchorTop: 600, viewportHeight: 680 }));
    expect(placement).toEqual({ horizontal: "left", vertical: "above" });
  });

  it("stays below when the panel fits on neither side", () => {
    // A window too short for the panel anywhere - staying below keeps it
    // reachable by scrolling, where flipping above would clip it.
    const placement = resolveFieldPlacement(scenario({ anchorTop: 60, viewportHeight: 200, popoverHeight: 400 }));
    expect(placement).toEqual({ horizontal: "left", vertical: "below" });
  });

  it("flips on both axes at once", () => {
    const placement = resolveFieldPlacement(
      scenario({ anchorLeft: 900, anchorTop: 600, viewportHeight: 680 }),
    );
    expect(placement).toEqual({ horizontal: "right", vertical: "above" });
  });

  it("treats the gutter as the boundary, on both axes", () => {
    // Exactly filling the space up to the gutter still fits; one pixel
    // more does not. Pinned explicitly because an off-by-one here is
    // invisible on screen until a panel is one pixel off the edge.
    const width = 1024;
    const exactlyFitsRight = scenario({ viewportWidth: width, anchorLeft: 100, popoverWidth: width - VIEWPORT_GUTTER - 100 });
    expect(resolveFieldPlacement(exactlyFitsRight).horizontal).toBe("left");

    const onePixelTooWide = scenario({
      viewportWidth: width,
      anchorLeft: 100,
      popoverWidth: width - VIEWPORT_GUTTER - 100 + 1,
    });
    expect(resolveFieldPlacement(onePixelTooWide).horizontal).toBe("right");

    const height = 768;
    const anchorTop = 600;
    const anchorBottom = anchorTop + 32;
    const exactlyFitsBelow = scenario({
      viewportHeight: height,
      anchorTop,
      popoverHeight: height - VIEWPORT_GUTTER - anchorBottom,
    });
    expect(resolveFieldPlacement(exactlyFitsBelow).vertical).toBe("below");

    const onePixelTooTall = scenario({
      viewportHeight: height,
      anchorTop,
      popoverHeight: height - VIEWPORT_GUTTER - anchorBottom + 1,
    });
    expect(resolveFieldPlacement(onePixelTooTall).vertical).toBe("above");
  });
});
