import { describe, it, expect } from "vitest";
import { paginateSteps, type StepBounds } from "./pdf-pagination";

function step(top: number, height: number): StepBounds {
  return { top, height };
}

describe("paginateSteps", () => {
  it("returns no pages for no steps", () => {
    expect(paginateSteps([], () => 1000)).toEqual([]);
  });

  it("puts every step on one page when they all fit", () => {
    const steps = [step(0, 100), step(116, 100), step(232, 100)];
    const pages = paginateSteps(steps, () => 1000);
    expect(pages).toEqual([steps]);
  });

  it("never splits a step across two pages: a step that would straddle a page boundary starts the next page instead", () => {
    // Page budget 200: step A [0,100) fits, step B [116,216) would span
    // 216 design units from the page's own top (0) - over budget - so B
    // has to start a fresh page rather than being cut at 200.
    const a = step(0, 100);
    const b = step(116, 100);
    const pages = paginateSteps([a, b], () => 200);
    expect(pages).toEqual([[a], [b]]);
  });

  it("packs as many whole steps as fit before breaking", () => {
    const steps = [step(0, 90), step(100, 90), step(200, 90), step(300, 90)];
    // Budget 250 (measured from each page's own first step's top): page 1
    // fits steps at 0 and 100 (spans to 190), the step at 200 would span to
    // 290 - starts page 2. Page 2 (top now 200) fits 200 and 300 (spans to
    // 390 - 200 = 190).
    const pages = paginateSteps(steps, () => 250);
    expect(pages).toEqual([
      [steps[0], steps[1]],
      [steps[2], steps[3]],
    ]);
  });

  it("gives a single step taller than a whole page its own page rather than looping or splitting it", () => {
    const huge = step(0, 5000);
    const next = step(5000, 50);
    const pages = paginateSteps([huge, next], () => 200);
    expect(pages).toEqual([[huge], [next]]);
  });

  it("budgets page 0 separately from later pages (e.g. for a heading only page 0 reserves room for)", () => {
    const steps = [step(0, 80), step(96, 80), step(192, 80)];
    // Page 0's budget (120) only fits the first step; pages after that get
    // the full 200 and fit the remaining two together (96 to 272, a span of
    // 176 from that page's own top of 96).
    const pageHeight = (pageIndex: number) => (pageIndex === 0 ? 120 : 200);
    const pages = paginateSteps(steps, pageHeight);
    expect(pages).toEqual([[steps[0]], [steps[1], steps[2]]]);
  });
});
