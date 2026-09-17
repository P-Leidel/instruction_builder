/**
 * A step's vertical extent in the export canvas's own design-unit
 * coordinate space (the same units as the export `<svg>`'s `viewBox`) -
 * `top` is where its card starts, `height` is how tall its card is. Kept
 * generic (`T extends StepBounds`) so `paginateSteps` can be handed either
 * plain bounds (as the tests below do) or a richer per-step type that also
 * carries whatever `pdf-export.ts` needs to draw it, without this module
 * knowing about SVG/DOM (or even `canvas-layout.ts`) at all - see
 * `pdf-export.ts`'s own comment: it maps `computeCanvasLayout`'s
 * `StepLayout.cardY`/`height` straight into this shape (2026-09-17
 * remediation, part 2 - this used to instead be read back off the live
 * export canvas DOM, one `cardY`/`height`-shaped round trip this module
 * never needed to know about either way).
 */
export interface StepBounds {
  top: number;
  height: number;
}

/**
 * Greedily packs `steps` (already sorted top-to-bottom) onto pages, never
 * splitting a step across two pages - the fix for "PDF export cuts a step
 * in half" (2026-09-17 remediation). `pageHeight(pageIndex)` returns that
 * page's usable content height, in the same design units as `StepBounds`;
 * it's a function rather than one flat number because page 0 reserves extra
 * room above its steps for the document's title/total-time heading (drawn
 * once, only on page 1 - see pdf-export.ts), which later pages don't need
 * to budget for.
 *
 * A single step taller than a whole page's usable height on its own (an
 * unrealistic ~70+ tokens in one step at today's chip size) is still placed
 * as the sole occupant of its page rather than looping forever trying to
 * split it - see the `current.length > 0` guard below: a page is only ever
 * force-closed *before* a step that would overflow it, never mid-step, so
 * the very first step placed on a fresh page always lands regardless of how
 * tall it is.
 */
export function paginateSteps<T extends StepBounds>(
  steps: readonly T[],
  pageHeight: (pageIndex: number) => number,
): T[][] {
  if (steps.length === 0) return [];

  const pages: T[][] = [];
  let current: T[] = [];
  let pageTop = steps[0].top;

  for (const step of steps) {
    const pageIndex = pages.length;
    const spanIfAdded = step.top + step.height - pageTop;
    if (current.length > 0 && spanIfAdded > pageHeight(pageIndex)) {
      pages.push(current);
      current = [];
      pageTop = step.top;
    }
    current.push(step);
  }
  pages.push(current);

  return pages;
}
