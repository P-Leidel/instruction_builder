# Milestones

> 📌 **Doc status: CURRENT** — this is the single living, canonical status
> tracker for the whole project. Update it in the same edit that changes
> any task's status; see "Documentation status conventions" below for how
> this doc relates to every other doc in `docs/`.

**Current status (2026-09-13): Phase 2 (MVP) is in progress.** Phase 1
(Concept Validation) is complete. Of Phase 2's 20 tasks, 5–12 are done;
task 13 (Undo/Redo) is next.

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
interaction model. See [phase-1/Status-Report.md](./phase-1/Status-Report.md).

## Phase 2: MVP — 🔶 In progress (8 of 20 tasks complete)

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
| 13 | Implement Undo/Redo | ▶️ Next |
| 14 | Implement Visual Validation | 🔶 Partial — a Phase 1 stub (`src/model/validate.ts`) checks only "has an action token"; the full rule set from this task is still open |
| 15 | Develop SVG Export | Not started |
| 16 | Develop PNG Export | Not started |
| 17 | Implement Print/PDF Export | Not started |
| 18 | Implement JSON Export | Not started |
| 19 | Create Import System | Not started |
| 20 | Add Automated Testing | Not started |
| 21 | Build Responsive Layouts | Not started |
| 22 | Add Accessibility Features | Not started |
| 23 | Convert to PWA | Not started |
| 24 | Optimize Performance | Not started |

See [phase-2/Progress-Log.md](./phase-2/Progress-Log.md) for what actually
shipped in tasks 5–12, plus product additions beyond the original task
list (step titles/details, per-token descriptions, two-stage step/token
selection, connector lines, the live drag insertion marker, a CSS
design-token visual refresh, and token/step attachments - a validated
Quantity amount+unit, a Warning, and an independent Step/Token duration
shown centered above each step). See [Fixed-Issues.md](./Fixed-Issues.md)
for bugs found and fixed along the way (none currently open against this
work - see [Known-Issues.md](./Known-Issues.md) for what *is* still open).

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
[Visual-Instruction-Builder-Project-Plan.md](./Visual-Instruction-Builder-Project-Plan.md#step-by-step-project-tasks).
This file exists so "what phase are we actually in" has one answer instead
of needing to be reconciled across several docs.

## Documentation status conventions

Every doc in `docs/` carries a one-line status banner directly under its
title, using exactly one of two labels, so nobody has to read a doc's body
to find out whether it still describes the real app:

- **📌 CURRENT** — actively trusted. Either a *living* doc that gets
  updated in the same change that makes it stale (this file,
  [Known-Issues.md](./Known-Issues.md), [Fixed-Issues.md](./Fixed-Issues.md),
  [Planned-Additions.md](./Planned-Additions.md), and whichever
  `phase-N/Progress-Log.md` covers the in-progress phase), or a *reference*
  doc that doesn't change per-task but whose content is still accurate
  ([Visual-Instruction-Builder-Project-Plan.md](./Visual-Instruction-Builder-Project-Plan.md)).
- **🗄️ HISTORICAL — superseded** — a frozen snapshot of a completed phase.
  It stops being edited the day that phase closes out, is dated with the
  freeze date, and links back here for what's actually true now. Nothing
  under `phase-1/` is edited anymore for this reason.

**The rule going forward:** the day a phase's exit criteria are met, that
phase's `Progress-Log.md` gets its banner flipped from CURRENT to
HISTORICAL (dated), and a new `phase-N+1/Progress-Log.md` is created,
banner-marked CURRENT, and linked from the relevant phase table above in
the same edit that marks the old phase's tasks ✅ here. That keeps exactly
one Progress-Log CURRENT at any time, instead of letting several
phase logs quietly go stale side by side.
