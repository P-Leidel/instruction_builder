import { describe, it, expect } from "vitest";
import { paginateSteps, type StepBounds } from "./pdf-pagination";
import { computeCanvasLayout } from "./canvas-layout";
import { createEmptyStep, createToken } from "../model/instruction";
import type { InstructionStep } from "../model/instruction";

function step(top: number, height: number): StepBounds {
  return { top, height };
}

function stepWithTokens(tokenCount: number): InstructionStep {
  return {
    ...createEmptyStep(),
    tokens: Array.from({ length: tokenCount }, () => createToken("action", "a")),
  };
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

/**
 * Regression coverage for the 2026-09-17 remediation that deleted
 * `pdf-export.ts`'s `readStepBounds()` DOM-scraping (see
 * docs/known-issues.md's former "PDF pagination selector fix has no driver
 * regression test yet" entry, and
 * docs/phase-3/reviews/2026-09-17-whole-codebase-audit-evaluation.md
 * candidate 3/item 6): pagination now takes its `top`/`height` numbers
 * straight from `computeCanvasLayout`, so this exercises that same
 * real-layout-to-pagination path in plain Vitest - no DOM, no Playwright, no
 * fixed-viewport blocker. Uses desktop layout (`isDesktop: true`), matching
 * what the export pipeline now always renders (see `app.tsx`'s
 * `exportLayout`) - unlike mobile's forced single-row-per-step layout
 * (`canvas-layout.ts`'s `chipsPerRow = tokens.length` there), desktop's fixed
 * 6-per-row wrapping actually gives a non-uniform document non-uniform step
 * heights to paginate against.
 */
describe("paginateSteps against real computeCanvasLayout output (non-uniform document)", () => {
  it("gives a step with more tokens (more wrapped rows) a taller bound than one-row neighbors", () => {
    const steps = [stepWithTokens(1), stepWithTokens(12), stepWithTokens(2)];
    const layout = computeCanvasLayout(steps, true);
    const bounds = layout.layouts.map((s) => ({ top: s.cardY, height: s.height }));

    expect(bounds[1].height).toBeGreaterThan(bounds[0].height);
    expect(bounds[1].height).toBeGreaterThan(bounds[2].height);
  });

  it("reacts to each step's own real height: a budget sized for the shortest step isolates a taller one onto its own page", () => {
    const steps = [stepWithTokens(1), stepWithTokens(12), stepWithTokens(2)];
    const layout = computeCanvasLayout(steps, true);
    const bounds = layout.layouts.map((s) => ({ top: s.cardY, height: s.height }));

    const pageHeight = bounds[0].height + 1;
    const pages = paginateSteps(bounds, () => pageHeight);

    // Nothing lost or reordered, and the tall middle step never shares a
    // page (a budget this small could only fit it alone, if at all).
    expect(pages.flat()).toEqual(bounds);
    expect(pages.some((page) => page.includes(bounds[1]) && page.length > 1)).toBe(false);
  });
});
