# Phase 3 Progress Log — Tasks 25 through 31

> 📌 **Doc status: CURRENT** — living index for the in-progress phase,
> updated as tasks land. Per the convention in
> [../../milestones.md](../../milestones.md#documentation-status-conventions),
> this gets frozen with a HISTORICAL banner the day Phase 3 closes out, and
> a new `phase-4/progress/README.md` takes over as CURRENT.

Date: 2026-09-14, updated 2026-09-15 (tasks 25-29, an architecture review
pass, a pre-launch file/docs and UI audit, a follow-up canvas-specific
architecture deepening, a step-management-onto-the-canvas UX rework, and an
"Add to token"-into-Token-details UX rework), updated 2026-09-16 (a further
architecture review remediation, plus title/description max length limits),
updated 2026-09-17 (the `SvgButton` extraction, task 30's first ten real
user feedback passes, the `CollapsedField`/structured-Quantity deepening,
an external audit evaluation that fixed `TokenPicker`'s tab-semantics gap,
a PDF export rework that closed out Phase 4 task 37 early, an icon
library expansion with 12 new generic actions and 15 new ingredients, a
copy/paste-tokens feature, and a matching selected-panel border)
Scope: Phase 3, "Recipe Content & Launch" - reprioritized from the original
plan's "Generic Instruction Framework" (see
[../../project-plan.md](../../project-plan.md#implementation-plan)'s Phase 3
note). Rather than building a content-pack system before any one domain is
fully fleshed out, Phase 3 builds the recipe domain out fully - a much
larger icon library, aligned sample content, a UI polish pass - then
publishes and gets real users on it. Generalizing to a second domain (the
original Phase 3 scope: content packs, a theme system, second-domain
validation) moves to Phase 4, "Generalize," informed by what real recipe
usage actually needs rather than guessed upfront. See
[../../milestones.md](../../milestones.md) for the task-by-task status at a
glance, and [../../known-issues.md](../../known-issues.md) for two items
relevant to this phase: the export-filename collision (folded in here as
task 27) and the token/attachment vocabulary duplication (deliberately
still deferred, to Phase 4).

## Summary

Tasks 25-29 are done. The icon library grew from 12 recipe icons (Phase 2's
prototype set) to a curated "v1" list of 55 (18 actions, 28 objects, 9
tools), and `data/sample-tokens.ts` was expanded alongside it so every new
icon is actually reachable in `TokenPicker` (see
[tasks-25-26-icon-library.md](./tasks-25-26-icon-library.md)). An inline
document-title field was added to the toolbar, closing the
every-export-downloads-as-"untitled-instructions" gap tracked in
known-issues.md since task 18 - export filenames (and, as a bonus, the
browser tab title, which feeds the "Save as PDF" dialog's suggested
filename) now reflect the user's own title (see
[task-27-document-title-ui.md](./task-27-document-title-ui.md)). Task 28
was scoped with the user first (a "New document" action, a plainer toolbar
tagline, and a general audit-first visual/responsive sweep - explicitly
*not* the two accessibility gaps already tracked in known-issues.md, kept
deferred) and shipped the same way, extracting a shared
`useConfirmDialogFocusTrap` hook so the new confirm dialog and the
existing Import one stop duplicating the same keyboard-focus logic (see
[task-28-ui-polish-pass.md](./task-28-ui-polish-pass.md)). A same-day
`/mattpocock-skills:improve-codebase-architecture` review then surfaced
five more candidates; three were fixed (extracting `app.tsx`'s export/
import orchestration to `lib/document-actions.ts`, tightening
`useConfirmDialogFocusTrap`'s contract, and sharpening a known-issues.md
entry), one was deliberately deferred to Phase 4 task 32 with a concrete
trigger, and fixing the app.tsx extraction incidentally caught and fixed
a flaky Playwright driver check (see
[architecture-2026-09-14-review-remediation.md](./architecture-2026-09-14-review-remediation.md)).
A final pre-launch pass (also 2026-09-14, ahead of task 29) audited the
whole repo's file/docs hygiene (one stale README, one vestigial folder,
both fixed) and did a critical UI review, shipping six polish fixes: the
"Add to token" panel's dead gap and the canvas panel's oversized empty
state (one shared root cause, a CSS grid row-track coupling), a visually
grouped export/import toolbar tray, human-readable durations
("1h 30m" instead of "01h-30m-00s") everywhere one displays including
exported files, a deferred incomplete-step badge on untouched steps, and
stronger document-title field contrast - see
[pre-launch-file-and-ui-audit.md](./pre-launch-file-and-ui-audit.md). Two
further mobile-only findings were tracked instead of fixed, in
[known-issues.md](../../known-issues.md#mobile-layout-order-buries-the-canvas-below-an-empty-token-details-placeholder).
Task 29 (Publish MVP) shipped the same day: a source-grounded `vercel.json`
(a Content-Security-Policy plus 5 other headers, each directive checked
against what the app actually uses rather than guessed) and a live
deployment at <https://instructionbuilder-seven.vercel.app>, verified in a
real browser against the live URL - including Export PNG end-to-end, the
one flow that specifically depends on the CSP's `blob:` allowance. Git-based
push-to-deploy is connected too, verified via the Vercel API directly
rather than the CLI's own success message (see
[task-29-publish-mvp.md](./task-29-publish-mvp.md)) - every push to
`main` now deploys automatically. A same-day follow-up (2026-09-15) ran a
fresh, unbiased architecture review scoped specifically to the canvas
(`InstructionCanvas.tsx`/`lib/canvas-layout.ts`), deliberately not
re-confirming anything already deferred - it deepened `canvas-layout.ts`
so `computeCanvasLayout` is the module's whole interface (chip positions,
connector paths, and centering all come back on each step's layout now,
rather than `InstructionCanvas` computing them itself), while keeping the
drag-state-dependent `insertionMarkerPosition` as its own separate seam on
purpose - see
[architecture-2026-09-15-canvas-deepening.md](./architecture-2026-09-15-canvas-deepening.md).
A further same-day UX rework, settled via `/mattpocock-skills:grilling`,
moved step management (select/add/remove/reorder) off the standalone
`StepList` panel and onto the canvas itself - `StepList` is deleted, each
step card gained a title, a left-edge drag-handle-plus-move-up/down reorder
stack, a remove button, and a dashed "+ Add step" row inside the SVG - see
[step-management-moved-to-canvas.md](./step-management-moved-to-canvas.md).
A second same-day rework, via `/mattpocock-skills:grill-with-docs`, deleted
the standalone `TokenAttachmentPicker` ("Add to token", right column) the
same way, folding Quantity/Warning attaching into `TokenDetails`'s own
"Attachments" section as two always-visible rows (no more tabs), each
letting an already-attached value be changed directly without removing it
first - see
[token-attachments-folded-into-token-details.md](./token-attachments-folded-into-token-details.md).
A further `/mattpocock-skills:improve-codebase-architecture` pass
(2026-09-16) targeted what those two reworks grew - `InstructionCanvas.tsx`
and `state/document.ts` - and, via `/mattpocock-skills:grilling`, picked two
of its four candidates: `resolveTokenPointerOutcome`, a new function in
`lib/pointer-drag.ts` naming the two-stage select/drag decision that used
to be hand-rolled inline (and duplicated) across two of
`InstructionCanvas.tsx`'s `onDrop` closures, and deleting
`attachToSelectedToken` from `state/document.ts`, a wrapper that no longer
had a caller without `step`/`token` already in scope - see
[architecture-2026-09-16-review-remediation.md](./architecture-2026-09-16-review-remediation.md).
The same day, on request, a step's Title and a token's Title were capped at
50 characters and a step's Details and a token's Notes at 249, via a plain
`maxLength` prop on each field - see
[title-and-description-max-length.md](./title-and-description-max-length.md).
A 2026-09-17 pass picked up the 2026-09-15 canvas-followup review's other
candidate - the six hand-rolled keyboard-activatable SVG `<g role="button">`
blocks in `InstructionCanvas.tsx` - specifically because it's a
zero-UI-impact refactor, safe to ship while task 30 (Test Real Users) is
underway, unlike the mobile-layout known-issue also on the table. All six
are now a new `SvgButton` component, and
`.claude/skills/run-instruction-builder/driver.mjs` gained keyboard
(Enter/Space) coverage for the four sites it previously only clicked - see
[architecture-svgbutton-extraction.md](./architecture-svgbutton-extraction.md).
The same day, task 30 (Test Real Users) produced its first batch of actual
user feedback - five items, settled via `/mattpocock-skills:grilling` before
any code changed: the document title gained a 50-char cap (it had none), a
token's Title cap dropped from 50 to 18, a step's own duration moved from an
external reserved gap above its card to inline before its title (and that
external reservation is now gone, so the canvas is more compact, not just
visually rearranged), Token details' read-only icon-description line was
removed as redundant with the user's own Notes field (and deleted as dead
code, since nothing else rendered it), and a scrollbar-triggered desktop
layout shift was fixed with a breakpoint-scoped `scrollbar-gutter: stable`
(a first, unscoped attempt broke the mobile-overflow regression guard - see
the doc for why). See
[task-30-user-feedback-fixes.md](./task-30-user-feedback-fixes.md). A
second same-day batch targeted Token details' Token time/Quantity pair
specifically: their "TOKEN TIME"/"QUANTITY" labels were removed as
redundant with the fields' own controls (`DurationField` gained a
`showLabel` prop, defaulting to `true` so `StepDetails`' "Step time" keeps
its label), and "+ Quantity" moved inline next to "+ Time" in a new
`TimeAndQuantityRow` wrapper that also makes the two fields mutually
exclusive - opening one's edit form now closes the other's, via a single
`openField` state lifted above both. See
[task-30-user-feedback-fixes-2.md](./task-30-user-feedback-fixes-2.md). A
third same-day pass followed up on that fix: putting the two fields in one
row had introduced a reflow bug (opening either one's inline edit form
visibly shoved the other's collapsed button around), and separately
surfaced a pre-existing `DurationField` bug (its four day/hour/minute/
second inputs don't fit on one line at the sidebar's actual width, also
true of Step details' own Token time, not just the paired row). Both were
verified against the running dev server before being grilled into a fix:
Token time (everywhere it's used) and Quantity now open their edit forms
in a new `FieldPopover` - a small floating panel anchored below their
trigger button, extending `useConfirmDialogFocusTrap`'s keyboard pattern
to more than two controls - instead of expanding in place, which removes
the form from document flow entirely so a sibling field can no longer be
affected by it, and gives it enough width to lay out on one line. See
[task-30-user-feedback-fixes-3.md](./task-30-user-feedback-fixes-3.md). A
same-day architecture pass then deepened two of that work's own follow-on
candidates together: `DurationField` and TokenDetails' `QuantityRow`'s
duplicated collapsed/popover chrome moved into one shared `CollapsedField<T>`
module (each field now supplies only its own value display and a small
`DurationForm`/`QuantityForm`), and `QuantityRow`'s best-effort
`splitQuantity` reverse-parse was replaced by storing `amount`/`unit` as
structured fields on a new `QuantityAttachment`, mirroring how
`DurationAttachment` already carries its raw `seconds`. See
[architecture-2026-09-17-collapsedfield-and-structured-quantity.md](./architecture-2026-09-17-collapsedfield-and-structured-quantity.md).
A fourth same-day feedback pass followed immediately: the collapsed
"+ Token time" button was shortened back to "+ Time" (matching
`DurationField`'s own doc comment, which the two call sites had drifted
from), which also fixed a second report for free - "+ Time" and
"+ Quantity" now fit on one line in `TimeAndQuantityRow` without wrapping,
where "+ Token time" and "+ Quantity" together hadn't. See
[task-30-user-feedback-fixes-4.md](./task-30-user-feedback-fixes-4.md). A
fifth same-day pass, settled via `/mattpocock-skills:grill-me`, covered three
reports about the canvas heading: it now mirrors `document.value.meta.title`
read-only (matching the browser tab) instead of a static "Instructions"
label, gained a document-level total time (`sumDurations` over every step's
`stepDisplayedTime`) rendered as `{time} - {title}` the same way a step's own
duration already renders next to its title, and the `.instruction-canvas`
backdrop was capped to the SVG's actual `clamp(480px, 100%, 960px)` width at
wide viewports instead of overflowing to its right - the first cap attempt
(`max-width` plus `margin-inline: auto`) collapsed the card to a fraction of
its intended width instead, a CSS Grid shrink-to-fit/percentage-width
circularity caught and fixed (an explicit `width: min(...)` instead of
`max-width`) during verification, before the user ever saw it. See
[task-30-user-feedback-fixes-5.md](./task-30-user-feedback-fixes-5.md). A
sixth same-day pass, also grilled first, made `StepDetails`' "Tokens in this
step" list - kept only as a keyboard-accessibility affordance, since the
canvas's own token chips are pointer/touch-only - collapse into a native
`<details>`/`<summary>`, collapsed by default and resetting per step
(`key={step.id}`), so live-adding tokens to a step no longer visibly pushes
the `TokenDetails` panel down the column. See
[task-30-user-feedback-fixes-6.md](./task-30-user-feedback-fixes-6.md).
A same-day external audit evaluation (see
[reviews/2026-09-17-external-audit-evaluation.md](../reviews/2026-09-17-external-audit-evaluation.md))
independently re-verified a batch of claims from two documents dropped into
`reviews/check/`, applied two small doc-only fixes directly, and produced a
big/medium/small remediation plan; its first medium item was picked up the
same day, scoped via `/mattpocock-skills:grilling`: `TokenPicker`'s category
switcher, previously a half-implemented `role="tablist"`/`role="tab"`, is
now `role="radiogroup"`/`role="radio"` with real wrapping Left/Right
arrow-key navigation, a closer semantic fit than completing the tabs pattern
in place. Running the full Playwright driver for this also surfaced and
fixed an unrelated stale check (`TOKEN_SELECTED_VIA_KEYBOARD`, a driver bug
from the `<details>` collapse rework above, not a product regression). See
[accessibility-tokenpicker-radiogroup.md](./accessibility-tokenpicker-radiogroup.md).
A seventh same-day feedback pass, settled via `/mattpocock-skills:grill-me`
(a full 12-question design-tree interview), covered two unrelated reports:
token time was inflating a step's size the same way step time once did -
fixed the same way, by making `canvas-layout.ts`'s per-row time-label band
unconditional instead of only reserved for rows with a timed token - and
PDF export broke across multiple pages (steps cut in half, a blank leading
page). The PDF fix replaces `window.print()` with a real generated PDF
(jsPDF + svg2pdf.js, DIN A4, reusing the same hidden export canvas SVG/PNG
export already build), paginated by a new pure `lib/pdf-pagination.ts` that
greedily packs whole steps per page and never splits one - pulling forward
Phase 4 task 37 (Add Vector PDF Export (Stretch)) a full phase early, since
no print-CSS fix could satisfy "never cut a step" for content painted
inside one shared SVG. See
[task-30-user-feedback-fixes-7.md](./task-30-user-feedback-fixes-7.md). An
eighth same-day pass, also grilled first (after two rounds of sub-agent
fact-finding into what Lucide icons actually exist), expanded the icon
library again: 12 new generic action tokens (Add, Remove, Wait, Turn,
Attach, Detach, Repeat, Measure, Open, Close, Check, Adjust - all with
distinct real icons) and 15 new ingredient tokens (only 4 - Cherry,
Chicken, Ham, Wheat - had a real Lucide match; the other 11 share the
existing `genericFood` fallback icon already used for Garlic/Tomato/etc.,
per the user's own explicit "use placeholders" instruction rather than
broadening scope to non-ingredient foods with better icon coverage). See
[task-30-user-feedback-fixes-8.md](./task-30-user-feedback-fixes-8.md). A
ninth same-day pass, settled via `/mattpocock-skills:grill-with-docs` (the
first pass to run `domain-modeling` alongside `grilling`, adding a new
"Token clipboard" entry to `CONTEXT.md`), added copy/paste for tokens: a
new `copiedToken` signal on the document session plus `copyToken`/
`pasteToken` session actions, a Copy button in `TokenDetails`' header and a
Paste button in `StepDetails`' header (split across the two panels
deliberately, since Paste targets the selected *step* and must stay
reachable even with no token selected), and global `Ctrl+C`/`Ctrl+V`
shortcuts that skip text inputs so native text copy/paste still works. See
[task-30-user-feedback-fixes-9.md](./task-30-user-feedback-fixes-9.md). A
tenth same-day pass gave `StepDetails`/`TokenDetails` a selected-state
border matching the canvas's own selected-step highlight exactly (same
`var(--color-accent)` color, same 1px thickness): a `.step-details
--selected`/`.token-details--selected` modifier class, mutually exclusive
by construction - StepDetails carries it only while no token is also
selected, TokenDetails' one "editing" render branch only ever renders once
a token is. See
[task-30-user-feedback-fixes-10.md](./task-30-user-feedback-fixes-10.md).

## What shipped

One file per task (or per notable pass), in task-number order:

| # | Task | File |
|---|---|---|
| 25 | Expand Recipe Icon Library (curated v1) | [tasks-25-26-icon-library.md](./tasks-25-26-icon-library.md) |
| 26 | Expand Sample/Starter Tokens | [tasks-25-26-icon-library.md](./tasks-25-26-icon-library.md) |
| 27 | Add Document Title UI | [task-27-document-title-ui.md](./task-27-document-title-ui.md) |
| 28 | UI Polish Pass | [task-28-ui-polish-pass.md](./task-28-ui-polish-pass.md) |
| — | Architecture: 2026-09-14 review remediation (`lib/document-actions.ts` extraction, `useConfirmDialogFocusTrap` prop-bag contract, a `known-issues.md` sharpening, and a flaky driver check fixed) | [architecture-2026-09-14-review-remediation.md](./architecture-2026-09-14-review-remediation.md) |
| — | Pre-launch file/docs audit and UI polish follow-up (stale README, vestigial `tests/`, grid layout fix, toolbar grouping, human-readable durations, deferred incomplete-step badge, document-title contrast) | [pre-launch-file-and-ui-audit.md](./pre-launch-file-and-ui-audit.md) |
| 29 | Publish MVP | [task-29-publish-mvp.md](./task-29-publish-mvp.md) |
| — | Architecture: 2026-09-15 canvas deepening (`computeCanvasLayout` becomes `canvas-layout.ts`'s whole interface; `insertionMarkerPosition` kept as a separate seam) | [architecture-2026-09-15-canvas-deepening.md](./architecture-2026-09-15-canvas-deepening.md) |
| — | UX: step management moved onto the canvas (StepList deleted; title, reorder stack, remove, add-step row now live in InstructionCanvas.tsx) | [step-management-moved-to-canvas.md](./step-management-moved-to-canvas.md) |
| — | UX: "Add to token" folded into Token details (TokenAttachmentPicker deleted; Quantity/Warning are always-visible rows in TokenDetails.tsx, changeable without removing first) | [token-attachments-folded-into-token-details.md](./token-attachments-folded-into-token-details.md) |
| — | Architecture: 2026-09-16 review remediation (`resolveTokenPointerOutcome` names the select/drag decision in `lib/pointer-drag.ts`; `attachToSelectedToken` deleted from `state/document.ts`) | [architecture-2026-09-16-review-remediation.md](./architecture-2026-09-16-review-remediation.md) |
| — | Title/description max length limits (step and token Title capped at 50 characters, step Details and token Notes at 249) | [title-and-description-max-length.md](./title-and-description-max-length.md) |
| — | Architecture: extract `SvgButton` (six duplicated keyboard-activatable SVG `<g role="button">` blocks in `InstructionCanvas.tsx` unified into one component; driver gained Enter/Space coverage for four sites) | [architecture-svgbutton-extraction.md](./architecture-svgbutton-extraction.md) |
| 30 | Test Real Users (in progress - ten feedback passes shipped) | [task-30-user-feedback-fixes.md](./task-30-user-feedback-fixes.md), [task-30-user-feedback-fixes-2.md](./task-30-user-feedback-fixes-2.md), [task-30-user-feedback-fixes-3.md](./task-30-user-feedback-fixes-3.md), [task-30-user-feedback-fixes-4.md](./task-30-user-feedback-fixes-4.md), [task-30-user-feedback-fixes-5.md](./task-30-user-feedback-fixes-5.md), [task-30-user-feedback-fixes-6.md](./task-30-user-feedback-fixes-6.md), [task-30-user-feedback-fixes-7.md](./task-30-user-feedback-fixes-7.md), [task-30-user-feedback-fixes-8.md](./task-30-user-feedback-fixes-8.md), [task-30-user-feedback-fixes-9.md](./task-30-user-feedback-fixes-9.md), [task-30-user-feedback-fixes-10.md](./task-30-user-feedback-fixes-10.md) |
| — | Architecture: `CollapsedField<T>` extraction (DurationField/QuantityRow's duplicated collapsed/popover chrome unified) plus structured Quantity (`QuantityAttachment` replaces `splitQuantity`'s reverse-parse) | [architecture-2026-09-17-collapsedfield-and-structured-quantity.md](./architecture-2026-09-17-collapsedfield-and-structured-quantity.md) |
| — | External audit evaluation (`reviews/check/` claims independently re-verified; two doc-only fixes applied; remediation plan produced) plus `TokenPicker`'s tab-semantics fix (`role="radiogroup"`/`role="radio"` with wrapping arrow-key nav) and a stale driver check fixed along the way | [reviews/2026-09-17-external-audit-evaluation.md](../reviews/2026-09-17-external-audit-evaluation.md), [accessibility-tokenpicker-radiogroup.md](./accessibility-tokenpicker-radiogroup.md) |
| 31 | Refine UX | *not started* |

## Verification

- `npm run lint`, `npm run typecheck`, `npm test` (141 tests - the
  pre-launch audit only updated 3 existing `duration.test.ts` assertions'
  expected strings for the new human-readable format; the canvas deepening
  added 1 net new case to `canvas-layout.test.ts` while porting the rest
  through `computeCanvasLayout`; the step-management rework added 2 more;
  the "Add to token" rework added none - it moved already-tested state
  mutators around without adding new logic; the 2026-09-16 architecture
  remediation added 4 `resolveTokenPointerOutcome` cases to
  `pointer-drag.test.ts` and removed 1 orphaned `attachToSelectedToken`
  case from `document.test.ts`, net +3; the `SvgButton` extraction added
  none - a component-only refactor with no new `lib`/`state` logic; the
  task 30 feedback passes updated 1 existing `canvas-layout.test.ts`
  assertion for the deleted `headerHeight` field (first pass) and added
  none (second through sixth passes - component-only/CSS refactors, same
  as `SvgButton`), net 0 across all six; the `TokenPicker` radiogroup fix
  added none either - same kind of component-only change, with new
  coverage instead going into the Playwright driver (a new
  `TOKEN_CATEGORY_ARROW_KEY_NAV_WORKS` check, plus a stale
  `TOKEN_SELECTED_VIA_KEYBOARD` check fixed); the `CollapsedField`/structured-
  Quantity deepening added none either - same kind of component/data-shape
  refactor with no new branchable logic; the seventh feedback pass's token-
  time fix rewrote `canvas-layout.test.ts`'s "token time labels" describe
  block, net -2, and its PDF pagination rework added a new
  `pdf-pagination.test.ts`, +6, for a net +4 that pass; the eighth pass's
  icon library expansion added none - a pure data addition to two lookup
  tables, verified live in a browser instead; the ninth pass's copy/paste
  feature added a new `copyToken / pasteToken` describe block to
  `document.test.ts`, +6; the tenth pass's selected-panel border added
  none - a pure CSS/class-name change verified live in a browser instead),
  and `npm run build` all pass cleanly.
- See each task's own file above for full verification detail
  (browser-driven checks, bundle size deltas, and the decisions made along
  the way).

## What's next

See [../../milestones.md](../../milestones.md) for the current status at a
glance, or the full task list in
[../../project-plan.md](../../project-plan.md#step-by-step-project-tasks).
Tasks 25-29 are done. Task 30 (Test Real Users) is next.
