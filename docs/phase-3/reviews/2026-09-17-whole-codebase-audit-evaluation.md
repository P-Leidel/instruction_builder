# Whole-Codebase Audit Evaluation — 2026-09-17

Evaluates a second external architecture-review report received directly in
this session (a third-party HTML document, not archived as a file per this
session's instructions - its own self-description: "Whole-codebase pass:
state, persistence, export, keyboard, side panels, canvas"). Distinct from
[`2026-09-17-external-audit-evaluation.md`](./2026-09-17-external-audit-evaluation.md)
in this same directory, which evaluated two different `check/` documents
earlier the same day. This report is also distinct from the same-day
`/improve-codebase-architecture` pass run earlier in this session (an
in-process seam-naming review of the canvas's `data-step-*`/`data-token-*`
DOM vocabulary) - see "Relationship to today's other review" below for how
the two interact.

## Scope note

Read-only verification pass; **no source code was changed**. Every
load-bearing claim was independently re-checked against this repo's actual
working tree at `4a747b9` - one (autosave) traced directly, the other six
candidates plus the report's "also noticed"/"checked and holds up" sections
verified via four parallel exploration passes. This document records
findings and a remediation plan only; implementation is a separate,
follow-up pass.

## Verification

All seven of the report's numbered candidates hold up as real. Two needed a
factual correction (noted inline); the rest matched source exactly, often
down to the cited line number.

### 1. Autosave can overwrite an unreadable save with an empty document — CONFIRMED, and worse than the report states

Traced directly in [`persistence.ts`](../../../src/state/persistence.ts).
The `effect()` registered at
[`persistence.ts:126-134`](../../../src/state/persistence.ts#L126-L134) runs
`pendingDoc = document.value` (line 127) **before** checking
`skipNextAutosave` (line 128). When a saved document fails `migrate()` (the
`catch` at [`persistence.ts:112-118`](../../../src/state/persistence.ts#L112-L118)),
`document.value` is left at the throwaway empty default and
`skipNextAutosave` is set `true` - but that flag only stops the *debounce
timer* from being armed on this first effect run (lines 128-131 `return`
before reaching line 133's `setTimeout`). `pendingDoc` has already been
armed with the empty document at line 127 and is never cleared.
`persistenceStatus.value` is already `"available"` by this point (set at
line 120, before the effect is even registered). If the tab is hidden or
closed before any real edit happens - no keystroke needed -
`visibilitychange`/`pagehide` (lines 141-144) call `flushPendingSave()`
directly, which is independent of `skipNextAutosave` and the debounce timer
entirely: it sees `pendingDoc !== undefined` and `persistenceStatus.value
=== "available"`, and writes the empty document straight over the still-
present, still-unrecovered save in IndexedDB - exactly contradicting the
toast text at line 115 ("The old save has not been overwritten").

This is the same file, and structurally the same class of bug, as
[`fixed-issues/schema-version-mismatch-data-loss.md`](../../fixed-issues/schema-version-mismatch-data-loss.md)
(fixed 2026-09-13 by adding `skipNextAutosave` in the first place) - but
that fix only addressed the debounced-write path, not the
`visibilitychange`/`pagehide` immediate-flush path added for a different
reason (task 12). Its own regression test
(`VERSION_MISMATCH_HANDLED_SAFELY`) reloads, checks the toast, and checks
storage - it never hides or closes the tab in between, so it cannot catch
this. This is also **not** the same as the already-tracked
[`known-issues.md`](../../known-issues.md#persistence-an-edit-within-200ms-of-closingreloading-the-tab-can-be-lost)
"~200ms window" issue - that one is about a *legitimate* pending edit being
lost to a debounce race; this one silently destroys an already-saved
document with no edit involved at all, and is reachable any time `migrate()`
rejects a same-version-but-malformed record (a crashed mid-write, a manual
devtools edit), not only on a future schema bump.

### 2. Session mutators re-implement history/selection/no-op logic independently, and have drifted — CONFIRMED, all 8 actions traced

Verified against the full [`document.ts`](../../../src/state/document.ts).
Every mutator core function (`removeStepCore` 302-308,
`removeTokenFromStepCore` 419-431, `moveTokenCore` 337-366, `reorderStepsCore`
379-387, `attachToTokenCore`/`setTokenAttachment` 221-239 & 507-515,
`replaceDocumentCore` 279-284, `undoCore`/`redoCore` 253-270, and the
persistence load path at
[`persistence.ts:104-111`](../../../src/state/persistence.ts#L104-L111))
implements its own combination of "record history," "skip if nothing
changed," and "keep selection valid" - and none of the five paths that touch
selection agree on how: `removeStepCore`/`removeTokenFromStepCore` each
hand-roll a conditional clear, `replaceDocumentCore` unconditionally resets
to the new document's first step, `undoCore`/`redoCore` share the one
genuinely general repair (`restoreDocument`, lines 156-166), the persistence
load path calls `selectStep` as a fourth independent local fix, and
**`moveTokenCore` does none of this at all** - it never touches
`selectedStepId`/`selectedTokenId`.

Concretely: drag the currently-selected token to a different step, and
`selectedStepId` keeps pointing at the origin step. The computed
`selectedToken` (`document.ts:114-116`) resolves to `null` since the token
is no longer in that step's list, so `TokenDetails.tsx`'s guard (line 192,
resolved value assigned line 190) renders its empty state - but
`StepDetails.tsx:62` (`const isSelected = !selectedTokenId.value;`) reads
the raw signal directly, sees a still-truthy id, and also reports "not
selected." Both panels lose their highlight, for two different and both-
wrong reasons. Separately, none of `moveTokenCore`, `reorderStepsCore`, or
`attachToTokenCore`/`setTokenAttachment` check whether the incoming change
is a no-op before recording history - dropping a token or step back exactly
where it started, or re-attaching an already-attached warning/quantity,
still pushes a history entry and wipes redo (`recordHistory`, lines 134-145,
unconditionally clears `session.future` on every push).

This is the same failure family as
[`fixed-issues/stale-step-selection-after-persisted-load.md`](../../fixed-issues/stale-step-selection-after-persisted-load.md)
(fixed 2026-09-13) - that fix was applied locally in `persistence.ts` only,
and never generalized, which is exactly why the structurally identical bug
now exists in `moveTokenCore` with no repair at all.

### 3. PDF pagination re-derives numbers from DOM strings that already exist as real numbers, and exports are silently viewport-dependent — CONFIRMED, with one overclaim corrected

`readStepBounds()` ([`pdf-export.ts:46-59`](../../../src/lib/pdf-export.ts#L46-L59))
selects step groups, regex-parses their `transform` attribute for a Y
position, and reads a child rect's `height` attribute - both silently
defaulting to `0` - even though `computeCanvasLayout`
([`canvas-layout.ts`](../../../src/lib/canvas-layout.ts), `StepLayout` at
lines 117-132) already produced `cardY`/`height` as real numbers earlier in
the same export pipeline; `pdf-export.ts` just never receives them, only the
rendered `SVGSVGElement`.

Separately, `useIsDesktop`
([`InstructionCanvas.tsx:14-27`](../../../src/components/InstructionCanvas/InstructionCanvas.tsx#L14-L27),
called line 113, feeding layout via `useMemo` 116-119) reads the *exporting
device's own* `matchMedia("(min-width: 800px)")` - there is no explicit,
controllable "export layout mode." **Correction to the source report:** this
affects SVG/PNG/PDF (all three serialize the same hidden export canvas) but
**not JSON** (`exportDocumentAsJson` is pure `JSON.stringify`, untouched by
layout). And the "~3x smaller chips" framing only strictly holds for PDF,
where `scale = USABLE_WIDTH_MM / canvasWidth` shrinks proportionally with
width ([`pdf-export.ts:93`](../../../src/lib/pdf-export.ts#L93)); standalone
SVG/PNG chips are fixed design units regardless of viewport - a mobile-
triggered export is wider (single unwrapped row, verified 748 desktop vs
2308 mobile for a 20-token step), not literally smaller-chipped, until
scaled to fit a fixed frame. The underlying finding (exports depend on the
exporting device, not an explicit mode) is real for all three binary
formats regardless of this correction.

This also **reopens the remediation this project already proposed for
itself**: [`known-issues.md`](../../known-issues.md#pdf-pagination-selector-fix-has-no-driver-regression-test-yet)'s
"PDF pagination selector fix has no driver regression test yet" section
proposes designing "a non-uniform pagination test document (varying token
counts)" as the fix. Verified this would not work: the project's Playwright
driver ([`driver.mjs`](../../../.claude/skills/run-instruction-builder/driver.mjs))
has exactly one `setViewportSize` call in the entire file, at line 596
(390x844, mobile), and every export check runs after it. At 390px, mobile
layout forces `chipsPerRow = tokens.length` for every step
(`canvas-layout.ts:363`), which forces exactly one row per step regardless
of token count - so the corrupted entries the original `4a747b9` bug
produced always collapsed to the same local Y (46) for every token in every
step, and always sorted between step 0 and step 1, no matter how the test
document's token counts vary. The real blocker is the fixed 390px viewport,
not document uniformity - `known-issues.md`'s own proposed fix needs
updating, not just executing. This is also precisely the condition
[`planned-additions.md`](../../planned-additions.md#2-radial-steps-point-to-a-center-goal-canvas)
item 2 named as its own trigger to revisit the DOM-round-trip design ("if a
hit-test bug ever makes the DOM round-trip actually cost something") - it
already has, via `4a747b9`.

### 4. Keyboard shortcuts bypass open confirm dialogs and Preview mode — CONFIRMED

`app.tsx` has two independent `window` `keydown` listeners with opposite
text-field rules: `useHistoryKeyboardShortcuts`
([`app.tsx:136-156`](../../../src/app.tsx#L136-L156)) never checks the event
target, firing even while typing in a field; `useTokenClipboardKeyboardShortcuts`
([`app.tsx:177-199`](../../../src/app.tsx#L177-L199)) checks
`isTextEntryTarget` (lines 159-165) and skips text fields entirely. Neither
checks `pendingImport`, `confirmingNewDocument`, or `previewMode`. The
confirm-dialog focus trap
([`dialog-focus.ts:36-53`](../../../src/lib/dialog-focus.ts#L36-L53))
only handles `Escape`/`Tab`; every other key bubbles to `window` from the
focused Cancel button (not a text-entry target), so with Import or
New-document's confirm dialog open, Ctrl+Z undoes and Ctrl+V pastes into the
document sitting behind the modal. `previewMode` renders a read-only canvas
but never unmounts these listeners, so Ctrl+V there mutates the same
document signal Preview is supposedly a read-only view of.

Also confirmed: the Ctrl+C handler (`app.tsx:189`) duplicates
`TokenDetails.tsx`'s Copy-button logic (`handleCopy`, lines 166-169) line
for line, and every shortcut tooltip hardcodes "Ctrl" with no
`navigator.platform`/`metaKey` branch for macOS - not just `app.tsx:288`/`298`
as cited, but also `TokenDetails.tsx:215` ("Copy (Ctrl+C)") and
`StepDetails.tsx:71` ("Paste (Ctrl+V)").

### 5. Token display name uses `??` where step/document titles use `||`, producing a live accessibility bug — CONFIRMED

`token.label ?? token.iconId` is computed independently at
`TokenChip.tsx:100`, `StepDetails.tsx:139`, `TokenDetails.tsx:168` (toast
text), and `app.tsx:189` (same toast text) - four sites, `??` throughout.
Step/document titles use `||` instead (`StepCard.tsx:114`/`152`,
`InstructionCanvas.tsx:144`). Traced the consequence: `TokenDetails.tsx`'s
Title input writes `event.currentTarget.value` on every keystroke with no
empty-string normalization, so clearing a token's title sets `label = ""`
- which `??` (unlike `||`) does **not** fall back on. Result: the on-canvas
chip label renders blank, `TokenChip.tsx:186`'s remove button
(`aria-label={\`Remove ${label}\`}`) becomes the unlabeled "Remove ", and
the copy toast becomes "Copied " with nothing after it. This is a real,
reproducible accessibility regression, not a style nit.

Also confirmed: document total time is computed independently at
`InstructionCanvas.tsx:132`, `document-actions.ts:100`, and a third time
(differently) inside the PDF heading string at `pdf-export.ts:103`; and
`model/validate.ts:43-45` exports a named `shouldFlagIncompleteStep` rule
that has **zero callers** anywhere in the codebase (grepped) - `StepCard.tsx:66`
reimplements the identical condition inline instead of calling it, and
`StepCard.tsx:60`'s own comment points at the unused function as if it were
in use.

### 6. `migrate()` doesn't migrate, and a real production data-corruption window exists — CONFIRMED

`migrate()` ([`migrate.ts:57-85`](../../../src/model/migrate.ts#L57-L85))
only validates shape/version and returns its input unchanged (line 84);
its own comment (lines 65-68) already admits no migration chain exists yet
("once a v2 ships..."). Verified via `git log`/`git show` that between
`580d5e6` (2026-09-14 18:45, the production deploy) and `9ab8e64`
(2026-09-17 10:41, "make Quantity structured") - about 2 days 16 hours -
the live deployed app saved `quantity` as a label-only `{ iconId, label:
"3 kg" }` shape, and `9ab8e64` changed the type to `{ iconId, label,
amount, unit }` **without bumping `CURRENT_SCHEMA_VERSION`** (still `1`,
confirmed unchanged in the file's entire git history). Any document
autosaved during that window and loaded today has a `quantity` value the
type system claims is structured but that at runtime is still
label-only. The only place this is actually handled is
`QuantityForm.tsx:24-25`'s `value?.amount ?? 1` / `value?.unit ?? "g"`
fallback - so opening such a token's Quantity for editing silently shows
"1 g" instead of the real historical value. This is silent data corruption
on edit, not a crash.

Also confirmed as a related type-safety gap: `AttachmentKind`
(`document.ts:22`) and `setTokenAttachment`/`attachToTokenCore`
(`document.ts:221-239`, `507-515`) both accept a flat, non-discriminated
`TokenAttachment | QuantityAttachment` regardless of the `kind` string
passed alongside it - `attachToToken(stepId, tokenId, "quantity", { iconId:
"x" })` type-checks today even though `"quantity"` implies a full
`QuantityAttachment` is required. Confirmed against `document.test.ts`,
which already calls `attachToToken` with a bare `TokenAttachment` for
`"warning"` with no compile error.

This materially updates the risk assessment in two already-written
documents: `known-issues.md`'s "Quantity amount/unit representation -
Resolved 2026-09-17" entry, and
[`phase-3/reviews/check/audit-evaluation-2026-09-17.md`](./check/audit-evaluation-2026-09-17.md)'s
item 5, both frame the missing regression test as covering "a legacy
*imported* document" - the real exposure is broader: real documents
autosaved by the live production app in a specific ~2.5-day window, sitting
in real users' IndexedDB right now.

### 7. Export has three layers of near-duplicated format handling — CONFIRMED, but the report misattributed which layer does what

**Correction to the source report:** `app.tsx`'s export handlers
(lines 51-53, 62-64, 66-68, 81-83) are trivial one-line delegations, not
bloated - they don't repeat any guard/try-catch/filename logic themselves.
`document-actions.ts`'s `runJsonExport`/`runSvgExport`/`runPngExport`/
`runPdfExport` (lines 47-106) do repeat a missing-canvas guard and
try/catch, but only in 3 of 4 (`runJsonExport`, lines 47-50, has neither),
and the error strings differ per format ("Could not export an SVG."/"a
PNG."/"a PDF.", lines 64/78/104) rather than being identical duplicated
text. Filename construction and download do **not** live in
`document-actions.ts` at all - they're one layer further down, and,
contrary to the report's claim that PNG is a "near pure pass-through,"
`exportCanvasAsPng` (`png-export.ts:22-25`) independently calls
`slugify()`+`downloadBlob()` exactly like `exportDocumentAsJson`
(`document-file.ts:37-40`), `exportCanvasAsSvg` (`svg-export.ts:116-119`),
and `exportCanvasAsPdf` (`pdf-export.ts:138`) - all four format modules
repeat the same filename-and-download pattern. `slugify`/`downloadBlob`
themselves are defined in `document-file.ts:5-11,21-28` - a module named
and scoped for the JSON format specifically, but imported by all three
other format modules. The duplication is real; it's one layer lower than
the report placed it, and evenly spread across all four formats rather than
concentrated in three.

### Also noticed (report's minor findings) — verified individually

| Claim | Verdict |
| --- | --- |
| `app.tsx:274` reads `document.value.meta.title` directly in render, subscribing the whole `App` tree to every document change; contradicts its own comment at `app.tsx:119-120` ("App doesn't otherwise re-render..."); no `memo()` anywhere in the tree | **Confirmed** — a real, additional instance of the already-tracked [full-canvas-re-render known issue](../../known-issues.md#full-canvas-re-render-on-any-edit-anywhere-in-the-document), at the `App` level rather than just `InstructionCanvas` |
| Each action "spelled four times" | **Off by one** — it's three (Core impl, `sessionActions` entry, `bindActionsToSession` export), not four. `past`/`future`/`AttachmentKind` confirmed to have zero importers outside `document.ts` |
| `ImportConfirmDialog`/`NewDocumentConfirmDialog` duplicate the same dialog shell | **Confirmed** — only the focus-trap *behavior* is actually shared (`useConfirmDialogFocus`); the markup shell was never extracted |
| `CollapsedField`'s `editing` prop duplicates `FieldPopover`'s outside-click close | **Not confirmed / reject** — `FieldPopover`'s outside-close only fires on `pointerdown`; a keyboard-only Tab+Enter switch between two fields never triggers it, so `TimeAndQuantityRow`'s explicit `openField` coordination is load-bearing, not redundant |
| `DurationForm`'s Save-enabled check diverges from `buildDuration`'s validation | **Confirmed** — `totalIsZero` only disables Save when every field is exactly 0, while `buildDuration` rejects any total under 1 second; a fractional sub-1s entry leaves Save clickable but silently no-ops |
| 6 stale comments naming old callers | **2 of 6 confirmed stale**: `model/validate.ts:12` (references a deleted `StepList` component that no longer exists anywhere in `src`) and `global.css:188` (still describes Export PDF as `window.print()`, superseded by the 2026-09-17 jsPDF/svg2pdf.js rewrite). The other four (`pointer-drag.ts:4,102,185`, `state/drag.ts:19`, `canvas-layout.ts:11-13`) are **not** stale — still accurate |
| `meta.updatedAt` stamped in 4 places, read nowhere | **Confirmed** — `document.ts:157,186,281,446`; genuinely dead field outside type definitions |
| `public/sw.js`'s `CACHE_NAME` accumulates every deploy's hashed bundles until manually bumped | **Confirmed** — `sw.js:12`, cache-first, manual-bump-only per its own comment |
| `TITLE_MAX_LENGTH` is 18 in `TokenDetails.tsx` vs 50 in `StepDetails.tsx` | **Confirmed, and one more found**: `app.tsx:34` has a third same-shaped constant, `DOCUMENT_TITLE_MAX_LENGTH = 50`, not cited by the original report |
| "Checked and holds up" spot check: `paginateSteps`, `resolveTokenPointerOutcome` | **Confirmed** — both genuinely pure/tested as described |

## Relationship to today's other review

This session also ran `/improve-codebase-architecture` earlier today,
independently of this report, and its top recommendation was to centralize
the `data-step-id`/`data-step-index`/`data-token-index` DOM vocabulary that
both `pointer-drag.ts` and `pdf-export.ts` read into a new `lib/canvas-dom.ts`
module (that report was not saved to a file, per this session's
instructions). Candidate 3 above (this report) proposes a stronger fix
specifically for `pdf-export.ts`'s half: stop reading the DOM back at all,
and pass `computeCanvasLayout`'s real `cardY`/`height` numbers straight
through the export pipeline instead. **These aren't in conflict, but
Candidate 3 supersedes the `pdf-export.ts` portion of that earlier
recommendation** - if pagination gets its numbers from the layout directly,
`readStepBounds()`'s DOM-scraping disappears entirely rather than being
centralized. `pointer-drag.ts`'s side of the same vocabulary (hit-testing
real pointer events against the DOM) is a separate, still-open concern -
pointer events are physical DOM coordinates and can't come from a layout
object directly - and remains a reasonable candidate for a named module on
its own merits, just a smaller one than originally scoped, and explicitly
still deferred per `planned-additions.md` item 2 ("the drag hit-test still
queries the DOM... revisit... if a hit-test bug ever makes the DOM
round-trip actually cost something" - not yet true for hit-testing itself,
only now true for export).

## Remediation plan

### Critical — live data loss, fix first

1. **Autosave overwrite bug (finding 1).** Reorder `persistence.ts`'s effect
   so `skipNextAutosave` is checked *before* `pendingDoc` is armed (or clear
   `pendingDoc` explicitly when skipping), so a failed load can't be
   overwritten by a tab-hide/close with no edit in between. Extend
   `VERSION_MISMATCH_HANDLED_SAFELY` (or add a sibling driver check) to hide
   the tab (not just reload) immediately after a failed load, and assert the
   original record is still intact afterward - the current test's blind spot
   is exactly this sequencing.

### High — confirmed, reproducible bugs affecting real usage

2. **Selection dangles after moving the selected token (finding 2).** At
   minimum, add the missing selection repair to `moveTokenCore` (mirroring
   `restoreDocument`'s resolve-or-clear logic) and add value-equality no-op
   guards to `moveTokenCore`/`reorderStepsCore`/`setTokenAttachment` before
   they call into history-recording. The report's fuller recommendation -
   one shared commit path every mutator routes through, so this class of
   drift becomes structurally impossible rather than patched action-by-action
   - is worth a `/improve-codebase-architecture` grilling pass of its own
   before committing to scope, given it touches all ~25 actions.
3. **Keyboard shortcuts act behind open dialogs and in Preview (finding 4).**
   Have both `keydown` listeners check `pendingImport`/`confirmingNewDocument`/
   `previewMode` (or consolidate into one listener that does), and decide
   whether the focus trap should stop propagation for all keys while a
   confirm dialog is open rather than only handling `Escape`/`Tab`. Fix the
   hardcoded "Ctrl" tooltips (4 sites, not the 2 originally cited) to reflect
   the actual `ctrlKey || metaKey` handling.
4. **Cleared token title breaks accessibility (finding 5).** Switch the four
   `label ?? iconId` sites to `||` (or normalize empty-string titles to
   `undefined` at the point of input, matching how step/document titles are
   already handled) so a cleared title falls back the same way a cleared step
   title already does.
5. **Silent quantity corruption in a live production window (finding 6).**
   Give `migrate()` a real (even if trivial) v1 quantity-shape upgrade step
   that detects a label-only `quantity` and either parses `label` back into
   `amount`/`unit` or drops it to `undefined` explicitly, rather than letting
   it pass through untouched to a form that silently shows the wrong value.
   Update `known-issues.md`'s "Resolved 2026-09-17" entry and the check/
   audit-evaluation's item 5 to reflect that this is a live-production
   exposure window, not just an import-time edge case, before scoping the
   regression test they already call for.

### Medium — real, but lower blast radius or already partially scoped

6. **PDF pagination reads the DOM for numbers the layout already has
   (finding 3).** Thread `computeCanvasLayout`'s `cardY`/`height` through to
   `pdf-export.ts` directly, deleting `readStepBounds()`'s regex/selector
   reach-through. This also unblocks the regression test
   `known-issues.md` already asks for (once pagination takes numbers
   directly, it can be tested in Vitest with no DOM/browser at all,
   sidestepping the 390px-viewport blocker entirely). Separately, decide
   as a product question (not an architecture one) whether SVG/PNG/PDF
   exports *should* be viewport-independent - if so, an explicit export
   layout mode (rather than `useIsDesktop`'s live `matchMedia` read) is the
   fix; this needs a decision before implementation, flagged for a grilling
   session.
7. **Export format duplication (finding 7, corrected scope).** Consolidate
   the guard/try-catch/warning logic that's inconsistently spread across
   `runJsonExport`/`runSvgExport`/`runPngExport`/`runPdfExport`, and move
   `slugify`/`downloadBlob` out of the JSON-specific `document-file.ts` into
   a neutrally-named shared module. Smaller in scope than the source report
   implied - all four formats already share the pattern evenly, so this is
   a straightforward "pull four copies into one" rather than a load-bearing
   redesign.
8. **`AttachmentKind` isn't linked to its payload type (part of finding 6).**
   A discriminated union (`{ kind: "quantity"; value: QuantityAttachment }
   | { kind: "warning"; value: TokenAttachment }`) would make the invalid
   `attachToToken(..., "quantity", { iconId })` call a compile error instead
   of a silent runtime gap. Worth scoping alongside Phase 4 task 32 (the
   already-deferred token/attachment vocabulary unification in
   `known-issues.md`), since both touch the same `AttachmentKind`/
   `TokenCategory` surface.

### Small — single-file, no interaction risk

9. Dedupe `documentTotalTime` (3 independent computations, finding 5) into
   one `lib/duration.ts` helper - this is the same open candidate as
   Candidate 3 in this session's earlier
   [`2026-09-17-copy-paste-and-pdf-followup-review.html`](../audits/2026-09-17-copy-paste-and-pdf-followup-review.html),
   not a new item; folding it in here rather than tracking it twice.
10. Delete the unused `shouldFlagIncompleteStep` (finding 5) or call it from
    `StepCard.tsx:66` instead of the hand-duplicated inline condition.
11. Share `copyTokenWithToast` between the Copy button and Ctrl+C (finding
    4, claim 3) - also the same open candidate as Candidate 4 in that same
    prior review; one fix closes both.
12. Fix the two genuinely stale comments (`validate.ts:12`, `global.css:188`).
13. Remove the dead `meta.updatedAt` stamping, or start using it (e.g. an
    "edited N minutes ago" indicator) - currently pure overhead.
14. Unify `TITLE_MAX_LENGTH`/`DOCUMENT_TITLE_MAX_LENGTH` (3 constants, 2
    distinct values) into one named constant per real constraint (token
    title vs. step/document title), if the different limits are intentional;
    otherwise pick one.
15. Extract the `ImportConfirmDialog`/`NewDocumentConfirmDialog` shared shell
    into one parameterized component (title/body/actions), keeping
    `useConfirmDialogFocus` as-is.
16. Reconcile `DurationForm`'s Save-enabled check with `buildDuration`'s real
    validation (accept fractional-second edge case or reject it consistently
    in both places).
17. Give `sw.js`'s `CACHE_NAME` a mechanical per-build value (e.g. derived
    from the Vite build hash) instead of requiring a manual bump per deploy.

### Explicitly rejected — not real findings

- **`CollapsedField`/`FieldPopover` "redundancy."** Not redundant -
  `TimeAndQuantityRow`'s explicit `openField` state is the only thing
  enforcing one-open-at-a-time under keyboard-only navigation, which
  `FieldPopover`'s pointer-only outside-close can't cover.
- **4 of the 6 "stale comment" claims** (`pointer-drag.ts:4,102,185`,
  `state/drag.ts:19`, `canvas-layout.ts:11-13`) - all still accurate against
  current code, no action needed.

## Additional issues found during this evaluation (beyond the source report)

- `app.tsx:34`'s `DOCUMENT_TITLE_MAX_LENGTH = 50` is a third
  same-shaped-but-differently-valued constant alongside the two the source
  report already flagged (folded into item 14 above).
- The hardcoded-"Ctrl" tooltip issue is broader than the report's two cited
  lines - it's the same pattern at `TokenDetails.tsx:215` and
  `StepDetails.tsx:71` too (folded into item 3 above).
- `known-issues.md`'s "PDF pagination selector fix has no driver regression
  test yet" section's own proposed remediation (a non-uniform test document)
  would not actually close the gap, because the real constraint is the
  Playwright driver's single fixed 390px viewport, not the test document's
  uniformity - this needs the entry itself corrected, independent of
  whichever code fix (item 6 above) is chosen.
- `known-issues.md`'s "Quantity amount/unit representation - Resolved
  2026-09-17" entry and `check/audit-evaluation-2026-09-17.md`'s item 5 both
  understate the exposure window as import-only; it also covers real
  documents autosaved by the live production app for ~2.5 days (see finding
  6) - worth a documentation correction independent of the code fix.

## Summary

- **Critical:** 1 item - the autosave overwrite bug, the only one with a
  concrete unattended data-loss path.
- **High:** 4 items - dangling selection after moving a token, keyboard
  shortcuts bypassing modals/Preview, the cleared-token-title accessibility
  bug, and the live production quantity-corruption window.
- **Medium:** 3 items - DOM-scraped PDF pagination (and the viewport-vs-
  document-format decision it surfaces), export-format duplication, and the
  `AttachmentKind` type-safety gap.
- **Small:** 9 items, mostly one-file cleanups, two of which are the same
  open candidates already tracked in this session's earlier
  copy-paste-and-pdf-followup architecture review rather than new debt.
- **Rejected:** 5 of the report's minor claims (1 architecture candidate,
  4 stale-comment claims) did not hold up under verification.
- All 7 of the report's main candidates were confirmed as real findings;
  two (pagination's viewport dependency, and export-format duplication)
  needed a factual correction to which layer/format is actually at fault.
  No code was changed in this pass - see the tiered plan above for the
  follow-up implementation work.
