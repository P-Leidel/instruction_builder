# Task 28: UI Polish Pass

> 📌 **Doc status: CURRENT** — one file in the
> [Phase 3 Progress Log](./README.md).

Date: 2026-09-14

Scoped with the user first (see the scoping discussion referenced from
[README.md](./README.md)) into three concrete items, deliberately
excluding the two accessibility gaps already tracked in
[../../known-issues.md](../../known-issues.md) (kept deferred, per that
discussion) - plus a general audit-first visual/responsive sweep across
app states before publishing, the same way tasks 21/22 were run.

## What shipped

### 1. Add a "New document" action

There was previously no way to start a fresh document short of clearing
browser storage - `createEmptyDocument()`
([model/instruction.ts](../../../src/model/instruction.ts)) existed only
as the document session's own throwaway default before a saved document
loads, never wired to any UI. A tester with only one permanent document
and no way to reset it is a real gap for task 30 (Test Real Users).

- A "New" button in the toolbar's `.app__file-controls` (first in the
  group, before Export JSON) sets a new `confirmingNewDocument` signal
  ([state/ui.ts](../../../src/state/ui.ts)).
- **`NewDocumentConfirmDialog`** (new component) gates the actual reset
  behind an explicit confirm, deliberately mirroring `ImportConfirmDialog`
  (task 19) - same "this will replace everything, you can undo it
  afterward" framing, since it's the same "confirm a destructive replace"
  shape that dialog already established. Confirming calls
  `replaceDocument(createEmptyDocument())` - the same session action
  Import uses - so starting over is recorded in undo history like any
  other document change, not a special-cased reset.
- **Extracted `useConfirmDialogFocus`**
  ([lib/dialog-focus.ts](../../../src/lib/dialog-focus.ts)):
  `ImportConfirmDialog`'s focus-on-open/Tab-trap/Escape-to-cancel logic
  was about to be copy-pasted a second time for the new dialog - pulled
  into one shared hook instead (both dialogs now use it), the same
  duplication threshold this codebase has already applied elsewhere (e.g.
  `createClickAfterDragGuard` in `lib/pointer-drag.ts`, extracted on its
  second use). `ImportConfirmDialog` was refactored to use it too, so
  there's exactly one copy of this keyboard behavior instead of two
  near-identical ones.
- The `.import-confirm-*` CSS classes were renamed to `.confirm-dialog-*`
  (generic) rather than adding a parallel, near-identical set of "new
  document" classes - both dialogs now share one set of styles.
  `.claude/skills/run-instruction-builder/driver.mjs` was updated to match
  (it asserted against the old class names directly).

### 2. Reword the toolbar tagline

Task 27 had set it to "Phase 3 — recipe builder" - internal project-phase
language a real tester has no reason to understand, and which read as
unfinished. Changed to "Build step-by-step recipe instructions" - a plain
description of what the app does, no project/phase language.

### 3. General audit-first visual/responsive sweep

Screenshotted and reviewed: a populated document (title set, two steps,
an attached token) at desktop width; the New Document confirm dialog; a
toast visible alongside the now-6-button toolbar; Preview mode; and the
same populated state at a 390px mobile viewport. Also re-screenshotted the
Import confirm dialog (already covered by the driver) to confirm it still
renders correctly after the class rename. No new issues found - the
toolbar's existing `flex-wrap` handling (task 21) absorbed the 6th button
(New) cleanly at every width checked, and every state reviewed was
visually consistent with the rest of the app. One thing confirmed
*intentional, not a gap*: the toolbar (including the new title field and
New button) stays visible and interactive during Preview mode, same as
Undo/Redo/Export always have - Preview only swaps `.app__main`'s content
for a read-only canvas, never the toolbar itself, so this matches existing
behavior rather than being a new inconsistency.

## Verification

- `npm run lint`, `npm run typecheck`, `npm test` (115 tests, unchanged),
  and `npm run build` all pass. Bundle grew marginally (90.55 kB JS /
  26.96 kB gzip, up from 89.37 / 26.82 - one new component, one new hook,
  one new toolbar button).
- The full Playwright driver (39 checks, including the Import dialog's
  focus-trap/Escape-close checks) passes cleanly against the renamed
  classes and refactored `ImportConfirmDialog`, confirming the shared-hook
  extraction didn't change its behavior - zero console errors, zero
  axe-core violations.
- New Document flow verified directly in a real browser: clicking "New"
  opens the dialog; Escape cancels with the document untouched; confirming
  ("Start New") replaces the document (title back to "Untitled
  instructions", step count back to 1); `Ctrl+Z` undoes it, restoring the
  exact previous document (title and step count both back); no console
  errors throughout.
- Mobile-width overflow re-checked with the new 6-button toolbar:
  `document.documentElement.scrollWidth` equals `clientWidth` at 390px -
  no regression of the overflow bug this toolbar has hit twice before (see
  [../../fixed-issues/toolbar-export-buttons-overflow-on-phones.md](../../fixed-issues/toolbar-export-buttons-overflow-on-phones.md)).

## What's next

See [README.md](./README.md) for Phase 3's overall status. Task 29
(Publish MVP) is next.
