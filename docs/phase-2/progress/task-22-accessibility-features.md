# Task 22 — Add Accessibility Features

> 📌 **Doc status: CURRENT** — one file in the
> [Phase 2 Progress Log](./README.md).

The plan's own scope for this task: "Improve inclusivity and usability,
including a keyboard-operable alternative to drag-and-drop (e.g. move-up/
move-down buttons on each step) - accessible drag-and-drop is a known hard
problem, and building the keyboard path now is cheaper than retrofitting a
DnD library later." Scoped with the user before starting, the same
audit-first way as task 21: run an automated axe-core scan plus a manual
keyboard walkthrough first, then fix only what that found, rather than a
speculative accessibility rewrite.

## Scoping decisions (made with the user before starting)

A code read-through ahead of the audit found something the plan text
doesn't mention: `InstructionCanvas.tsx` carried its own comment stating
tokens have no keyboard role at all - only a step's header badge was
keyboard-reachable, meaning a keyboard-only user could select a step but
never a token, leaving Token Details, attachments, and per-token duration
entirely unreachable without a mouse. Three decisions were made explicitly
before writing any code:

1. **Token keyboard selection is in scope**, on top of the plan's literal
   step-reorder ask - the gap above is a real barrier, not polish.
2. **Keyboard-operable step reordering only, not token reordering** - a
   keyboard way to reorder a token within its step or move it to a
   different step (task 9's cross-step drag) is deliberately deferred; see
   [../../known-issues.md](../../known-issues.md).
3. **Audit method: automated (axe-core) + manual keyboard walkthrough** -
   axe-core systematically catches mechanical issues (missing labels,
   color contrast) a manual pass alone would likely miss; the manual pass
   catches interaction issues (focus order, focus traps) axe can't see.

## Audit method

`axe-core` was added as a devDependency and run (via a scripted Playwright
pass, `axe.min.js` injected with `page.addScriptTag`) against eight
distinct app states: initial load, a step+token added, a token selected
(Token Details visible), a token with an attachment, Preview mode, a
warning toast visible, the Import confirm dialog open, and a 390px mobile
viewport. A second, manual pass drove the app with the mouse disabled -
Tab/Shift+Tab/Enter/Space/Escape only - through step selection, token
selection, step reordering, and the Import dialog, checking focus order,
focus visibility, and that every action reachable by mouse was also
reachable by keyboard.

## What was found and fixed

Four real gaps - two flagged by axe-core, two found by the manual pass:

1. **The accent color's white text/icons fell short of WCAG AA contrast**
   (4.3:1 against the 4.5:1 minimum) - the Preview toggle, an active
   picker tab, and the Import dialog's Replace button. Fixed by darkening
   `--color-accent` from `#4f6bff` to `#4b66f2` (~4.69:1) at the single
   design-token level, so every current and future white-on-accent surface
   inherits the fix. See
   [../../fixed-issues/accent-color-failed-contrast-minimum.md](../../fixed-issues/accent-color-failed-contrast-minimum.md).
2. **The hidden Import file input had no accessible label** - a screen
   reader landing on the real `<input type="file">` behind the visible
   "Import" button had no way to know what it was for. Fixed with
   `aria-label="Import instruction file"`. See
   [../../fixed-issues/import-file-input-had-no-accessible-label.md](../../fixed-issues/import-file-input-had-no-accessible-label.md).
3. **No keyboard path to reorder a step** - StepList already supported
   drag reordering (task 9) with no keyboard equivalent. Added Move
   up/Move down buttons per step (disabled at the first/last position),
   calling the same `reorderSteps` the drag handler already used.
4. **No keyboard path to select a token at all** - confirmed in code
   before the audit even started (see "Scoping decisions" above). Rather
   than adding SVG-level keyboard handling to the canvas's token chips
   (fragile across screen readers - this project already hit an SVG `tabindex`
   casing bug once, see
   [../../fixed-issues/svg-canvas-tabindex-casing.md](../../fixed-issues/svg-canvas-tabindex-casing.md)),
   `StepDetails`' existing "Tokens in this step" list - previously plain,
   non-interactive `<li>`s - became a list of buttons that call
   `selectToken` directly. That list already only renders once a step is
   selected, so the canvas's two-stage select rule (a token only becomes
   selectable once its step is) is automatically satisfied for free; the
   selected token gets `aria-current` and a visible highlight. The canvas's
   own SVG token chips stay pointer/touch-only, unchanged.

One further fix, found by the manual pass rather than either the plan or
axe (axe doesn't check focus management):

5. **The Import confirm dialog didn't behave like a modal** - `role="alertdialog"`
   was present, but nothing moved focus into it on open, Escape did
   nothing, and Tab could walk focus out into the page underneath. Fixed:
   focus moves to Cancel (the safer default for a "replace everything"
   action) the instant the dialog opens, Escape cancels exactly like
   clicking Cancel, and Tab is trapped between the dialog's two buttons.

## What was checked and found already correct

Every existing `aria-label`/`role`/focus-visible-outline pattern already in
the app (the canvas's step-select badge and token-remove buttons, every
form field, every toast, the token/attachment picker tabs) held up under
both the automated scan and the manual walkthrough - zero axe violations
and no keyboard-reachability gaps at any of the eight audited states after
the five fixes above. Color contrast for every other design token (body
text, muted text, the danger/warning colors) was checked by hand and
already clears WCAG AA.

Two smaller gaps were found and deliberately deferred rather than fixed
here - see
[../../known-issues.md](../../known-issues.md#two-accessibility-gaps-deliberately-left-for-a-later-pass):
no keyboard way to reorder a token within a step or move it between steps,
and the token/attachment picker tabs don't implement the full WAI-ARIA APG
Tabs keyboard pattern (roving tabindex + arrow keys) - they're fully
keyboard-operable via plain Tab/Enter/Space, just not via that specific
convention.

## Verification

`npm run lint`, `npm run typecheck`, `npm test` (107 tests, unaffected -
this task touched no model/state logic covered by them), and `npm run
build` all pass. The Playwright driver now also runs an axe-core scan at
three states (the populated main editor, the Import dialog open, and the
390px mobile viewport - `ACCESSIBILITY_VIOLATIONS_MAIN_EDITOR`,
`ACCESSIBILITY_VIOLATIONS_IMPORT_DIALOG`, `ACCESSIBILITY_VIOLATIONS_MOBILE`,
all `0`), keyboard-reorders a step and confirms both the swap and that
Move up/down are disabled at the list's boundaries
(`STEP_REORDERED_VIA_KEYBOARD`, `STEP_MOVE_BUTTONS_DISABLED_AT_BOUNDARIES`),
keyboard-selects a token via `StepDetails`' list and confirms Token Details
opens for it (`TOKEN_SELECTED_VIA_KEYBOARD`), and confirms the Import
dialog focuses Cancel on open, traps Tab between its two buttons, and
Escape closes it with the document left untouched
(`IMPORT_DIALOG_TRAPS_FOCUS_AND_ESCAPE_CLOSES`) - all passing, alongside
every pre-existing check, with `CONSOLE_ERRORS_COUNT=0`.

## Files touched

- `src/styles/global.css` - `--color-accent` darkened; new
  `.step-list__reorder`/`.step-list__move` styles; `.step-details__token`'s
  grid layout moved onto a new `.step-details__token-button` (plus
  `:hover`/`--selected` states).
- `src/app.tsx` - `aria-label` on the Import file input.
- `src/components/StepList/StepList.tsx` - Move up/down buttons per step.
- `src/components/StepDetails/StepDetails.tsx` - its token list items
  became buttons that call `selectToken`.
- `src/components/ImportConfirmDialog/ImportConfirmDialog.tsx` - focus-on-open,
  Tab trap, Escape-to-cancel.
- `.claude/skills/run-instruction-builder/driver.mjs` /
  `.claude/skills/run-instruction-builder/SKILL.md` - the new checks above.
- `docs/fixed-issues/` - two new entries (see "What was found and fixed").
- `docs/known-issues.md` - the two deliberately deferred gaps.
- `package.json` - `axe-core` added as a devDependency.
