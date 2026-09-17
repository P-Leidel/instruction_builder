# Task 30: first user feedback pass

> 📌 **Doc status: CURRENT** — one file in the
> [Phase 3 Progress Log](./README.md).

Date: 2026-09-17

Five items real users raised while manually testing the app (task 30,
Test Real Users), settled via `/mattpocock-skills:grilling` before any code
changed, then implemented and verified end-to-end.

## What shipped

1. **Document title cap.** The toolbar's document-title input had no
   `maxLength` at all. Now capped at 50 (`app.tsx`'s
   `DOCUMENT_TITLE_MAX_LENGTH`), matching Step/Token Title's existing
   input-only convention - no model/schema validation, same as those two.
2. **Token Title cap lowered.** `TokenDetails.tsx`'s own `TITLE_MAX_LENGTH`
   dropped from 50 to 18 (it was already an independent constant from
   `StepDetails.tsx`'s, which stays 50 - no coupling to touch). Non-
   retroactive: a token already titled longer than 18 keeps its title until
   next edited, the same behavior the original 50-cap already had.
3. **Step time moved inline before the step title.** Previously a centered
   label in a reserved external gap above each step's card
   (`canvas-layout.ts`'s `TIME_HEADER_HEIGHT`) - testers wanted it inside
   the card, and specifically prefixing the title on the same line/style
   (e.g. "54 min 30s - Chop the onion"), not off in a corner badge. The
   external reservation is gone entirely (`headerHeight` deleted from
   `StepLayout`), so steps with a time now render more compactly, not just
   relocated - that compaction *is* the fix for "it affects layout," not a
   side effect to avoid. The combined text lives in one `<text
   class="instruction-canvas__step-title">`, with the time portion as its
   own `<tspan class="instruction-canvas__step-time">` purely so
   `driver.mjs`/future tests can still select just the time value, and the
   title portion likewise as its own `<tspan
   class="instruction-canvas__step-title-text">` so title-equality checks
   don't pick up the time prefix. No new truncation/overflow handling was
   added for the (now slightly more likely) case of a long combined
   string - neither title nor time had any before this, and adding it was
   explicitly out of scope for this pass. No accessibility regression: the
   title `<text>` was already `aria-hidden="true"` before this change (a
   screen reader gets a step's title/time from the fully-accessible
   `StepDetails` panel after selecting it, not from canvas text), so the
   merge doesn't remove anything that was reachable before.
4. **Token details' read-only description line removed.** The `<p
   class="token-details__summary">` line (icon + `descriptionFor(iconId)`,
   an app-authored blurb like "Cut into small pieces with a knife.")
   duplicated what the user's own Notes field already lets them say, and
   was the only place in the app that ever rendered it (`StepDetails.tsx`
   never did, despite a stale comment claiming otherwise). Removed, and
   since nothing else used it, `descriptionFor()` and `SampleToken`'s
   `description` field are deleted from `data/sample-tokens.ts` as dead
   code - every one of its ~70 entries lost its `description: "..."`
   property too.
5. **Scrollbar-triggered layout shift fixed.** `.app__main`'s
   `grid-template-columns` (desktop only, `min-width: 800px`) uses
   `vw`-based `clamp()` for its side columns, so the page's vertical
   scrollbar toggling on/off as a document grows/shrinks changed the
   viewport width `vw` resolves against and reflowed the whole grid. Fixed
   with `scrollbar-gutter: stable` on `html` - but scoped inside that same
   `@media (min-width: 800px)` block, not applied globally. A first attempt
   at a bare `html { scrollbar-gutter: stable; }` broke the existing
   mobile-overflow regression guard
   (`NO_HORIZONTAL_OVERFLOW_AT_MOBILE_WIDTH`): at 390px, an unconditionally
   reserved gutter made `document.documentElement.scrollWidth` (375) come
   out *less* than `clientWidth` (390), a mismatch the driver's `=== 0`
   check couldn't tell apart from a real overflow bug, even though nothing
   visually overflowed. Since mobile's layout below that breakpoint is a
   plain flex column with no `vw`-based columns to protect in the first
   place, scoping the fix to the desktop breakpoint resolves both: the
   real reflow problem, and the false regression the first attempt caused.

## Verification

- `npm run lint` / `npm run typecheck` / `npm test` (131 tests, unchanged -
  only one existing `canvas-layout.test.ts` assertion needed updating, for
  the deleted `headerHeight` field) / `npm run build` all clean.
- Full Playwright driver run against the dev server: all 46 checks
  `true`/`0`/`0`. Two driver updates were needed to get there, both because
  of item 3 above, not new bugs: `stepTitles`' locator moved from
  `.instruction-canvas__step-title` (now sometimes carries a `"<time> - "`
  prefix) to the new `.instruction-canvas__step-title-text` tspan, fixing
  three checks (`UNDO_REDO_WORKED_END_TO_END`,
  `FORWARD_STEP_DRAG_LANDS_AT_DROP_POINT`, and every other title-equality
  check that locator feeds) that had started reading the combined string
  instead of just the title.
- Screenshots read directly to confirm: the document title input, the
  relocated step-time text, the token details panel with no description
  line, and the mobile viewport with no layout shift.

## What's next

See [README.md](./README.md) for Phase 3's overall status - task 30 (Test
Real Users) continues as more feedback comes in.
