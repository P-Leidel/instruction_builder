---
name: run-instruction-builder
description: Build, start, and drive the Visual Instruction Builder Preact/Vite dev app in a real browser to check a UI change - screenshots the canvas/token-picker, exercises step/token select, category tabs in "Add to step", attaching a Quantity or Warning to a token via Token details' own fields and removing it (Quantity mirrors DurationField's collapsed/edit-toggle interaction, pre-filling from the current value on Edit and select-on-focus in its amount input; Warning stays an always-visible preset grid), changing an already-attached Quantity directly without removing it first, setting an independent duration on a token and a step via DurationField (and the step/token-switch-while-editing regression it once had), drag-and-drop (adding, moving, and reordering, including the live insertion-point marker), undo/redo (buttons and keyboard shortcuts, including that continuous typing coalesces into one undo step), JSON/SVG/PNG/PDF export and JSON import (including the incomplete-steps warning, the confirm-before-replace dialog, invalid-file rejection, that import goes through undo/redo too, that the downloaded SVG is self-contained with real colors baked in rather than just CSS classes, that the downloaded PNG is actually rasterized at its declared pixel density, that Export PDF downloads a real generated PDF (jsPDF + svg2pdf.js) that paginates a long document into multiple pages without cutting a step or leaving a blank page, and that the `@media print` stylesheet - now just an unsupported Ctrl+P fallback, independent of the Export PDF button - still isolates the hidden read-only canvas via `emulateMedia`), IndexedDB persistence across a reload (including a saved document with a mismatched schema version, seeded directly into IndexedDB), the token connector lines, the read-only preview toggle, an axe-core accessibility scan at several app states, keyboard-only step reordering and token selection, and the Import dialog's focus trap/Escape handling, and checks the console for errors. Also runs `npm test`, the Vitest unit suite covering the instruction model, the document session's undo/redo, and pure lib/ logic - and, via a separate `pwa-check.mjs` script against a real production build (not the dev server), the offline service worker: registration, runtime caching, and that the app actually still loads with no network at all. Use for "run the app," "screenshot the instruction builder," "check this UI change works," "does drag-and-drop work," "does token attachment work," "does step/token time work," "does undo/redo work," "does export/import work," "does SVG export look right," "does PNG export look right," "does print/PDF export work," "does persistence handle a bad/old save," "does the canvas render correctly," "does keyboard access/accessibility work," "does offline/PWA support work," or "run the unit tests."
---

Paths below are relative to the project root (`instruction_builder/`).

This is a Windows (PowerShell + Git Bash) machine, not a Linux
container - commands below are Windows-specific where it matters
(see Gotchas).

## Prerequisites

Node.js must be on PATH. In the Bash tool it isn't by default on this
machine:

```bash
export PATH="/c/Program Files/nodejs:$PATH"
```

Install deps and the Playwright browser (one-time; browser installs to
a user-level cache, no admin rights needed):

```bash
npm install
npx playwright install chromium
```

**Do not run `npx playwright install msedge`** - see Gotchas.

## Build

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

`npm test` (Vitest, task 20) runs the unit suite - colocated
`src/**/*.test.ts` files covering the instruction model (`model/
instruction.ts`, `model/migrate.ts`, `model/validate.ts`), the
document session (`state/document.ts`'s `sessionActions`, via
`createDocumentSession()` - undo/redo, coalescing, selection-repair,
every mutator), and pure logic in `lib/` (`canvas-layout.ts`,
`duration.ts`, `document-file.ts`'s `slugify`/`parseImportedDocument`,
`pointer-drag.ts`'s `createClickAfterDragGuard`). It deliberately does
NOT cover the export pipeline's DOM-touching parts
(`svg-export.ts`/`png-export.ts`/`pdf-export.ts`), `state/
persistence.ts`, or any component - those need a real browser to mean
anything and are already covered end-to-end by the driver below; see
`docs/phase-2/plans/task-20-automated-testing-plan.md` for the full scope
reasoning. All four of `lint`/`typecheck`/`test`/`build` are one-shot,
exit-code-driven checks with no browser involved - the driver below is
the only one that needs the steps under "Run (agent path)".

## Run (agent path)

1. Start the dev server in the background and poll until it responds
   (strict port so it fails fast instead of silently picking another
   one):

   ```bash
   export PATH="/c/Program Files/nodejs:$PATH"
   nohup npm run dev -- --port 5173 --strictPort > /tmp/vite-dev.log 2>&1 &
   disown
   for i in $(seq 1 30); do
     curl -sf http://localhost:5173 >/dev/null 2>&1 && echo UP && break
     sleep 1
   done
   ```

   If it fails with "Port 5173 is already in use," a dev server is
   already running (possibly from an earlier session) - `curl -sf
   http://localhost:5173` to confirm it serves this app, and just reuse
   it (Vite serves source live, so an old process still serves current
   code).

2. Drive it and capture screenshots:

   ```bash
   node .claude/skills/run-instruction-builder/driver.mjs /path/to/output/dir
   ```

   This navigates to the app, names the first step, adds three tokens
   via the picker (switching "Add to step" category tabs to reach
   tokens outside the default-active one), adds a second step with its
   own token, then exercises the two-stage canvas select model:
   clicking a token on an *unselected* step first selects the step,
   and only a further click on a token of the *already-selected* step
   selects the token itself (surfaced in the Token details panel). It
   types into that panel's title/notes fields and checks the change
   lands on the canvas chip's label, then exercises Token details' own
   Quantity and Warning fields: attaches a Warning (one of two
   always-visible preset buttons - no tab switch needed) and a Quantity
   (clicking "+ Quantity" opens a validated amount+unit form with
   Save/Cancel, mirroring DurationField's "Token time" above it - Time
   itself is not offered here, see below) to the selected token, confirms
   the canvas chip grows two corner badges and Token details reflects
   both, removes the Warning via Token details, and confirms the badge
   count drops to one while the Quantity stays attached. It also confirms
   clicking Edit on an already-attached Quantity pre-fills the form from
   its current value, that focusing the amount input selects its full
   contents (so retyping doesn't need a manual clear first), and that
   changing the value and clicking Save replaces it in place (one
   attachment, not two) rather than requiring a Remove first. It also
   reproduces a real bug found in code review (see
   docs/fixed-issues/README.md): opening an edit on the Quantity field
   and switching to a *different* token without saving must not leave the
   new token's Quantity field stuck in the old token's unsaved editing
   form (the same bug class DurationField's own regression check below
   guards against). It then exercises Time - set independently on a token
   *and* a step via the `DurationField` control inline in Token/Step
   details (day/hour/minute/second boxes, also confirming focusing one
   selects its full contents) - confirming the canvas's
   centered duration header above the step shows the token's time
   first, then the step's own explicit time once set (which takes
   precedence). It also reproduces a real bug found in manual testing
   (see docs/fixed-issues/README.md): starting an edit on one token's (or
   step's) time and switching to a different one *without* saving must
   not leave the new selection showing the old one's stale, unsaved
   editing form. It removes a token via the canvas's own remove
   control, checks that canvas controls are keyboard-focusable, and
   counts the connector lines drawn between a step's tokens, then
   exercises drag-and-drop with real `page.mouse` drags: dragging a
   picker token onto a step's canvas area, dragging an existing canvas
   token from one step to another (checking the live insertion-point
   marker is visible mid-drag, before release), and dragging a step's own
   canvas drag handle to reorder it (step management - select, add, remove,
   reorder - lives on the canvas itself, not a separate panel). Both the
   token-within-step and step-reorder drags
   include a forward-direction regression check (see docs/fixed-issues/README.md):
   dropping into a slot strictly between two other items used to overshoot
   by one position when dragging forward, a bug the driver's own
   backward-only reorder tests had never caught. It also exercises task 13
   (Undo/Redo): confirms the toolbar's Undo/Redo buttons start disabled on
   a fresh document, that a discrete action (adding a step) undoes and
   redoes as one step, that typing a whole title across several keystrokes
   coalesces into a *single* undo (not one character at a time - see
   `COALESCE_WINDOW_MS` in `state/document.ts`), and that the `Ctrl+Z`/
   `Ctrl+Shift+Z` keyboard shortcuts work - then undoes its own test edits
   so the step count/order stay what the later persistence check expects.
   It toggles the read-only Preview mode and
   checks editing controls disappear, reloads the page (after a short
   pause past the persistence debounce) and confirms the document
   survived via IndexedDB, then reduces the viewport to 390px wide
   (mobile), screenshots that too, and asserts the page never grows wider
   than the viewport there (task 21's own regression check - see Gotchas).
   It then does the same at both tablet viewports, 768x1024 and 1024x768 -
   the band between phone and desktop, which nothing exercised before
   2026-09-18 - screenshotting and axe-scanning each, asserting the layout
   actually switches across the pair (`.app__main` is `flex` at 768px
   portrait and `grid` at 1024px landscape, since the single 800px
   breakpoint puts a portrait tablet on the *mobile* layout), and checking
   the field popover flips above its trigger and stays inside the viewport
   when opened with no room below. It restores 390x844 afterwards so
   nothing downstream sees a different app. Note the tablet overflow
   assertions use `<= 0`, not the mobile pass's `=== 0`: above 800px
   `html { scrollbar-gutter: stable }` reserves 15px unconditionally, so
   `scrollWidth` is legitimately *smaller* than `clientWidth` there.
   Next it exercises tasks
   15/16/17/18/19 (SVG/PNG/PDF/JSON Export, Import): adds a temporary
   empty step, clicks
   Export JSON, and confirms the downloaded file (captured via
   `page.waitForEvent("download")`) is the current document under a
   filename derived from `meta.title`, and that a non-blocking warning
   toast names the number of incomplete steps (task 14's link into export)
   without the download itself being blocked; then clicks Export SVG (same
   temporary incomplete step, so the warning-toast link is re-exercised for
   a second format) and confirms the downloaded file is well-formed
   (`<?xml ...?>` header, a valid `<svg>` root), came from the hidden
   *read-only* export canvas specifically (no `instruction-canvas__chip-remove`
   markup in it - see Gotchas for why a second, hidden canvas exists at
   all), and - the actual point of task 15's style-baking step, see
   Gotchas - contains a real `rgb(...)` color value, not just CSS class
   names that would be meaningless without this app's stylesheet; then
   clicks Export PNG (same temp step, third format, third warning-toast
   check) and confirms the downloaded file has a valid PNG signature and -
   read straight out of its `IHDR` chunk, see Gotchas - pixel dimensions
   that are exactly the exported SVG's own width/height times the declared
   pixel density, confirming actual rasterization at that density rather
   than just "some PNG downloaded"; then clicks Export PDF (same temp
   step, fourth format, fourth warning-toast check) and confirms the
   downloaded file (2026-09-17: a real generated PDF via jsPDF +
   svg2pdf.js, not `window.print()` - see Gotchas) starts with the
   `%PDF-` signature and downloads under the right filename, the same
   `page.waitForEvent("download")` mechanism SVG/PNG export use. It
   separately confirms, via `page.emulateMedia({ media: "print" })`
   (which applies the same CSS a real print/"Save as PDF" would, no
   dialog involved), that the `@media print` stylesheet - kept only as
   an unsupported fallback for a user's own Ctrl+P/File>Print, entirely
   independent of the Export PDF button now - still hides the toolbar
   and the whole editor grid while switching the hidden export canvas
   back into visible flow with its step cards rendered and none of the
   editable canvas's remove-button markup - screenshotted under that
   print-media emulation, then restored to screen media before
   continuing. It removes the temporary step again afterward, then
   imports a large throwaway 18-step document (4 tokens per step) the
   same way the real Import tests below do, exports PDF again, and
   counts `/Type /Page` objects straight out of the raw PDF bytes to
   confirm pagination actually splits it into more than one page - with
   no step cut across a page boundary and no blank page, the two things
   `lib/pdf-pagination.ts`'s own unit tests already prove in isolation
   for the pure algorithm, checked here end-to-end through the real
   DOM-bounds-in/jsPDF-out pipeline - then undoes the import so the
   document is back to what it was before this check ran. Across all
   five of those export clicks it also watches *how* the shared
   `lib/download.ts` path behaves, not just that a file arrived:
   `DOWNLOAD_DEFERS_OBJECT_URL_REVOKE` asserts the synthetic
   `<a download>` was in the document when it was clicked and that
   `URL.revokeObjectURL` was never called in the same task as that
   click - the Safari-shaped failure Chromium cannot itself reproduce
   (see Gotchas). It then
   imports a small valid
   document via the hidden file input (`setInputFiles`, which fires the same
   `change` event a real file picker would), confirms the confirm-before-
   replace dialog names the right step count, clicking Replace swaps the
   document, and that undo/redo covers the import exactly like any other
   edit (`Ctrl+Z` restores the pre-import document, `Ctrl+Shift+Z` reapplies
   it) - then undoes it again to leave the baseline document in place. It
   also feeds one unparseable-JSON file and one wrong-shaped-but-valid-JSON
   file (a step with a garbage token, specifically chosen so it wouldn't
   also crash `validateDocument` and mask a regression in `migrate`'s own
   validation - see Gotchas) through the same input, confirming both show an
   error toast with no confirm dialog and leave the document untouched, and
   a final valid import that gets Canceled instead of Replaced, confirming
   the dialog closes with nothing changed. Finally it exercises a fix for a
   live data-loss bug (see docs/fixed-issues/README.md): seeds IndexedDB directly
   (bypassing the app - there's no UI path that produces this) with a
   document whose `schemaVersion` doesn't match, reloads, and confirms an
   error toast explains the load failure, the original record is still
   intact on disk immediately after reload (not yet overwritten), and a
   subsequent real edit autosaves normally. Task 22 (Add Accessibility
   Features) adds three more things: an axe-core scan (WCAG rule
   violations) at three states - the populated main editor, the Import
   confirm dialog open, and the 390px mobile viewport - each expected to
   report zero; a keyboard-only reorder of a step via its new Move
   up/down buttons (confirming both the swap and that they're disabled at
   the list's first/last position); and a keyboard-only token selection
   via `StepDetails`' "Tokens in this step" list (the canvas's own SVG
   token chips stay pointer/touch-only - see Gotchas), confirming Token
   Details opens for it. It also confirms the Import dialog behaves like a
   real modal: focus lands on Cancel the instant it opens, Tab is trapped
   between its two buttons, and Escape cancels with the document left
   untouched. It prints `SCREENSHOTS_DIR=...`,
   `TABS_FILTER_TOKENS=...`, `TOKEN_SELECTED_AFTER_FIRST_CLICK=...`,
   `TOKEN_LABEL_UPDATED=...`, `ATTACHMENTS_WORKED_END_TO_END=...`,
   `QUANTITY_EDIT_PREFILLS_FROM_CURRENT_VALUE=...`,
   `QUANTITY_SELECTS_VALUE_ON_FOCUS=...`,
   `QUANTITY_FORM_RESETS_PER_TOKEN=...`,
   `ATTACHED_VALUE_CHANGEABLE_WITHOUT_REMOVING=...`,
   `DURATION_SELECTS_VALUE_ON_FOCUS=...`,
   `TIME_WORKED_END_TO_END=...`, `DURATION_FIELD_RESETS_PER_TOKEN=...`,
   `DURATION_FIELD_RESETS_PER_STEP=...`, `CONNECTOR_COUNT=...`,
   `DRAG_ADDED_TOKEN_VIA_PICKER=...`,
   `INSERTION_MARKER_VISIBLE_MID_DRAG=...`,
   `TOKEN_MOVED_BETWEEN_STEPS_VIA_DRAG=...`,
   `FORWARD_TOKEN_DRAG_LANDS_AT_DROP_POINT=...`,
   `STEPS_REORDERED_VIA_DRAG=...`,
   `FORWARD_STEP_DRAG_LANDS_AT_DROP_POINT=...`,
   `HISTORY_BUTTONS_DISABLED_INITIALLY=...`,
   `UNDO_REDO_WORKED_END_TO_END=...`,
   `PREVIEW_HIDES_EDITING_CONTROLS=...`,
   `PERSISTED_ACROSS_RELOAD=...`,
   `NO_HORIZONTAL_OVERFLOW_AT_MOBILE_WIDTH=...`,
   `NO_HORIZONTAL_OVERFLOW_AT_TABLET_PORTRAIT=...`,
   `NO_HORIZONTAL_OVERFLOW_AT_TABLET_LANDSCAPE=...`,
   `LAYOUT_SWITCHES_ACROSS_TABLET_ORIENTATIONS=...`,
   `FIELD_POPOVER_STAYS_INSIDE_VIEWPORT=...` (with the per-orientation
   results), `CANVAS_KEYBOARD_FOCUSABLE=...`,
   `COPY_PASTE_WORKED_END_TO_END=...`,
   `AUTOSAVE_NOT_CLOBBERED_BY_TAB_HIDE=...`,
   `KEYBOARD_SHORTCUTS_SUSPENDED_BEHIND_MODALS=...`,
   `NEW_DOC_DIALOG_CANCEL_LEAVES_DOCUMENT_UNCHANGED=...`,
   `TOKEN_CATEGORY_ARROW_KEY_NAV_WORKS=...`,
   `JSON_EXPORT_DOWNLOADS_CURRENT_DOCUMENT=...`,
   `JSON_EXPORT_WARNS_ABOUT_INCOMPLETE_STEPS=...`, `TOAST_DISMISSIBLE=...`,
   `SVG_EXPORT_IS_SELF_CONTAINED_AND_STYLED=...`,
   `SVG_EXPORT_WARNS_ABOUT_INCOMPLETE_STEPS=...`,
   `PNG_EXPORT_IS_RASTERIZED_AT_PIXEL_DENSITY=...`,
   `PNG_EXPORT_WARNS_ABOUT_INCOMPLETE_STEPS=...`,
   `PDF_EXPORT_DOWNLOADED_VALID_PDF=...`,
   `PDF_EXPORT_WARNS_ABOUT_INCOMPLETE_STEPS=...`,
   `DOWNLOAD_DEFERS_OBJECT_URL_REVOKE=...` (with a `DOWNLOAD_PROBE=...`
   breakdown - see the note below),
   `PRINT_STYLESHEET_ISOLATES_READONLY_CANVAS=...`,
   `PDF_EXPORT_PRODUCES_MULTIPLE_PAGES=...` (with the counted page
   count), `PAGINATION_TEST_UNDO_RESTORED_DOCUMENT=...`,
   `IMPORT_DIALOG_MENTIONS_STEP_COUNT=...`, `IMPORT_UNDO_REDO_WORKED=...`,
   `IMPORT_REJECTS_INVALID_FILE=...`,
   `IMPORT_CANCEL_LEAVES_DOCUMENT_UNCHANGED=...`,
   `VERSION_MISMATCH_HANDLED_SAFELY=...`,
   `STEP_REORDERED_VIA_KEYBOARD=...`,
   `STEP_MOVE_BUTTONS_DISABLED_AT_BOUNDARIES=...`,
   `TOKEN_SELECTED_VIA_KEYBOARD=...`,
   `IMPORT_DIALOG_TRAPS_FOCUS_AND_ESCAPE_CLOSES=...`,
   `ACCESSIBILITY_VIOLATIONS_MAIN_EDITOR=...`,
   `ACCESSIBILITY_VIOLATIONS_IMPORT_DIALOG=...`,
   `ACCESSIBILITY_VIOLATIONS_MOBILE=...`,
   `ACCESSIBILITY_VIOLATIONS_TABLET_PORTRAIT=...`,
   `ACCESSIBILITY_VIOLATIONS_TABLET_LANDSCAPE=...`, and
   `CONSOLE_ERRORS_COUNT=...` for any console errors it captured. **Read the screenshots** (e.g. with the Read tool) - don't just
   check the exit code.

3. Stop the server when done (find the PID by port - see Gotchas for
   why `lsof` doesn't work here):

   ```powershell
   Get-NetTCPConnection -LocalPort 5173 -State Listen |
     ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
   ```

## PWA verification (task 23)

`driver.mjs` above drives the **dev server**, where the service worker is
deliberately never registered (see Gotchas) - it can't verify offline
support at all. Use `pwa-check.mjs` instead, against a real **production
build**:

```bash
export PATH="/c/Program Files/nodejs:$PATH"
npm run build
nohup npm run preview -- --port 4173 --strictPort > /tmp/vite-preview.log 2>&1 &
disown
for i in $(seq 1 30); do
  curl -sf http://localhost:4173 >/dev/null 2>&1 && echo UP && break
  sleep 1
done
node .claude/skills/run-instruction-builder/pwa-check.mjs
```

It confirms the manifest and all three app icons
(`public/icons/icon-192.png`/`icon-512.png`/`icon-maskable-512.png`) are
reachable, that the service worker actually takes control of the page,
reloads once more (simulating a real second visit - see Gotchas for why
the *first* load can never be SW-controlled) and confirms the runtime
cache now holds the page shell and its hashed JS/CSS, then sets the
browser context fully offline and reloads again - the actual point of the
task - confirming the app still renders. Prints
`MANIFEST_AND_ICONS_REACHABLE=...`, `SHELL_CACHED_AFTER_SECOND_VISIT=...`,
`CACHED_URLS=...`, `APP_LOADS_WHILE_OFFLINE=...`, and
`REQUEST_FAILURES_COUNT=...` (plus each failure's URL/reason, if any).
Stop the preview server the same way as the dev server, on port 4173
instead of 5173.

## Run (human path)

```bash
npm run dev
```

Opens on `http://localhost:5173/` (or the next free port if 5173 is
taken - watch the terminal output for the actual URL).

## Gotchas

- **The download check patches the page, it doesn't reproduce the bug.**
  `DOWNLOAD_DEFERS_OBJECT_URL_REVOKE` exists for a Safari/iOS failure
  (revoking a blob URL before the transfer is handed off cancels the
  download) that **Chromium tolerates and therefore cannot demonstrate**.
  So the driver installs an `addInitScript` probe that wraps
  `HTMLAnchorElement.prototype.click` and `URL.revokeObjectURL`, and
  asserts the *property* Safari cares about: the anchor was connected to
  the document at click time, and no revoke happened in the click's own
  task. Two consequences worth knowing before editing it: the probe is an
  init script (not `page.evaluate`) so it survives the reload the
  persistence check does - which also means the counters **reset on that
  reload**, so `downloadProbe` must be read before it; and the revoke
  *count* is deliberately not asserted, because `REVOKE_DELAY_MS` is 60s
  and a long run can legitimately outlast it. A green result here means
  "this could not fail on Safari for that reason", not "this was tested on
  Safari".
- **`npx playwright install msedge` fails on this machine** with
  "Failed to install Microsoft Edge... insufficient privileges." Edge
  is only partially installed here (`Program Files
  (x86)\Microsoft\Edge\Application\<version>\` exists but has no
  `msedge.exe` in it - just a stub/manifest). Don't try to fix Edge;
  `npx playwright install chromium` works with no admin rights and is
  what the driver uses.
- **A screenshot alone won't catch "this flex/grid item silently refuses to
  shrink" - check `document.documentElement.scrollWidth` vs. `clientWidth`
  too.** Task 21's audit found the same bug twice under different symptoms:
  `.app__file-controls` (`flex-shrink: 0`) and `.step-list__item` (no
  `min-width: 0`) both had their automatic minimum width pinned to their
  un-wrapped content size, so their own `flex-wrap`/ellipsis styling never
  got a chance to do anything - the page just silently grew wider than the
  viewport instead. A screenshot at a *short-content* viewport width looks
  completely fine either way; it only shows up with content long enough to
  hit the un-wrapped minimum (a 5-button toolbar group, an ~80-character
  step title) *and* only if something actually checks for the resulting
  overflow, which nothing did before `NO_HORIZONTAL_OVERFLOW_AT_MOBILE_WIDTH`
  was added. See `docs/fixed-issues/README.md`'s two matching entries for
  the full root cause and fix (`flex-shrink: 1` + `min-width: 0`, and
  `min-width: 0` alone, respectively) - the general lesson: any flex item
  or grid track that's supposed to let its own content wrap or truncate
  needs an explicit `min-width: 0` (flex) or `minmax(0, ...)` (grid) too,
  or it never actually gets narrow enough for that styling to trigger.
- **Step management (select/add/remove/reorder) lives on the canvas now, not
  a separate StepList panel.** A step's outer `<g>` carries both
  `data-step-id` and `data-step-index` (the latter unique to a step group -
  token `<g>`s only carry `data-step-id` - so `[data-step-index='n']` always
  resolves to the step, not one of its tokens); its drag handle
  (`.instruction-canvas__step-drag-handle`), remove button
  (`.instruction-canvas__step-remove`), and move up/down buttons
  (`.instruction-canvas__step-move--up`/`--down`) are real descendants of
  that same `<g>`, not siblings - so
  `editableCanvas.locator("[data-step-index='n']").locator(".instruction-canvas__step-remove")`
  works directly. The move buttons are SVG `<g role="button">`, not real
  `<button>` elements, so their disabled-at-a-boundary state is
  `aria-disabled="true"`, not Playwright's `.isDisabled()` (which only
  understands native form controls).
- **"Add to token" is gone - Quantity/Warning attach from inside Token
  details now, with no tabs, and Quantity itself later became a
  collapsed/edit-toggle field like Time rather than an always-visible
  form.** The old standalone `TokenAttachmentPicker` panel (right column,
  its own category tabs) was first folded into `TokenDetails` as two
  always-visible rows, then Quantity specifically was reworked again to
  mirror `DurationField`'s own interaction: `.token-details__quantity-add`
  ("+ Quantity", shown when unset), `.token-details__quantity-display` +
  `.token-details__quantity-value` + `.token-details__quantity-edit`/
  `.token-details__quantity-remove` (shown once attached), and
  `.token-details__quantity-form` + `.token-details__quantity-save`/
  `.token-details__quantity-cancel` (the committed edit mode, opened by
  either Add or Edit) - there is no more "Attach" button or always-visible
  form. Warning is unchanged: still an always-visible preset grid, its
  attached value still rendered as `.token-details__attachment` (the one
  remaining use of that class - Quantity no longer uses it). Edit/Remove's
  aria-labels stay dynamic (e.g. `"Remove 3 kg"`), unlike DurationField's
  static `"Remove token time"`, so locate them by class
  (`.token-details__quantity-edit`/`-remove`/`-save`) rather than
  `getByRole` with a guessed name. Locate everything by scoping through
  `page.locator(".token-details")`, not `.token-attachment-picker`
  (deleted) or a `getByRole("tab", ...)` call (no tabs exist here anymore -
  `TokenPicker`'s own "Add to step" category switcher is unrelated and, as
  of 2026-09-17, `role="radiogroup"`/`role="radio"`, not tabs - locate its
  options with `getByRole("radio", ...)`).
- **`netstat`'s state column is localized** ("ABHÖREN" instead of
  "LISTENING" on this German-Windows install), so `grep LISTENING`
  silently finds nothing. Use PowerShell's `Get-NetTCPConnection
  -State Listen` instead - it's locale-independent.
- **SVG `tabindex` must be lowercase in JSX**, not `tabIndex`
  (React/HTML camelCase convention). Preact sets whatever case you
  write as the literal attribute name for SVG elements - `tabIndex="0"`
  silently becomes a dead attribute the browser doesn't recognize,
  and the element is skipped entirely in Tab order. Confirmed by
  driving the app: `document.activeElement` never landed on the
  `.instruction-canvas__badge`/`.instruction-canvas__chip-remove`
  elements until the attribute was changed to `tabindex`. The driver's
  `CANVAS_KEYBOARD_FOCUSABLE` check is a regression test for exactly
  this.
- The Bash tool's shell doesn't inherit Node's PATH entry by default
  on this machine - always `export PATH="/c/Program
  Files/nodejs:$PATH"` first, or `node`/`npm`/`npx` won't resolve.
- **Testing drag-and-drop with `page.mouse.move/down/up` needs a real
  drop point, not a boundary tie.** The step-reorder drop index
  (`resolveStepDropIndex`, `lib/pointer-drag.ts`) is
  computed by comparing the drop `clientY` against each step's
  vertical midpoint; dropping exactly on a step's center is a genuine
  tie (the app then treats it as "same position," a no-op) rather than
  a bug - drop near a step's top/bottom edge instead, the way a real
  drag gesture would.
- **A correctly-rendered SVG element can still be visually invisible.**
  The token connector lines initially had valid `d` coordinates and a
  correctly-applied `stroke` (confirmed via `getComputedStyle` and
  `getBBox()` in the DOM) but were imperceptible in an actual
  screenshot - the gap they were drawn in was only 8 design units
  wide with a pale `#bbb` stroke, nearly invisible against the light
  chip/step backgrounds. DOM/style inspection alone said "this is
  correct"; only looking at a real (ideally cropped/zoomed) screenshot
  caught it. Fixed by widening the gap and darkening/thickening the
  stroke. Don't trust computed-style checks alone for "is this
  visible" - read an actual screenshot.
- **Persistence is debounced (200ms) - don't reload immediately after
  an edit.** Reloading with zero pause right after a drag/edit loses
  that change even though the app is working correctly: the page's JS
  realm tears down before the debounce timer fires, and a
  `pagehide`/`visibilitychange` flush doesn't reliably survive a
  same-tab `reload()` in Chromium either (see
  `docs/known-issues.md`). `page.waitForTimeout(300)` before reload is
  enough, matching how a real user actually closes tabs.
- **`locator.count()` doesn't auto-wait - `setInputFiles` on the Import
  file input does, but the app's reaction to it doesn't.** `setInputFiles`
  resolves once the file is attached and the `change` event dispatched, but
  `App`'s handler is `async` (`await file.text()` before anything else
  happens), so a `.count()` check immediately after `setInputFiles` reads
  the DOM *before* the toast or confirm dialog has had a chance to appear -
  a false negative that looks exactly like the feature being broken, not
  like a timing issue. `.textContent()`/`.click()` auto-wait for their
  target and so didn't hit this, only the plain `.count()` checks did.
  Fixed by `await page.locator(".app__toast").waitFor()` (or an equivalent
  wait for whatever should appear) before any `.count()` check that follows
  an async-triggering action. Caught by deliberately breaking `migrate`'s
  validation to confirm the regression check actually failed - it didn't,
  even against genuinely broken code, until this wait was added.
- **A "wrong-shaped file" import test payload must be chosen so it
  couldn't *also* fail for an unrelated reason.** An early version of the
  driver's wrong-shape test omitted `steps` entirely - `migrate` correctly
  rejected it, but so would have `validateDocument` (called right after,
  to compute the confirm dialog's incomplete-step count) crashing on
  `undefined.map`, landing in the same `catch` block either way. That
  masked whether `migrate`'s own check mattered at all. The fix was a
  payload `migrate` should reject but `validateStep`'s own logic
  (`tokens.length`, `.some(t => t.category === "action")`) tolerates
  without throwing - a step with a real `tokens` array containing one
  garbage-shaped token - so only `migrate`'s `isValidToken` check stands
  between it and the confirm dialog. Confirmed by breaking exactly that
  check (and no other) and watching the test fail.

- **Seeding IndexedDB directly (bypassing the app) needs `idb-keyval`'s
  actual db/store names, not guesses.** There's no UI path that produces a
  document with a mismatched `schemaVersion` (only two intakes exist: the
  IndexedDB load path and the JSON import path, and import always runs the
  current app's own `migrate`/`CURRENT_SCHEMA_VERSION`) - the only way to
  test the load path's handling of one is to write directly into IndexedDB
  via `page.evaluate` before `page.reload()`. `idb-keyval`'s default store
  (`get`/`set` with no explicit store argument, which is how
  `state/persistence.ts` calls it) lives at IndexedDB database
  `"keyval-store"`, object store `"keyval"`, keyed by the string passed to
  `get`/`set` (e.g. `"instruction-builder:document"`) - confirmed by reading
  `node_modules/idb-keyval/dist/index.js`'s `createStore` call, not
  documented anywhere in this project. Reading it back the same way
  afterward (rather than trusting a UI signal) is what lets the
  `VERSION_MISMATCH_HANDLED_SAFELY` check confirm the old record survived
  the reload untouched, not just that a toast happened to appear.

- **Task 15 added a second, permanently-mounted, hidden canvas - every bare
  `page.locator(".instruction-canvas__*")` now risks matching both.** `App`
  keeps an always-rendered, hidden `InstructionCanvas readOnly` around
  (`.app__export-canvas`, `position: absolute; width: 0; height: 0;
  overflow: hidden` - not `display: none`, so it still renders normally,
  just clipped from view) purely so Export SVG always has a live node to
  serialize. It renders the same document as the visible editor, so
  `.instruction-canvas__token`/`__chip-label`/`__tokens`/`__connector`/
  `__step-bg`/`__step-time`/`__badge`/`__step-title`/`[data-step-index]` etc.
  now match twice - this includes the step management controls (drag
  handle, remove, move up/down, add-step row) that moved onto the canvas
  from the old StepList panel, none of which are exempt from this. Most `.first()`/
  `.nth(k)` uses in this driver happen to still resolve correctly purely by
  DOM order (the hidden canvas is mounted after `.app__main` in the JSX
  tree, so it always comes *after* the real ones) - but relying on that
  coincidence is fragile and `.count()`-based checks like `CONNECTOR_COUNT`
  would silently double-count. Fixed by scoping every editor-specific
  locator through a driver-level `editableCanvas` (`page.locator(".app__main")`)
  instead of querying `page` directly. The one bug this actually caused,
  not just risked: `.instruction-canvas--readonly` is a class the hidden
  canvas *always* has, so `page.waitForSelector(".instruction-canvas--readonly")`
  (meant to wait for Preview mode) resolved instantly from the very first
  page load, long before Preview was ever toggled - the check downstream
  happened to still pass (Preview mode was already active in practice by
  the time it ran), so this would have stayed silently broken. Fixed by
  waiting on `.app__main--preview` instead, the one class that's actually
  unique to Preview mode being on.

- **A plain `XMLSerializer` dump of the canvas loses every color and font -
  confirm the *content* of an exported file, not just that a download
  happened.** The canvas's appearance comes entirely from CSS classes in
  `global.css`; `XMLSerializer` only serializes DOM markup, never the
  stylesheet. `SVG_EXPORT_IS_SELF_CONTAINED_AND_STYLED` checks the
  downloaded file's raw text for `rgb(245, 246, 249)` (the resolved value
  of a design token used for every chip's fill) specifically because a
  naive implementation would produce a file that still has the right
  shapes and passes a shallow "did a `.svg` file download" check, while
  actually being useless - confirmed by testing the naive `XMLSerializer`-
  only approach directly before the style-baking fix existed and seeing
  exactly this (correct markup, no color).

- **A PNG's pixel dimensions are readable straight out of the file, no
  image-decoding library needed.** The PNG signature (8 bytes) is always
  immediately followed by the `IHDR` chunk's 4-byte length + 4-byte type,
  then width and height as big-endian `uint32`s - so
  `buffer.readUInt32BE(16)`/`readUInt32BE(20)` on the raw downloaded file
  gives exact pixel dimensions with nothing but Node's built-in `Buffer`.
  `PNG_EXPORT_IS_RASTERIZED_AT_PIXEL_DENSITY` uses this to confirm the
  file's actual size is the exported SVG's own width/height × the declared
  `pixelDensity` - a check that "did a `.png` download" alone can't catch:
  a rasterization bug that silently fell back to 1x (or any other wrong
  scale) would still produce a valid, openable PNG, just the wrong size.

- **Export PDF downloads a real file now, checked the same way as SVG/PNG
  - `window.print()` is gone from the button entirely (2026-09-17,
  `task-30-user-feedback-fixes-7.md`).** `page.waitForEvent("download")`
  plus a `%PDF-` signature check on the saved bytes is all "Export PDF"
  needs now, same as every other export format - no more `beforeprint`
  listener trick. The `@media print` stylesheet from the old baseline is
  still real, but it's now purely an unsupported fallback for a user's own
  Ctrl+P/File>Print, entirely disconnected from the button - checked
  separately via `page.emulateMedia({ media: "print" })`, which applies the
  exact CSS a real print/"Save as PDF" would with no dialog involved.
  Don't forget to `page.emulateMedia({ media: "screen" })` back afterward -
  a run that skips this leaves every later screenshot rendered under print
  rules, making everything past that point look broken.
- **A generated PDF's page count is readable straight out of the raw
  bytes, no PDF-parsing library needed.** jsPDF writes each page as an
  uncompressed `/Type /Page` object (no stream compression enabled), so
  `pdfBuffer.toString("latin1").match(/\/Type\s*\/Page(?!s)/g)` over the
  whole downloaded file counts real pages directly - the negative
  lookahead excludes `/Type /Pages`, the one page-*tree* root object every
  PDF also has, which would otherwise inflate the count by one.
  `PDF_EXPORT_PRODUCES_MULTIPLE_PAGES` uses this against a dedicated
  18-step/4-tokens-per-step throwaway document (imported the same way the
  real Import tests further down do, then undone) to confirm pagination
  genuinely splits long content into more than one page - `lib/
  pdf-pagination.ts`'s own Vitest suite already proves the pure algorithm
  never splits a step or leaves a blank page in isolation; this is the one
  check that the real DOM-bounds-in/jsPDF-out pipeline does the same thing
  end-to-end. Rendering the PDF's pages as images to eyeball step
  boundaries directly would need `pdftoppm`/poppler-utils, which isn't
  installed on this machine - not pursued, since the page-count check plus
  the unit-tested algorithm together already cover the actual invariant.

- **This file's own top-level `const URL = ...` (the dev server URL, from
  argv) shadows the global `URL` constructor for the rest of the module.**
  `new URL("../../../node_modules/axe-core/axe.min.js", import.meta.url)`
  fails with `TypeError: URL is not a constructor` here specifically
  because of that shadowing - it isn't a Node version issue or a typo.
  Resolve module-relative paths with `path.join(path.dirname(fileURLToPath(import.meta.url)), ...)`
  (`node:url`'s `fileURLToPath` + `node:path`) instead, never `new URL(...)`,
  anywhere in this file.
- **Content inside a closed native `<details>` isn't focusable - a driver
  check assuming otherwise fails silently (`false`), not with a thrown
  error.** `StepDetails`' "Tokens in this step" list lives inside a
  `<details>`, collapsed by default since the 2026-09-17 rework (see
  `task-30-user-feedback-fixes-6.md`). `.focus()`/`.press(...)` on a button
  inside a *closed* `<details>` resolve without throwing (Playwright's
  actionability check doesn't catch this the way it catches a genuinely
  `display: none` element), but focus never actually moves - so a check
  built on "focus it, press Enter, assert the result" silently reports
  `false` instead of failing loudly, exactly the kind of false negative
  that's easy to miss since nothing in the run looks broken.
  `TOKEN_SELECTED_VIA_KEYBOARD` was wrong for this reason - confirmed by a
  standalone script directly comparing `document.activeElement` with and
  without first opening the `<summary>`. Fixed by having the driver open
  the `<summary>` (focus it, press Enter) before trying to focus anything
  inside the `<details>`, matching the real keyboard path a screen reader
  or keyboard-only user would actually take.
- **The canvas's SVG token chips are deliberately pointer/touch-only, even
  after task 22 - token *selection* has a keyboard path, but it's a
  different element.** `StepDetails.tsx`'s "Tokens in this step" list
  (`.step-details__token-button`) is the keyboard-operable way to select a
  token, not the canvas chip itself - it only renders once a step is
  already selected, which is exactly when the canvas's two-stage select
  rule would allow a token click anyway. `TOKEN_SELECTED_VIA_KEYBOARD`
  drives that list, not `.instruction-canvas__token`. Don't add `.focus()`/
  keyboard-press assertions against the canvas token chips expecting them
  to select anything - they won't; only the badge (step select) and
  chip-remove (token remove) are keyboard-interactive inside the SVG.

- **`public/sw.js` is never registered against the dev server, only a
  production build - don't expect `driver.mjs` (which drives `npm run
  dev`) to exercise it at all.** `src/main.tsx` gates registration behind
  `import.meta.env.PROD` specifically so Vite's fast-refreshing, unhashed
  dev modules never fight with a caching service worker. Use
  `pwa-check.mjs` (see "PWA verification" above) against `npm run build &&
  npm run preview` instead.
- **A page reload's navigation `Request` can carry `cache:
  "only-if-cached"` paired with `mode: "navigate"` (not `"same-origin"`) -
  re-fetching that exact `Request` object inside a service worker's
  `fetch` handler throws immediately** (`TypeError: 'only-if-cached' can
  be set only if 'mode' is 'same-origin'`), breaking every reload outright
  while online, not just offline. This is a general constraint of
  intercepting navigation requests in *any* service worker, not anything
  specific to this app - `sw.js`'s `fetch` handler checks for exactly this
  combination and returns early (letting the browser handle that one
  request natively) before doing anything else. See
  `docs/fixed-issues/service-worker-broke-every-page-reload.md`.
- **A service worker's `response.clone()` must happen synchronously,
  before anything else touches the response - cloning inside an
  already-async `.then()` throws silently and drops the write with no
  visible symptom.** `Response.clone()` throws
  (`"Response body is already used"`) the instant a response's body has
  been read at all, which - once a response has been handed to the page
  via `event.respondWith` - can happen at any point after, often well
  before an async `caches.open(...).then(...)` chain gets around to
  cloning it. The rejected promise inside that unawaited `.then()` fails
  silently: the page still renders correctly (the *original*, unconsumed
  response was returned to it), so nothing looks broken without
  deliberately reading `caches.open(...).keys()` back afterward and
  finding it empty. `sw.js`'s `cachePut` clones immediately on receiving
  the response, before doing anything else, and separately wraps the
  actual cache write in `event.waitUntil` (a fetch event's own promise is
  the only thing the browser guarantees to wait for - a bare `.then()`
  chain hanging off nothing can still be dropped if the SW is freed
  first). See
  `docs/fixed-issues/service-worker-never-actually-cached-anything.md`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Error: Port 5173 is already in use` on dev server start | A server from an earlier run is still up. `curl -sf http://localhost:5173` to confirm it's this app, then just point the driver at it - no need to restart. |
| `playwright install msedge` errors with "insufficient privileges" | Expected on this machine (see Gotchas). Use `npx playwright install chromium` instead; the driver launches `chromium`, not `msedge`. |
| Screenshot shows the canvas tokens as tiny/illegible at mobile width | Known area of active work - the canvas SVG scales its whole viewBox to the container width. Check `src/styles/global.css`'s `.instruction-canvas__svg` rule for the current min/max clamp before assuming it's still broken. |
