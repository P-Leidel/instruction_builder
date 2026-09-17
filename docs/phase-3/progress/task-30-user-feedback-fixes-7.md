# Task 30: seventh user feedback pass

> 📌 **Doc status: CURRENT** — one file in the
> [Phase 3 Progress Log](./README.md).

Date: 2026-09-17

A same-day follow-up to the
[sixth feedback pass](./task-30-user-feedback-fixes-6.md), covering two
unrelated reports. Settled via `/mattpocock-skills:grill-me` (a full
design-tree interview, 12 questions across several rounds - the frontier
kept reopening as facts came back from diagnostic sub-agents) before any
code changed, then implemented and verified in a real browser only after
the user's explicit "yes implement."

## What was reported

1. **"Similar to how step time affected step size, token time is affecting
   the step size similarly. The step and token sizes should not change
   after placing."**
2. **"The export PDF is broken as soon as there are multiple pages (test
   this) -> printed pages should be split along steps and not cut them.
   There should be no empty page when printing or saving multiple pages."**

## What shipped: token time no longer resizes a step

Root-caused to `lib/canvas-layout.ts`'s `computeRowStartYs()`: the band
reserved above each row for a token's time label
(`CHIP_TIME_HEADER_HEIGHT`) was only added for rows containing at least one
timed token, so attaching or removing a token's time - or dragging a timed
token into a step that didn't have one yet - shifted every row after it and
grew or shrank the step card, exactly the same class of bug already fixed
once before for a *step's own* time (referenced directly in the new
regression test's name). The fix makes the reservation unconditional: every
row always reserves the band, whether or not any of its tokens have a time
set, so a step's height and every chip's position are now a pure function
of *how many* tokens it has, never *which* of them happen to carry a time.
`insertionMarkerPosition`'s empty-step default was updated to match, so the
drop-preview marker for a step's first token lands at the same y-coordinate
the token will actually render at once dropped.

Verified with 28 `canvas-layout.test.ts` cases (was 30 - the old
"token time labels" describe block encoded the buggy conditional behavior
as expected and was rewritten, net -2 tests but +1 new explicit regression
case: "keeps a step's own height identical whether or not one of its
tokens has a time attached"), and live in a real browser - a screenshot of
a step with three tokens, only one carrying a time, shows all three chips
flush on the same row.

## What shipped: PDF export now paginates along step boundaries

A live diagnostic against the `window.print()`-based baseline (task 17,
Phase 2) confirmed the report exactly: an 18-step test document produced
4 printed pages for content that only needed 3 (the canvas's own `<h2>`
heading pushed the SVG onto page 2, leaving page 1 blank), and steps 8 and
15 were both cut in half across a page boundary. The root cause is
structural, not a tunable CSS value: `break-inside`/`page-break-*` rules
only apply to block-level boxes in normal document flow, and every step in
this app is a `<g>` inside one shared `<svg>`'s own internal paint - there
was never a page boundary CSS pagination could see to avoid cutting.

**Fix: replace `window.print()` with a real generated PDF**, pulling
forward Phase 4 task 37's "Add Vector PDF Export (Stretch)" rather than
patching the print stylesheet, since no print-CSS fix could satisfy "never
cut a step" for content painted inside one SVG. `lib/pdf-export.ts` now
uses [jsPDF](https://github.com/parallax/jsPDF) +
[svg2pdf.js](https://github.com/yWorks/svg2pdf.js) to render one jsPDF page
per batch of whole steps, computed by a new pure, unit-tested
`lib/pdf-pagination.ts`:

- **`paginateSteps` greedily packs as many whole steps as fit** in each
  page's height budget, closing a page and starting the next the moment
  the *next* step would overflow it - so a page can end with unused space,
  but a step is never split across two. A single step taller than an
  entire page's usable height gets a page to itself rather than looping or
  silently clipping it. 6 new unit tests cover the empty-input, everything-
  fits, exact-boundary, greedy-packing, oversized-step, and per-page-budget
  cases directly (no browser needed - it's pure arithmetic over step
  top/height pairs).
- **Reuses the same hidden, style-baked export canvas** SVG/PNG export
  already build (`cloneCanvasForExport`, now exported from `svg-export.ts`
  instead of module-private) rather than restructuring any DOM: each page
  is that one clone with its `viewBox` re-sliced to just the vertical span
  its steps occupy, handed to `svg2pdf` to render onto its own jsPDF page.
  Step bounds are read straight off the live DOM (`[data-step-id]`'s
  `transform`, its background rect's `height`) rather than recomputed a
  second way, matching this app's existing "read the rendered DOM back
  out" export convention.
- **DIN A4 (210×297mm), not US Letter**, with a real 15mm margin - a
  deliberate choice now that jsPDF generates the file directly (there's no
  more OS print dialog offering its own paper-size choice the way
  `window.print()`'s output happened to get 0-margin Letter by accident).
  A4 was picked specifically because this app's target audience is
  European.
- **The title/total-time heading is drawn once, on page 1 only**, via
  jsPDF's own text API - it's a DOM sibling of the `<svg>` in
  `InstructionCanvas`, never part of what gets serialized, so it can't be
  baked into the per-page SVG slices the way step content is.
- **The `@media print` stylesheet from task 17 is left in place
  unchanged**, but now serves only as an unsupported fallback for a user's
  own native Ctrl+P/File > Print (which still opens the browser's print
  dialog against the live editor, since that's outside this app's control)
  - the Export PDF *button* no longer touches `window.print()` at all.
- **jsPDF and svg2pdf.js are dynamically imported**, not a static
  top-level import - both so they only ever load into the bundle when a
  user actually exports a PDF (confirmed via `npm run build`: they land in
  their own chunks, `jspdf.es.min` 390.53 kB / 128.83 kB gzip and
  `svg2pdf.es.min` 86.99 kB / 25.61 kB gzip, neither bundled into the
  95.33 kB / 28.52 kB gzip main `index` chunk), and because a static
  top-level `import "svg2pdf.js"` crashes outside a real browser -
  `TypeError: Cannot read properties of undefined (reading 'jsPDF')` at
  module-evaluation time under Vitest/jsdom, which was breaking
  `document-actions.test.ts` (its whole module graph transitively imports
  `pdf-export.ts`) until this was caught and fixed during verification.

Other decisions settled while grilling: an empty document (no steps yet)
still downloads a one-page PDF with just the heading rather than doing
nothing; the pagination algorithm is a plain greedy bin-pack rather than a
more even distribution, since "never split a step" is the only real
constraint and a standard packing approach is easy to reason about and
test.

## Verification

- `npm run lint` / `npx tsc -b` / `npm run build` all clean.
- `npm test`: 135 tests across 11 files (was 131 - net +4: `canvas-layout.test.ts`
  -2 as above, plus the new `pdf-pagination.test.ts`'s +6).
- Full `.claude/skills/run-instruction-builder` Playwright driver run
  against a live dev server, including a new dedicated multi-page test: an
  18-step document imported via the existing JSON-import path, Export PDF
  clicked, the download captured via `page.waitForEvent("download")` and
  its page count read straight out of the PDF bytes (counting `/Type
  /Page` object entries). Result: `PDF_EXPORT_DOWNLOADED_VALID_PDF=true`,
  `PDF_EXPORT_PRODUCES_MULTIPLE_PAGES=true` (page count: 3, matching the
  diagnostic's own arithmetic - down from the baseline's 4, with no blank
  page and no step split), `PAGINATION_TEST_UNDO_RESTORED_DOCUMENT=true`
  (the throwaway 18-step document is undone back to the real baseline
  afterward), `PRINT_STYLESHEET_ISOLATES_READONLY_CANVAS=true` (the
  Ctrl+P fallback CSS still works, independent of the button),
  `CONSOLE_ERRORS_COUNT=0`, and zero axe-core violations across all three
  scanned states. A screenshot of the token-time fix (a step with a timed
  and an untimed token chip on the same row) was read back to confirm
  visually, not just asserted.
- Rendering the downloaded multi-page PDF's own pages as images to
  double-check step boundaries by eye was attempted but skipped -
  `pdftoppm`/poppler-utils isn't installed on this machine. Not pursued
  further: the "never split a step" invariant is structural (proven by
  `paginateSteps`'s own unit tests, not just exercised by one document's
  worth of luck), and the live page count independently matches the
  diagnostic's expected value.

## What's next

This also closes out Phase 4 task 37 (Add Vector PDF Export (Stretch)) -
see [../../milestones.md](../../milestones.md) - a full phase ahead of
schedule, since fixing this report properly required it anyway. See
[README.md](./README.md) for Phase 3's overall status - task 30 (Test Real
Users) continues as more feedback comes in.
