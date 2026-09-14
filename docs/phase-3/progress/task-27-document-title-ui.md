# Task 27: Add Document Title UI

> 📌 **Doc status: CURRENT** — one file in the
> [Phase 3 Progress Log](./README.md).

Date: 2026-09-14

## What shipped

An inline text field in the toolbar's `.app__titles` region (below the app
name/tagline, above the Undo/Redo/export controls), bound directly to
`InstructionDocument.meta.title` - the field every export filename is
already derived from (`slugify` in
[lib/document-file.ts](../../../src/lib/document-file.ts)). This closes a
gap tracked in known-issues.md since task 18: `meta.title` existed in the
model from Phase 1 but nothing ever wrote to it, so every export from
every document downloaded as the same `untitled-instructions.<ext>`,
colliding the moment a user exported a second document or format.

- [state/document.ts](../../../src/state/document.ts): new `updateTitle`
  mutator, mirroring `setSteps`'s coalescing/`updatedAt` handling
  (`updateStepTitle` already used the same pattern for a step's own
  title) but updating `meta` instead of `steps`.
- [app.tsx](../../../src/app.tsx): the input itself - a controlled field
  (`value={document.value.meta.title}`, `onInput` calling `updateTitle`),
  same style as `StepDetails`' title/description fields. Also placed
  first past a two-week non-goal check: the field lives inside
  `.app__titles`, which was already `flex: 1 1 200px; min-width: 0` -
  exactly the flex behavior an input needs to shrink instead of
  overflowing on narrow viewports, per task 21's own hard-won lesson
  about this toolbar row.
- **Bonus, same task:** a small `useDocumentTitleSync` effect (using
  `@preact/signals`' own `effect()`, not `useEffect`'s dependency array,
  since `App` doesn't otherwise re-render on every document change) keeps
  the browser tab's `<title>` synced to `meta.title` too. This closes the
  one export path `meta.title` couldn't reach before: `window.print()`
  (Export PDF, task 17) has no filename of its own to derive, and the
  browser's native "Save as PDF" dialog was suggesting this app's static
  title instead of the document's.
- Drive-by fix: the toolbar's static tagline ("Phase 2 — instruction
  canvas") was stale since Phase 2 closed out - updated to "Phase 3 —
  recipe builder" in the same edit, since it sits directly above the new
  field.

## Verification

- `npm run lint`, `npm run typecheck`, `npm test` (115 tests, 2 new -
  `updateTitle` updates `meta.title` and is undoable; it doesn't touch
  `steps`), and `npm run build` all pass. Bundle size effectively
  unchanged (89.37 kB JS / 26.82 kB gzip, up from 88.86 / 26.70 - a single
  input field and effect).
- Verified in a real browser (dev server): the field shows the existing
  `"Untitled instructions"` default on load, typing a new title updates
  it live, the browser tab title updates to match, `Ctrl+Z` undoes the
  whole typed string as one coalesced entry (same behavior as every other
  free-text field in this app) restoring the original title, and - the
  actual point of this task - clicking Export JSON after setting the
  title to "Weeknight Pasta" downloads `weeknight-pasta.json` instead of
  `untitled-instructions.json`.
- Checked for the toolbar-overflow regression this app has hit twice
  before (task 21's audit, see
  [../../fixed-issues/toolbar-export-buttons-overflow-on-phones.md](../../fixed-issues/toolbar-export-buttons-overflow-on-phones.md)):
  at a 390px mobile viewport, `document.documentElement.scrollWidth`
  equals `clientWidth` (no horizontal overflow) - screenshotted and
  confirmed the field wraps to full width below the app name, above the
  toolbar buttons, rather than forcing anything off-screen.
- Zero console errors throughout.

## What's next

See [README.md](./README.md) for Phase 3's overall status. Task 28 (UI
Polish Pass) is next.
