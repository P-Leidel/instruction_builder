# Pre-launch file/docs audit and UI polish follow-up

> 📌 **Doc status: CURRENT** — one file in the
> [Phase 3 Progress Log](./README.md).

Date: 2026-09-14

Requested by the user as a final review before hosting and real user
testing (task 29/30 lead-in) - two parts: (1) audit the project's folder structure/docs for duplicates,
stale content, and naming, and (2) a critical UI pass with a concrete
implementation plan, then apply the small-effort/high-impact items from
it. Findings were presented and confirmed with the user before any file
was touched, and three UI items that turned out to affect behavior/data
(not just styling) were each put to the user as an explicit choice before
implementing - see "What shipped" below. Not a numbered project-plan task,
so it's recorded here rather than under a task number, the same way the
two 2026-09-14 architecture-review remediation passes were.

## Part 1: File/docs audit

Read all 57 files under `docs/` plus every tracked repo file
(`git ls-files`) against the project's own documented conventions
(naming and the CURRENT/HISTORICAL status banner - see
[../../milestones.md](../../milestones.md#documentation-naming-conventions)).
Findings:

- **`tests/.gitkeep`** was vestigial - [vitest.config.ts](../../../vitest.config.ts)
  only ever collected `src/**/*.test.ts`, and every real test already lives
  next to its source file. Deleted, along with the now-empty `tests/`
  folder it existed only to keep tracked.
- **Root [README.md](../../../README.md) was stale** - it still said
  "Currently in Phase 1: Concept Validation" and "Status: Phase 1 only...
  No canvas, export, drag-and-drop, or saving yet," despite the project
  being well into Phase 3 (25/28 tasks done at the time). Rewritten to
  point at [milestones.md](../../milestones.md) as the one place phase/task
  status is tracked, instead of asserting a phase inline - so the README
  can't go stale the same way again.
- Everything else checked out: 54 of 57 docs already carry the required
  status banner (the 3 without one are dated review reports in
  `phase-2/reviews/` whose folder `README.md` already covers them
  collectively as HISTORICAL - defensible as-is), every doc filename
  already follows the project's lowercase-kebab-case/descriptive
  convention, no doc is too large to read in one piece, and all 4 PWA icon
  files are actually referenced (no orphaned assets). No further action
  taken.

## Part 2: UI review and fixes

Drove the real app via `.claude/skills/run-instruction-builder`'s
Playwright driver and screenshotted every major state (populated desktop
editor, 390px mobile, Preview mode, Import dialog, token attachments) for
a critical design pass - not chasing a specific bug. Eight findings came
out of that pass; the user asked for the first six (small, contained)
to ship now and for items 7-8 (mobile-only, larger) to be tracked instead
- see [known-issues.md](../../known-issues.md#mobile-layout-order-buries-the-canvas-below-an-empty-token-details-placeholder)
for those two.

Three of the six touched behavior/data, not just styling, so each was
put to the user as an explicit choice before implementing (all three
picked the first, recommended option):

- **Toolbar grouping** - a pure visual grouping (chosen) vs. a real
  dropdown menu (more interaction surface/a11y testing right before
  launch).
- **Duration format** - reformat `formatDuration()` itself so every
  visual surface (screen, SVG/PNG/PDF export, canvas) shows the friendly
  format (chosen) vs. an on-screen-only formatter leaving the exported
  label technical.
- **Incomplete-step badge** - suppress it until the user has added a
  token to that step (chosen) vs. only softening its color, vs. leaving
  it as-is. Export's own "N incomplete steps" warning toast was
  confirmed unaffected either way (it checks `isComplete` directly).

### What shipped

1. **Fixed the "Add to token" panel floating disconnected from "Add to
   step" (finding 1), and the canvas panel staying artificially tall/empty
   (finding 2)** - one fix for both, since they shared a root cause.
   Confirmed with a Playwright
   layout inspection rather than guessed: the previous 3-row CSS grid
   shared its row tracks across both side columns, so the right column's
   second panel was sized off the *left* column's row 2 height ("Step
   details"), unrelated to anything in its own column - and the canvas
   panel, spanning all three rows, inherited the same inflated height.
   Fixed by wrapping each side's three-panel stack in its own independent
   flex column (`app__col-left`/`app__col-right` -
   [src/app.tsx](../../../src/app.tsx), [src/styles/global.css](../../../src/styles/global.css)),
   so each side - and the canvas - now sizes to only its own content.
3. **Grouped the toolbar's 5 export/import buttons** into one visually
   distinct tray (`.app__file-controls`'s new shaded/bordered background),
   separated from "New" (a document-lifecycle action, moved to its own
   button) and the history/preview controls either side - no change to any
   button's behavior.
4. **Reformatted durations to be human-readable** - `formatDuration()`
   ([src/lib/duration.ts](../../../src/lib/duration.ts)) now renders only
   the non-zero units (`"2d"`, `"1h 30m"`) instead of the previous fixed
   `"02d-00h-00m-00s"`. Since `DurationAttachment.label` is the one string
   reused everywhere a duration displays - Step/Token details, the
   canvas's centered header, and (because SVG/PNG/PDF export serialize
   that same rendered canvas) every visual export too - this one change
   reaches all of them at once. JSON export is unaffected: it round-trips
   through `.seconds`, not this label.
5. **Deferred the incomplete-step "!" badge until a step actually has a
   token.** `model/validate.ts`'s new `shouldFlagIncompleteStep(step,
   result)` gates the persistent badge in both `StepList` and
   `InstructionCanvas` on `step.tokens.length > 0`, so a brand-new,
   untouched document no longer shows a warning before the user has done
   anything. `validateStep`/`isComplete` themselves are unchanged - a
   zero-token step is still counted incomplete for export's warning toast,
   only the always-visible badge is deferred.
6. **Strengthened the document-title field's contrast** - it already had a
   border, but at `var(--color-border)` (#e3e5ea, near-white on white) it
   read as inert despite driving every export's filename (task 27). Now
   `var(--color-border-strong)` plus a faint sunken fill.

### Verification

- `npm run lint`, `npm run typecheck`, and `npm test` (118 tests, unchanged
  in count - `duration.test.ts`'s 3 format assertions were updated in
  place for the new human-readable strings, no tests added/removed) all
  pass.
- The full Playwright driver (44 checks) passes cleanly - zero console
  errors, zero axe-core violations at all three scanned states. Two of its
  own assertions needed updating for the new duration format (hardcoded
  `"00d-01h-30m-00s"`/`"02d-00h-00m-00s"` strings), and its incomplete-step
  export-warning check was reworked to reconstruct the true incomplete
  count from two DOM signals (`.step-list__flag`'s count plus
  `.instruction-canvas__hint`'s "Empty step" count) instead of trusting the
  now-deliberately-suppressed badge count alone - it had briefly gone
  false after the badge-suppression change until this was fixed, caught by
  rerunning the driver rather than assumed passing.
- Re-screenshotted every state from the original review pass and confirmed
  each finding visually: "Add to token" now sits directly under "Add to
  step" with both a near-empty and a fully populated left column; the
  canvas panel is no longer artificially tall; the toolbar reads as
  distinct groups; durations show as "2d"/"1h 30m" on screen, the canvas
  header, and Preview mode; the incomplete badge no longer appears on a
  fresh document's untouched first step.

## What's next

See [README.md](./README.md) for Phase 3's overall status - task 29
(Publish MVP) is still next. Items 7-8 from the UI review (mobile stacking
order, canvas legibility at mobile width) are tracked, not fixed - see
[known-issues.md](../../known-issues.md#mobile-layout-order-buries-the-canvas-below-an-empty-token-details-placeholder).
