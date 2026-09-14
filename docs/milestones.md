# Milestones

> 📌 **Doc status: CURRENT** — this is the single living, canonical status
> tracker for the whole project. Update it in the same edit that changes
> any task's status; see "Documentation status conventions" below for how
> this doc relates to every other doc in `docs/`.

**Current status (2026-09-14): Phase 2 (MVP) is in progress.** Phase 1
(Concept Validation) is complete. Of Phase 2's 20 tasks, 5–22 are done -
tasks 18/19 (JSON Export, Import) were deliberately pulled ahead of 15–17
(SVG/PNG/Print export) on request, since a working JSON round-trip makes
both automated and manual testing of everything else easier. Task 15
(SVG Export) picked the original order back up and also folded in an
external audit's recommended prep work (lifting the canvas's layout math
into its own module, `lib/canvas-layout.ts`, before building export on top
of it); task 16 (PNG Export) reused that same SVG pipeline, rasterized via
an offscreen `<canvas>`; task 17 (Print/PDF Export) shipped the plan's
baseline tier (`window.print()` + a `@media print` stylesheet), reusing
that same hidden export canvas as the print source and deferring the
vector-PDF stretch tier to Phase 4 as planned. Task 20 (Automated Testing)
was preceded by two `/improve-codebase-architecture` passes it was
explicitly blocked on (a constructable document session, and a drag-and-
drop protocol collapse), then shipped 107 Vitest unit tests covering the
instruction model, the document session's undo/redo, and pure `lib/` logic
- deliberately not the export pipeline/persistence/components, which stay
covered by the existing Playwright driver instead (see
[phase-2/plans/task-20-automated-testing-plan.md](./phase-2/plans/task-20-automated-testing-plan.md)
for the full scope reasoning) - and wired `npm test` into CI. Task 21
(Build Responsive Layouts) was run as an audit first - a lot of mobile
handling had already landed opportunistically in earlier tasks - and found
and fixed three real narrow-viewport overflow bugs, plus reclaimed canvas
room right above the desktop breakpoint (see
[phase-2/progress/task-21-responsive-layouts.md](./phase-2/progress/task-21-responsive-layouts.md)).
Task 22 (Add Accessibility Features) was also run audit-first (an axe-core
scan plus a manual keyboard walkthrough, scoped with the user beforehand)
and fixed a WCAG color-contrast failure, a missing form label, and two real
keyboard-reachability gaps - no keyboard way to reorder a step, and no
keyboard way to select a token at all - the latter found by reading the
code before the audit even started, not by either the plan or axe-core
(see [phase-2/progress/task-22-accessibility-features.md](./phase-2/progress/task-22-accessibility-features.md)).
Task 23 (Convert to PWA) is next.

This file is the single source of truth for "what phase are we in" -
update it whenever a task's status changes, rather than letting that
information live only in scattered per-file mentions (which is exactly
what made an earlier independent review's status hard to pin down before
this file existed).

## Phase 1: Concept Validation — ✅ Complete

| # | Task | Status |
|---|---|---|
| 1 | Define Instruction Model | ✅ |
| 2 | Design User Experience | ✅ |
| 3 | Create Wireframes | ✅ |
| 4 | Build Project Foundation | ✅ |

Exit criterion met: an in-memory clickable prototype validated the
interaction model. See [phase-1/status-report.md](./phase-1/status-report.md).

## Phase 2: MVP — 🔶 In progress (18 of 20 tasks complete)

| # | Task | Status |
|---|---|---|
| 5 | Create UI Layout | ✅ |
| 6 | Implement Instruction Canvas | ✅ |
| 7 | Build Icon Library | ✅ |
| 8 | Create Live Preview | ✅ |
| 9 | Add Drag-and-Drop System | ✅ |
| 10 | Implement Touch Support | ✅ |
| 11 | Add Tap-to-Insert System | ✅ (carried over from Phase 1's `TokenPicker`, never needed rework) |
| 12 | Build Data Persistence | ✅ |
| 13 | Implement Undo/Redo | ✅ |
| 14 | Implement Visual Validation | ✅ (the two rules already covered by the Phase 1 stub turned out to be the full applicable rule set; [phase-1/architecture.md](./phase-1/architecture.md)'s third rule, a numeric quantity `metadata` check, is superseded - not simply dropped - now that Quantity is a `TokenAttachment` with a fused display label rather than a token with numeric metadata - see below) |
| 15 | Develop SVG Export | ✅ (also lifted the canvas's layout math into `lib/canvas-layout.ts`, per an external audit - see below) |
| 16 | Develop PNG Export | ✅ (rasterizes the same SVG pipeline via an offscreen `<canvas>`, 2x pixel density) |
| 17 | Implement Print/PDF Export | ✅ (baseline tier only - `window.print()` + `@media print`; vector PDF stretch tier deferred to Phase 4, per plan) |
| 18 | Implement JSON Export | ✅ (built ahead of 15–17, on request) |
| 19 | Create Import System | ✅ (built ahead of 15–17, on request) |
| 20 | Add Automated Testing | ✅ (Vitest, 107 tests over the instruction model/document session/pure `lib/` logic; export pipeline/persistence/components deliberately left to the Playwright driver - see [phase-2/plans/task-20-automated-testing-plan.md](./phase-2/plans/task-20-automated-testing-plan.md)) |
| 21 | Build Responsive Layouts | ✅ (audit-first pass; found and fixed 3 real overflow bugs plus a desktop-breakpoint canvas-crowding improvement - see [phase-2/progress/task-21-responsive-layouts.md](./phase-2/progress/task-21-responsive-layouts.md)) |
| 22 | Add Accessibility Features | ✅ (audit-first pass with axe-core + a manual keyboard walkthrough; fixed a WCAG contrast failure, a missing form label, and keyboard-reachability gaps for step reorder and token select - see [phase-2/progress/task-22-accessibility-features.md](./phase-2/progress/task-22-accessibility-features.md)) |
| 23 | Convert to PWA | ▶️ Next |
| 24 | Optimize Performance | Not started |

See [phase-2/progress/README.md](./phase-2/progress/README.md) for what actually
shipped in tasks 5–22, plus product additions beyond the
original task list (step titles/details, per-token descriptions, two-stage
step/token selection, connector lines, the live drag insertion marker, a
CSS design-token visual refresh, and token/step attachments - a validated
Quantity amount+unit, a Warning, and an independent Step/Token duration
shown centered above each step). See [fixed-issues/README.md](./fixed-issues/README.md)
for bugs found and fixed along the way (none currently open against this
work) and [known-issues.md](./known-issues.md) for what's deliberately
deferred - including a new one from task 18: every export format downloads
as "untitled-instructions.\<ext\>" because no UI lets the user set
`meta.title` yet.

## Phase 3: Generic Instruction Framework — Not started

| # | Task | Status |
|---|---|---|
| 25 | Create Content Pack System | Not started |
| 26 | Create Theme System | Not started |
| 27 | Validate a Second Domain | Not started |

## Phase 4: Polish — Not started

| # | Task | Status |
|---|---|---|
| 28 | Add Vector PDF Export (Stretch) | Not started |
| 29 | Add Basic Gamification (Optional) | Not started |
| 30 | Test Real Users | Not started |
| 31 | Refine UX | Not started |
| 32 | Publish MVP | Not started |
| 33 | Prepare Future Expansion | Not started |

---

Full task descriptions live in
[project-plan.md](./project-plan.md#step-by-step-project-tasks).
This file exists so "what phase are we actually in" has one answer instead
of needing to be reconciled across several docs.

## Documentation status conventions

Every doc in `docs/` carries a one-line status banner directly under its
title, using exactly one of two labels, so nobody has to read a doc's body
to find out whether it still describes the real app:

- **📌 CURRENT** — actively trusted. Either a *living* doc that gets
  updated in the same change that makes it stale (this file,
  [known-issues.md](./known-issues.md), [fixed-issues/README.md](./fixed-issues/README.md),
  [planned-additions.md](./planned-additions.md), and whichever
  `phase-N/progress/README.md` covers the in-progress phase), or a *reference*
  doc that doesn't change per-task but whose content is still accurate
  ([project-plan.md](./project-plan.md)).
- **🗄️ HISTORICAL — superseded** — a frozen snapshot of a completed phase.
  It stops being edited the day that phase closes out, is dated with the
  freeze date, and links back here for what's actually true now. Nothing
  under `phase-1/` is edited anymore for this reason.

**The rule going forward:** the day a phase's exit criteria are met, that
phase's `progress/README.md` gets its banner flipped from CURRENT to
HISTORICAL (dated), and a new `phase-N+1/progress/README.md` is created,
banner-marked CURRENT, and linked from the relevant phase table above in
the same edit that marks the old phase's tasks ✅ here. That keeps exactly
one Progress Log CURRENT at any time, instead of letting several
phase logs quietly go stale side by side.

## Documentation naming conventions

Every file and folder under `docs/` is lowercase kebab-case, named for what
it's for (e.g. `known-issues.md`, `fixed-issues/`, `phase-2/plans/`) - never
a generic label, and never the product name repeated in the filename. A doc
that's too big to read comfortably in one piece gets split into a folder
along whatever seam the content already has (one file per bug in
`fixed-issues/`, one file per task in each phase's `progress/`), with a
`README.md` in that folder acting as the index other docs link to. One-off
dated documents (a code review, an external audit) live in a subfolder named
for what kind of document it is (`phase-N/reviews/`, `phase-N/audits/`), not
loose in the phase folder. When a doc moves or is renamed, every link to it
- across `docs/`, source comments, and every other file in the repo - gets
updated in the same change, so links never go stale; nothing here is kept
around as a compatibility redirect.
