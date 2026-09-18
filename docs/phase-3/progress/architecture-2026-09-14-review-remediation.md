# Architecture: 2026-09-14 internal review remediation

> 📌 **Doc status: CURRENT** — one file in the
> [Phase 3 Progress Log](./README.md).

Date: 2026-09-14

A `/mattpocock-skills:improve-codebase-architecture` review (see
[../audits/2026-09-14-architecture-review.html](../audits/2026-09-14-architecture-review.html))
surfaced five candidates after Phase 3 tasks 25-28 landed. Discussed with
the user before acting on any of them; three were resolved the same day,
one was deliberately deferred with a concrete trigger (not "later" -
recorded in [../../known-issues.md](../../known-issues.md)), and the
fifth (`updateTitleCore` duplicating `setSteps`'s history/`updatedAt`
logic) was judged too small to abstract now and needs no action - see the
audit's own card for the reasoning.

## Deferred: collapse the tab-strip duplicated across `TokenPicker` and `TokenAttachmentPicker`

The audit's "Strong" candidate - but deliberately **not** acted on now.
Evaluated critically with the user first: it's a pure internal-cohesion
change with zero effect on what task 30 (Test Real Users) actually tests,
its main payoff (a cheaper future roving-tabindex fix) is itself prep for
another item with no scheduled date, and touching two working, thoroughly-
verified components right before publishing is unnecessary risk for no
product benefit. Recorded in
[../../known-issues.md](../../known-issues.md#category-tab-strip-duplicated-between-tokenpicker-and-tokenattachmentpicker)
with a concrete trigger - Phase 4 task 32 (Formalize the Content-Pack
Shape), which will plausibly touch both components anyway - rather than
left as a vague "someday."

## Fixed: `app.tsx`'s export/import orchestration extracted to `lib/document-actions.ts`

`app.tsx` previously owned five handler functions (`handleExportJson/Svg/
Png/Pdf`, `handleImportFileChange`, ~88 lines) that read `document.value`
and wrote `toast.value`/`pendingImport.value` directly, with no relation
to `App`'s own render - and no `app.test.tsx` existed to cover any of it.

Extracted to [src/lib/document-actions.ts](../../../src/lib/document-actions.ts),
keeping this codebase's existing convention that `lib/` modules never
write UI state directly (every other `lib/` module - the three export
modules this one calls, `document-file.ts` - is already pure this way).
Each function returns a small `ExportResult` (`{ error? }` or `{ warning?
}`) or `ImportFileResult` instead of writing a toast itself; `app.tsx`
keeps one small `showExportResult` helper that turns a result into the
one toast this app shows at a time - routing a result to the right signal
is real UI-orchestration work, not export logic, so it stays in `app.tsx`.

`readImportFile` - the one function here with no DOM/download side effect
of its own - got real Vitest coverage for the first time
([document-actions.test.ts](../../../src/lib/document-actions.test.ts),
3 tests: success with an incomplete-step count, unparseable JSON, valid-
JSON-wrong-shape). The four export functions still drive real SVG/Canvas/
`window.print()` and stay covered by the Playwright driver only, per this
app's existing task-20 test-scope decision - extraction bought locality
(the logic concentrates in one place instead of the composition root),
not a pile of new unit tests, and that's stated plainly rather than
oversold.

## Fixed: `useConfirmDialogFocus`'s unenforced two-button contract

The hook ([lib/dialog-focus.ts](../../../src/lib/dialog-focus.ts))
used to return raw refs (`cancelRef`, `confirmRef`) and a bare
`handleKeyDown` - a caller could forget `onKeyDown` on the dialog wrapper,
or attach a ref to the wrong element, and the hook would silently no-op
rather than fail loudly. Changed to return three ready-to-spread prop bags
(`dialogProps`, `cancelButtonProps`, `confirmButtonProps`); both
`ImportConfirmDialog` and `NewDocumentConfirmDialog` now spread them
(`{...dialogProps}`, `{...cancelButtonProps}`, `{...confirmButtonProps}`)
instead of manually wiring three separately-named pieces. Doesn't add
compile-time enforcement (nothing stops spreading a bag onto the wrong
element), but collapses three separately-named manual steps into three
self-descriptive spreads - a smaller mistake surface, proportionate to
the actual risk (no live bug, both adapters already correct).

## Doc fix: sharpened the "seven places" vocabulary-duplication entry

The audit's content-pack-isolation candidate turned out to be more nuanced
on inspection: `units.ts`'s and `instruction.ts`'s own comments are each
accurate about their own narrow scope (the units list really is
swappable; the `metadata` field really is generic) - neither actually
overclaims on its own. The real gap is that nothing warns a reader that
`TokenCategory` itself, or its four hand-copied arrays
(`STEP_TOKEN_CATEGORIES`, `ATTACHMENT_CATEGORIES`, `ATTACHMENT_KINDS`,
`TOKEN_CATEGORIES`), are *not* part of that swappable surface. Added one
clarifying paragraph to known-issues.md's existing "seven places" entry
rather than editing the individual file comments (which aren't wrong) -
see [../../known-issues.md](../../known-issues.md).

## Incidental finding: a flaky driver check, fixed

While verifying the `app.tsx` extraction with the full Playwright driver,
`VERSION_MISMATCH_HANDLED_SAFELY` failed intermittently (roughly 1 run in
3) with `.app__toast` never becoming visible - not a regression from the
refactor (an isolated repro of just that flow passed cleanly every time),
but a genuine race in the driver's own test technique: it seeds a
corrupted document directly into IndexedDB via `page.evaluate`, bypassing
the app - but a still-pending debounced autosave
(`SAVE_DEBOUNCE_MS`, 200ms, `state/persistence.ts`) from an earlier action
several steps up could still be in flight, and if it fired *after* the
seed but *before* the reload, it silently overwrote the corrupted doc with
the app's own current (valid) one, so the reload found nothing wrong.
Fixed by waiting out the debounce (`page.waitForTimeout(300)`, the same
pattern already used elsewhere in this driver) immediately before the
seed. Confirmed fixed with 4 consecutive clean full-driver runs afterward
(39/39 checks, `CONSOLE_ERRORS_COUNT=0` each time) - see
`.claude/skills/run-instruction-builder/driver.mjs`.

## Verification

- `npm run lint`, `npm run typecheck`, `npm test` (118 tests, 3 new), and
  `npm run build` all pass. Bundle essentially unchanged (91.02 kB JS /
  27.08 kB gzip, up from 90.55 / 26.96 - moving code between files, not
  adding meaningfully more of it).
- Full Playwright driver (39 checks) run 4 times after all changes, all
  clean: zero console errors, zero axe-core violations, every export/
  import/dialog check (including the focus-trap/Escape behavior this
  session's own refactor touched) passing identically to before.
