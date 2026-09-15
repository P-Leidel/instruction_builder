# Phase 3 Progress Log — Tasks 25 through 31

> 📌 **Doc status: CURRENT** — living index for the in-progress phase,
> updated as tasks land. Per the convention in
> [../../milestones.md](../../milestones.md#documentation-status-conventions),
> this gets frozen with a HISTORICAL banner the day Phase 3 closes out, and
> a new `phase-4/progress/README.md` takes over as CURRENT.

Date: 2026-09-14, updated 2026-09-15 (tasks 25-29, an architecture review
pass, a pre-launch file/docs and UI audit, a follow-up canvas-specific
architecture deepening, a step-management-onto-the-canvas UX rework, and an
"Add to token"-into-Token-details UX rework)
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
| 30 | Test Real Users | *not started* |
| 31 | Refine UX | *not started* |

## Verification

- `npm run lint`, `npm run typecheck`, `npm test` (128 tests - the
  pre-launch audit only updated 3 existing `duration.test.ts` assertions'
  expected strings for the new human-readable format; the canvas deepening
  added 1 net new case to `canvas-layout.test.ts` while porting the rest
  through `computeCanvasLayout`; the step-management rework added 2 more;
  the "Add to token" rework added none - it moved already-tested state
  mutators around without adding new logic), and `npm run build` all pass
  cleanly.
- See each task's own file above for full verification detail
  (browser-driven checks, bundle size deltas, and the decisions made along
  the way).

## What's next

See [../../milestones.md](../../milestones.md) for the current status at a
glance, or the full task list in
[../../project-plan.md](../../project-plan.md#step-by-step-project-tasks).
Tasks 25-29 are done. Task 30 (Test Real Users) is next.
