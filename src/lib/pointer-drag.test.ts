import { describe, it, expect } from "vitest";
import { createClickAfterDragGuard, resolveTokenPointerOutcome } from "./pointer-drag";

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

describe("resolveTokenPointerOutcome", () => {
  it("selects the step on a tap when its step wasn't already selected", () => {
    expect(resolveTokenPointerOutcome(false, false, null)).toEqual({ kind: "selectStep" });
  });

  it("selects the token on a tap when its step was already selected", () => {
    expect(resolveTokenPointerOutcome(false, true, null)).toEqual({ kind: "selectToken" });
  });

  it("moves the token on a drag that lands on a valid target", () => {
    const target = { stepId: "s1", index: 2 };
    expect(resolveTokenPointerOutcome(true, true, target)).toEqual({ kind: "move", target });
    expect(resolveTokenPointerOutcome(true, false, target)).toEqual({ kind: "move", target });
  });

  it("does nothing on a drag that ends over no valid target", () => {
    expect(resolveTokenPointerOutcome(true, true, null)).toEqual({ kind: "none" });
    expect(resolveTokenPointerOutcome(true, false, null)).toEqual({ kind: "none" });
  });
});
