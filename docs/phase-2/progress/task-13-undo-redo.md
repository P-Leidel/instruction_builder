# Task 13 — Undo/Redo

> 📌 **Doc status: CURRENT** — one file in the
> [Phase 2 Progress Log](./README.md).

- History is snapshot-based, not a command/diff log: `state/document.ts` keeps `past`/`future` arrays of whole `InstructionDocument` values (capped at 100 entries), since the document is small enough that this is simpler and safer than reconstructing state from individual mutations. `setSteps` — the single funnel every mutator already goes through — records the pre-change snapshot before applying each update, so undo/redo needed no changes to any individual mutator's own logic, only to the shared funnel.
- **Coalescing free-text edits:** `updateStepTitle`/`updateStepDescription`/`updateTokenLabel`/`updateTokenNote` call their mutator on every keystroke (no local draft state, unlike `DurationField`/`QuantityForm`), so recording history on every call would make undo revert one character at a time. Those four mutators pass `coalesce: true`, which merges a run of calls arriving within 700ms of each other into the single history entry already pushed for the first one — a whole burst of typing undoes in one step, and only a pause longer than the window (or an intervening undo/redo, which always forces a fresh entry) starts a new one. Every other mutator (add/remove/move/attach/etc.) always pushes its own entry, matching that each is already one discrete user action.
- Restoring a snapshot (`restoreDocument`) re-resolves `selectedStepId`/`selectedTokenId` against it rather than resetting them outright: the current selection survives an undo/redo that didn't touch it (e.g. undoing an edit to a different step), falling back to the first step (and clearing the token) only if the selected one no longer exists in the restored document.
- Toolbar gained **Undo**/**Redo** buttons (disabled via `canUndo`/`canRedo` computed signals when there's nothing to do), plus `Ctrl+Z`/`Ctrl+Shift+Z` (and `Ctrl+Y` as the common Windows redo alternate) global keyboard shortcuts in `App`, which call `preventDefault` so the browser's own per-field undo doesn't also fire on whatever input has focus.

## Files touched — Undo/Redo (task 13)

- `src/state/document.ts` — added `past`/`future` signals, `canUndo`/`canRedo` computed, `undo`/`redo`, and the `recordHistory`/`restoreDocument` helpers; `setSteps` now takes an optional `{ coalesce }` and calls `recordHistory` before applying each change; `updateStepTitle`/`updateStepDescription`/`updateTokenLabel`/`updateTokenNote` pass `coalesce: true`.
- `src/app.tsx` — added the Undo/Redo toolbar buttons and a `useHistoryKeyboardShortcuts` hook wiring `Ctrl+Z`/`Ctrl+Shift+Z`/`Ctrl+Y`.
- `src/styles/global.css` — `.app__history-controls`/`.app__history-button` styles (including a `:disabled` state).
- `.claude/skills/run-instruction-builder/driver.mjs`, `SKILL.md` — new undo/redo regression checks (`HISTORY_BUTTONS_DISABLED_INITIALLY`, `UNDO_REDO_WORKED_END_TO_END`), documented in the skill description and console-output list.
