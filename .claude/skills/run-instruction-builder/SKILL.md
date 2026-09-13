---
name: run-instruction-builder
description: Build, start, and drive the Visual Instruction Builder Preact/Vite dev app in a real browser to check a UI change - screenshots the canvas/step-list/token-picker, exercises step/token select, category tabs in "Add to step"/"Add to token", attaching a Quantity or Warning to a token and removing it, setting an independent duration on a token and a step via DurationField (and the step/token-switch-while-editing regression it once had), drag-and-drop (adding, moving, and reordering, including the live insertion-point marker), undo/redo (buttons and keyboard shortcuts, including that continuous typing coalesces into one undo step), JSON export/import (including the incomplete-steps warning, the confirm-before-replace dialog, invalid-file rejection, and that import goes through undo/redo too), the token connector lines, the read-only preview toggle, and IndexedDB persistence across a reload, and checks the console for errors. Use for "run the app," "screenshot the instruction builder," "check this UI change works," "does drag-and-drop work," "does token attachment work," "does step/token time work," "does undo/redo work," "does export/import work," or "does the canvas render correctly."
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
npm run build
```

There is no automated test suite yet (Vitest is planned for Phase 2
task 20, not implemented) - `lint`/`typecheck`/`build` are the only
checks that exist today.

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
   lands on the canvas chip's label, then exercises "Add to token":
   switches that picker's own category tabs to attach a Warning (a
   preset button) and a Quantity (a validated amount+unit form - Time
   is not offered here, see below) to the selected token, confirms the
   canvas chip grows two corner badges and Token details lists two
   attachments, removes one via Token details, and confirms both drop
   to one. It also reproduces a real bug found in code review (see
   docs/Fixed-Issues.md): typing a draft amount/unit into the Quantity form
   and switching to a *different* token without attaching must not leave
   the new token's form showing the old token's unsaved draft. It then
   exercises Time - set independently on a token *and*
   a step via the `DurationField` control inline in Token/Step
   details (day/hour/minute/second boxes) - confirming the canvas's
   centered duration header above the step shows the token's time
   first, then the step's own explicit time once set (which takes
   precedence). It also reproduces a real bug found in manual testing
   (see docs/Fixed-Issues.md): starting an edit on one token's (or
   step's) time and switching to a different one *without* saving must
   not leave the new selection showing the old one's stale, unsaved
   editing form. It removes a token via the canvas's own remove
   control, checks that canvas controls are keyboard-focusable, and
   counts the connector lines drawn between a step's tokens, then
   exercises drag-and-drop with real `page.mouse` drags: dragging a
   picker token onto a step's canvas area, dragging an existing canvas
   token from one step to another (checking the live insertion-point
   marker is visible mid-drag, before release), and dragging a step in
   the list to reorder it. Both the token-within-step and step-list drags
   include a forward-direction regression check (see docs/Fixed-Issues.md):
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
   (mobile) and screenshots that too. Finally it exercises tasks 18/19
   (JSON Export/Import): adds a temporary empty step, clicks Export, and
   confirms the downloaded file (captured via `page.waitForEvent("download")`)
   is the current document under a filename derived from `meta.title`, and
   that a non-blocking warning toast names the number of incomplete steps
   (task 14's link into export) without the download itself being blocked;
   removes the temporary step again afterward. It then imports a small valid
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
   the dialog closes with nothing changed. It prints `SCREENSHOTS_DIR=...`,
   `TABS_FILTER_TOKENS=...`, `TOKEN_SELECTED_AFTER_FIRST_CLICK=...`,
   `TOKEN_LABEL_UPDATED=...`, `ATTACHMENTS_WORKED_END_TO_END=...`,
   `QUANTITY_FORM_RESETS_PER_TOKEN=...`,
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
   `PERSISTED_ACROSS_RELOAD=...`, `CANVAS_KEYBOARD_FOCUSABLE=...`,
   `JSON_EXPORT_DOWNLOADS_CURRENT_DOCUMENT=...`,
   `JSON_EXPORT_WARNS_ABOUT_INCOMPLETE_STEPS=...`, `TOAST_DISMISSIBLE=...`,
   `IMPORT_DIALOG_MENTIONS_STEP_COUNT=...`, `IMPORT_UNDO_REDO_WORKED=...`,
   `IMPORT_REJECTS_INVALID_FILE=...`,
   `IMPORT_CANCEL_LEAVES_DOCUMENT_UNCHANGED=...`, and any console errors it
   captured. **Read the screenshots** (e.g. with the Read tool) - don't just
   check the exit code.

3. Stop the server when done (find the PID by port - see Gotchas for
   why `lsof` doesn't work here):

   ```powershell
   Get-NetTCPConnection -LocalPort 5173 -State Listen |
     ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
   ```

## Run (human path)

```bash
npm run dev
```

Opens on `http://localhost:5173/` (or the next free port if 5173 is
taken - watch the terminal output for the actual URL).

## Gotchas

- **`npx playwright install msedge` fails on this machine** with
  "Failed to install Microsoft Edge... insufficient privileges." Edge
  is only partially installed here (`Program Files
  (x86)\Microsoft\Edge\Application\<version>\` exists but has no
  `msedge.exe` in it - just a stub/manifest). Don't try to fix Edge;
  `npx playwright install chromium` works with no admin rights and is
  what the driver uses.
- **`.step-list__remove` is a sibling of `.step-list__item`, not a
  descendant of it** - the class names suggest nesting, but `StepList.tsx`
  puts them as two sibling `<button>`s under the same `<li
  data-step-index>`. `page.locator(".step-list__item").nth(n).locator(".step-list__remove")`
  times out (no such descendant exists) even though the remove button is
  right there in the DOM. Scope to the shared `<li>` instead, e.g.
  `page.locator("[data-step-index='n']").locator(".step-list__remove")`.
- **`getByRole('button', { name: 'Chop' })` matches two elements** -
  the token picker's "Chop" button and the step-list item once a step
  is titled "Chop the onion" (Playwright's role-name matching is
  substring-based, so "Chop the onion" matches "Chop"). Scope the
  locator to `.token-picker` or pass `exact: true`.
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
  drop point, not a boundary tie.** The StepList reorder drop index is
  computed by comparing the drop `clientY` against each item's
  vertical midpoint; dropping exactly on an item's center is a genuine
  tie (the app then treats it as "same position," a no-op) rather than
  a bug - drop near an item's top/bottom edge instead, the way a real
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
  `docs/Known-Issues.md`). `page.waitForTimeout(300)` before reload is
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

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Error: Port 5173 is already in use` on dev server start | A server from an earlier run is still up. `curl -sf http://localhost:5173` to confirm it's this app, then just point the driver at it - no need to restart. |
| `playwright install msedge` errors with "insufficient privileges" | Expected on this machine (see Gotchas). Use `npx playwright install chromium` instead; the driver launches `chromium`, not `msedge`. |
| Screenshot shows the canvas tokens as tiny/illegible at mobile width | Known area of active work - the canvas SVG scales its whole viewBox to the container width. Check `src/styles/global.css`'s `.instruction-canvas__svg` rule for the current min/max clamp before assuming it's still broken. |
