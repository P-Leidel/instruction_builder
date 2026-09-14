import { describe, it, expect } from "vitest";
import { createClickAfterDragGuard } from "./pointer-drag";

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
