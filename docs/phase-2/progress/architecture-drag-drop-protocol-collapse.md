# Architecture — drag-and-drop protocol collapse (pre-work for Task 20)

> 📌 **Doc status: CURRENT** — one file in the
> [Phase 2 Progress Log](./README.md).

- A second `/improve-codebase-architecture` candidate, done immediately after the [document-session refactor](./architecture-document-session-refactor.md): the same external audit had flagged the drag-and-drop protocol as duplicated across four modules - `lib/pointer-drag.ts`'s `TokenDropTarget` and `state/drag.ts`'s `DropTarget` were structurally identical types (down to an identical comment); `StepList.tsx` and `TokenPicker.tsx` each independently declared their own module-level `justDragged` flag for the same "suppress the browser's trailing click after a real drag" purpose; and the "drop-before index in a pre-removal array" off-by-one correction was hand-written once each in `moveTokenCore` and `reorderStepsCore` (`state/document.ts`).
- Scoped deliberately to three surgical fixes rather than a full redesign, after weighing (and rejecting) unifying all three drag call sites - including `InstructionCanvas.tsx`'s own inline drag block - behind one shared hook: `InstructionCanvas` doesn't use `justDragged`/`onClick` at all (it folds the click-vs-drag decision directly into `onDrop`'s `wasDrag` check), a genuine behavioral difference from `StepList`/`TokenPicker`, not incidental duplication - forcing it into the same shared helper would have meant adding a branch for a case that doesn't need one.
- `lib/pointer-drag.ts` gained `createClickAfterDragGuard()`, a plain factory function (matching `beginPointerDrag`/`resolveTokenDropTarget`'s existing non-hook style, since `justDragged` was always module-scope state, not per-render component state) returning `{ wasJustDragged(), markDragged() }`; both `StepList.tsx` and `TokenPicker.tsx` now call it once at module scope instead of declaring their own `let`.
- `state/drag.ts`'s `DropTarget` interface was deleted; the `dropTarget` signal is now typed as `TokenDropTarget`, imported from `lib/pointer-drag.ts` - confirmed via a repo-wide search that nothing outside `state/drag.ts` ever imported the `DropTarget` name, so this needed no other call-site changes.
- `state/document.ts` gained an unexported `adjustIndexForRemoval(fromIndex, toIndexBeforeRemoval)`, called from both `moveTokenCore` and `reorderStepsCore` in place of each one's own copy of the same ternary.
- Verified the same way as the document-session refactor: a full clean Playwright driver run after the change, all 35 checks passing (including the drag-specific ones - `DRAG_ADDED_TOKEN_VIA_PICKER`, `TOKEN_MOVED_BETWEEN_STEPS_VIA_DRAG`, `FORWARD_TOKEN_DRAG_LANDS_AT_DROP_POINT`, `STEPS_REORDERED_VIA_DRAG`, `FORWARD_STEP_DRAG_LANDS_AT_DROP_POINT`, `INSERTION_MARKER_VISIBLE_MID_DRAG`), `CONSOLE_ERRORS_COUNT=0`.

## Files touched — drag-and-drop protocol collapse (architecture pre-work)

- `src/lib/pointer-drag.ts` — added `createClickAfterDragGuard()`.
- `src/state/drag.ts` — `DropTarget` interface deleted; `dropTarget` signal now typed as `TokenDropTarget`, imported from `lib/pointer-drag.ts`.
- `src/state/document.ts` — added an unexported `adjustIndexForRemoval` helper, called from both `moveTokenCore` and `reorderStepsCore` in place of each's own copy of the same off-by-one correction.
- `src/components/StepList/StepList.tsx`, `src/components/TokenPicker/TokenPicker.tsx` — each now calls `createClickAfterDragGuard()` once at module scope instead of declaring its own `justDragged` `let`.
- `docs/known-issues.md` — the "drag-and-drop protocol duplicated across four modules" item marked resolved (the last of the four now-resolved items from the 2026-09-13 external audit; one item, the token/attachment vocabulary, remains deferred).
