# Tasks 14, 18, 19 — Visual Validation, JSON Export, Create Import System

> 📌 **Doc status: CURRENT** — one file in the
> [Phase 2 Progress Log](./README.md). Covers tasks 14, 18, and 19 together,
> since they share one file-touched footprint - task 18/19 were built ahead
> of 15–17 on request (see [../../milestones.md](../../milestones.md)), and
> task 14 (Visual Validation) is what both export's warning toast and
> import's confirm dialog are built on.

### Task 14 — Visual Validation

- Closed out without adding new rules: the Phase 1 stub (`src/model/validate.ts`) already implemented both baseline rules that still apply to the current model (a step needs at least one action token; an empty step is always incomplete). The third originally-planned rule - "a quantity token's metadata should include a numeric amount" - is obsolete, since Quantity is no longer a freestanding token with optional metadata; it's now always an attachment built from a validated amount+unit form (see [quantity-and-time-rework.md](./quantity-and-time-rework.md)), so an incomplete quantity can no longer exist to flag.
- What *did* need building was giving `validateDocument` (exported since Phase 1 but never called from anywhere - the code-review nitpick in `docs/phase-2/reviews/2026-09-13-1516-review.md` had flagged this as intentional scaffolding) an actual caller: it's now used by both the JSON Export warning and the JSON Import confirm dialog below, closing that gap as a natural side effect of tasks 18/19 rather than a separate change.

### Task 18 — JSON Export

- `lib/document-file.ts`'s `exportDocumentAsJson` downloads the current document as pretty-printed JSON (`JSON.stringify(doc, null, 2)`) via a `Blob` + object URL + a synthetic `<a download>` click - the exact `InstructionDocument` shape, no wrapper, so re-importing the same file round-trips to an identical document (per `docs/phase-1/architecture.md` 2.5, no transformation was ever needed since the model is already plain data). The filename is a slugified `meta.title` (e.g. `my-recipe.json`), falling back to `untitled-instructions.json`.
- **Task 14 link:** clicking Export runs `validateDocument` on the current document first; if any step is incomplete, a dismissible warning toast names how many, but the download proceeds regardless - "detect incomplete instructions" informs the user without ever blocking the export.
- **Limitation found, not fixed:** `meta.title` (what the filename is derived from) has no UI anywhere to set it, so every export today downloads as `untitled-instructions.json` - see [../../known-issues.md](../../known-issues.md). Deliberately deferred rather than bolting on an ad hoc title input; a proper home for it is a small, intentional document-settings addition, not a side effect of this task.

### Task 19 — Create Import System

- `model/migrate.ts` - previously a Phase 1 stub that just compared `schemaVersion` and cast `unknown` to `InstructionDocument` on faith - now does real runtime shape validation (`isPlainObject`/`isValidStep`/`isValidToken` checks on `meta`, `steps`, and each token's `id`/`iconId`/`category`) before that cast, since an imported file - unlike the trusted documents `state/persistence.ts` loads back from IndexedDB - can be hand-edited, corrupted, or unrelated JSON entirely. A failure throws one plain `Error` with a message safe to show the user directly (e.g. "Not a valid instruction file: missing or invalid steps."), rather than letting a malformed document silently corrupt app state or crash later during rendering.
- Import is click-to-pick via a visually-hidden `<input type="file">` proxied by a visible "Import" toolbar button (keeps the native file picker's OS-level UI while matching the rest of the toolbar's styling). Reading the file, parsing it, and validating its shape all happen before anything is shown to the user.
- **Confirm-before-replace, not immediate replace:** a successfully parsed file doesn't overwrite the document right away - it's held in a new `pendingImport` signal (`state/ui.ts`) until the user explicitly clicks "Replace" in a new `ImportConfirmDialog` component (modeled on `DragGhost`: rendered once at the app root so it overlays every panel), which also names the step count and, via `validateDocument`, whether the incoming document itself has incomplete steps. Clicking "Cancel" (or nothing) leaves the current document untouched.
- **Undo covers Import too:** a new `replaceDocument` in `state/document.ts` swaps the entire document (unlike `setSteps`, which only ever replaces `steps` on the existing one) but still goes through the same `recordHistory` every other mutation uses, so an accidental "Replace" is one `Ctrl+Z` away from being reverted - and `Ctrl+Shift+Z` reapplies it, exactly like any other action.
- A parse or shape-validation failure shows a dismissible error toast (reusing the same `toast` signal Export's warning uses, with an `"error"` tone) and leaves the current document completely unchanged - confirmed for both an unparseable file and a valid-JSON-but-wrong-shaped one.

## Files touched — Visual Validation, JSON Export, Import (tasks 14, 18, 19)

- `src/model/migrate.ts` — rewritten from a trivial `schemaVersion`-only stub into a real runtime shape validator (`isPlainObject`/`isValidStep`/`isValidToken`), throwing a descriptive, user-safe `Error` instead of casting `unknown` on faith.
- `src/lib/document-file.ts` — new: `exportDocumentAsJson` (Blob + object URL + synthetic `<a download>`, filename slugified from `meta.title`) and `parseImportedDocument` (`JSON.parse` + `migrate`, both errors surfaced as one plain `Error`).
- `src/state/document.ts` — added `replaceDocument` (swaps the whole document, including `meta`/`schemaVersion`, through the same `recordHistory` every other mutator uses).
- `src/state/ui.ts` — added `toast`/`Toast`/`ToastTone` (a single dismissible status message) and `pendingImport`/`PendingImport` (a parsed, shape-validated file awaiting explicit user confirmation).
- `src/components/ImportConfirmDialog/ImportConfirmDialog.tsx` — new: the Replace/Cancel confirmation gate, rendered once at the app root like `DragGhost`.
- `src/app.tsx` — added Export/Import toolbar buttons, the hidden file input, `handleExport`/`handleImportFileChange`, and the toast banner.
- `src/styles/global.css` — `.app__file-controls`/`.app__file-button`, `.app__toast`/`.app__toast--{info,warning,error}`/`.app__toast-dismiss`, and the `.import-confirm-*` overlay/dialog/button styles.
- `docs/known-issues.md` — new entry: every export downloads as `untitled-instructions.json` since no UI sets `meta.title` yet.
- `.claude/skills/run-instruction-builder/driver.mjs`, `SKILL.md` — new Export/Import regression checks (see [Verification](./README.md#verification)) and two new Gotchas about testing an async file-input handler correctly.
