# Task 21 — Build Responsive Layouts

> 📌 **Doc status: CURRENT** — one file in the
> [Phase 2 Progress Log](./README.md).

The plan's own scope for this task is one line: "Support all common screen
sizes." A lot of mobile handling had already landed opportunistically during
earlier tasks (the canvas's `clamp(480px, 100%, 960px)` width and
single-row-per-step mode below 800px, the toolbar's own `flex-wrap`, the
single-column stack below the one 800px breakpoint) - so this task was run
as an audit first, fixing only what the audit actually found broken, rather
than a from-scratch responsive rebuild or a new breakpoint.

## Audit method

A scripted Playwright pass (not the full regression driver - a lighter,
purpose-built script) populated a real document (steps with several tokens,
a step forced to wrap onto two canvas rows, a Warning/Quantity attachment,
a step-level duration) and screenshotted every panel, the toolbar, and both
editor/Preview mode at six widths: 360px (a small phone, narrower than the
existing 390px driver check), 390px (the existing check), 799px (just below
the desktop breakpoint), 800px and 900px (just above it, where a fixed-width
desktop grid is most likely to feel cramped), and 1400px (the existing
desktop check) - scoped to phone + desktop widths only, no new breakpoint,
per a decision made with the user before starting. A second pass
covered surfaces the first didn't touch: a Step List with 13 steps
(including one with a long, unbroken title), Step/Token details with a
token actually selected (and given a long title too), the incomplete-steps
warning toast, the import-error toast, and the Import confirm dialog - all
at the same narrow widths. Both passes checked
`document.documentElement.scrollWidth` against `clientWidth` (any
difference means something is forcing the page wider than the viewport) and
scanned the toolbar for any button whose bounding box fell outside the
viewport.

## What was found and fixed

Three real, shipped bugs - each some variant of "a flex/grid item's
automatic minimum size defaulted to its un-wrapped content size instead of
actually shrinking," a single recurring CSS pattern once diagnosed:

1. **Toolbar overflow on phones** - `.app__file-controls`'s `flex-shrink: 0`
   pinned it at its full 5-button, un-wrapped width regardless of how little
   room the toolbar had, so its own `flex-wrap: wrap` never triggered and
   "Export PDF"/"Import" spilled off the right edge at 360-390px. Fixed by
   allowing it to shrink (`flex-shrink: 1` + `min-width: 0`). See
   [../../fixed-issues/toolbar-export-buttons-overflow-on-phones.md](../../fixed-issues/toolbar-export-buttons-overflow-on-phones.md).
2. **A long step title overflowed the whole page** instead of truncating
   with the ellipsis `.step-list__summary` was already styled for - the
   same missing-`min-width: 0` pattern, one level up the tree on
   `.step-list__item`. See
   [../../fixed-issues/long-step-title-overflowed-page.md](../../fixed-issues/long-step-title-overflowed-page.md).
3. **A long token title starved its description column** in Step details'
   token list - a CSS Grid variant of the same idea: an `auto` label track
   claims its full preferred width before the `1fr` description track gets
   anything, so a long label left the description wrapping one word per
   line. Fixed by giving both text tracks `minmax(0, ...)` so they share
   the row's actual width fairly. See
   [../../fixed-issues/long-token-title-starved-description-column.md](../../fixed-issues/long-token-title-starved-description-column.md).

One further improvement, not a bug fix (the prior behavior was a
deliberate, working fallback, just a cramped one):

4. **The canvas became a very narrow (as little as 216px) horizontal-scroll
   strip right above the 800px breakpoint.** `.instruction-canvas` already
   had `overflow-x: auto` for exactly this case (a canvas wider than its
   container scrolls instead of overflowing the page), so nothing was
   actually broken or invisible - but with the desktop grid's side columns
   fixed at `240px`/`280px`, the middle canvas column only got ~216px of
   the (480-1064px, depending on viewport) space it needed at 800px,
   widening to a still-tight ~440px by 1000px and only clearing its own
   480px minimum past ~1064px. Changed the two side columns from fixed
   widths to `clamp(200px, 24vw, 240px)` / `clamp(210px, 30vw, 280px)`, so
   they shrink first and reclaim real room for the canvas as the viewport
   narrows toward 800px - confirmed the canvas's visible width nearly
   doubles at 800px (216px → ~296px) with zero change at typical desktop
   widths (the vw-scaled middle of each clamp reaches its ceiling, identical
   to the old fixed width, well before 1400px - confirmed pixel-identical
   there). This still doesn't fully eliminate the scroll between 800-1064px
   without a second breakpoint, which was explicitly out of scope for this
   pass.

## What was checked and found already correct

No page-level overflow and no offscreen toolbar buttons at any of the six
widths, in either editor or Preview mode, before *or* after the fixes above
were isolated to the three specific bugs; the many-step StepList (13 steps,
no scroll cap - the page just grows vertically, which is fine), the
incomplete-steps warning toast, the import-error toast, and the Import
confirm dialog (`max-width: 380px`, comfortably fits inside a 360px
viewport's padding) all rendered cleanly at every width with zero console
errors throughout both audit passes.

## Verification

`npm run lint`, `npm run typecheck`, `npm test` (107 tests, unaffected -
this task touched only CSS), and `npm run build` all pass after every
change above.

## Files touched

- `src/styles/global.css` - `.app__file-controls` (`flex-shrink: 1` +
  `min-width: 0`), `.step-list__item` (`min-width: 0`),
  `.step-details__token` (`grid-template-columns` changed to
  `minmax(0, 1fr) minmax(0, 1.3fr)` for its label/description tracks), and
  the `@media (min-width: 800px)` block's `.app__main` grid columns
  (fixed `240px`/`280px` → fluid `clamp(...)`).
- `docs/fixed-issues/` - three new entries (see "What was found and fixed"
  above).
