# Accessibility: `TokenPicker` category switcher becomes a radio group

> 📌 **Doc status: CURRENT** — one file in the
> [Phase 3 Progress Log](./README.md).

Date: 2026-09-17

Picked up from
[reviews/2026-09-17-external-audit-evaluation.md](../reviews/2026-09-17-external-audit-evaluation.md)'s
remediation plan (medium item 4), which itself re-evaluated a
`docs/known-issues.md` gap first noted 2026-09-14: `TokenPicker`'s category
switcher used `role="tablist"`/`role="tab"` without the WAI-ARIA APG Tabs
pattern's roving tabindex + arrow-key navigation - keyboard-operable via
Tab/Enter/Space, but not the idiomatic Left/Right-arrow convention some
screen reader users expect once they hear `role="tab"` announced. Scoped
with the user via `/mattpocock-skills:grilling` before any code changed.

## What shipped

Rather than completing the tabs pattern in place (the audit's other
option), the control was re-modeled as `role="radiogroup"`/`role="radio"` -
a closer semantic fit, since it filters one grid of tokens rather than
showing independent tabbed content. This gets correct keyboard behavior as
a property of the pattern itself:

- `aria-checked` replaces `aria-selected`; `aria-controls`/the grid's
  `role="tabpanel"` are dropped (there's no tab/panel relationship to
  describe anymore).
- `tabIndex` is derived inline (`category === active ? 0 : -1`) from the
  existing `activeTokenCategory` signal - no new state or ref, since that
  signal is already this component's one source of truth for which
  category is selected, and stays in sync automatically whether the
  category changed via click or arrow key.
- Left/Right arrow moves focus and selection together, wrapping at both
  ends (Right on "Tools" → "Actions", Left on "Actions" → "Tools"),
  matching a native `<input type="radio">` fieldset. Home/End support was
  deliberately skipped - real payoff shows up in wide widgets (10+
  options); for this control's 3 items it's marginal scope for marginal
  value.
- The logic lives inline in `TokenPicker.tsx`, not a shared helper -
  `known-issues.md` already noted `TokenPicker`'s were "the only tabs left
  in the app," so there's no second consumer to justify extracting one, per
  this project's existing precedent of not abstracting for a single use
  (e.g. `FieldPopover`'s edge-overflow logic).

See `src/components/TokenPicker/TokenPicker.tsx`'s own doc comment for the
full rationale.

## Driver update, and a second, unrelated bug it surfaced

`.claude/skills/run-instruction-builder/driver.mjs`'s `selectTab()` helper
(queried `getByRole("tab", ...)`) was renamed `selectCategory()` and
updated to `getByRole("radio", ...)` - every existing category switch in
the driver would otherwise have broken outright, not just missed new
coverage. A new check, `TOKEN_CATEGORY_ARROW_KEY_NAV_WORKS`, exercises
forward movement and wraparound in both directions, ending back on
"Actions" so it doesn't disturb the category the rest of the driver assumes
is active (the "Boil" drag-and-drop check later in the file).

Running the full driver for the first time in a while (see the external
audit evaluation's own note that `node_modules` wasn't installed to run
`npm test`/`lint`/`typecheck` at the time) surfaced an unrelated stale
check: `TOKEN_SELECTED_VIA_KEYBOARD` had been silently reporting `false`
since the 2026-09-17 rework that collapsed `StepDetails`' "Tokens in this
step" list into a native `<details>`, closed by default (see
[task-30-user-feedback-fixes-6.md](./task-30-user-feedback-fixes-6.md)).
Confirmed by driving both paths directly: this was a **stale test, not a
product bug** - a real keyboard user can still reach a token (Tab to the
`<summary>`, Enter to open it, Tab in, Enter to select), but content inside
a closed `<details>` isn't focusable, so the driver's old
`secondStepDetailsTokenButton.focus()` silently did nothing instead of
throwing, and `aria-current` never got set. Fixed by having the driver open
the `<summary>` first, matching the real keyboard path, rather than
assuming the list was already visible.

## Verification

- `npm run lint` / `npm run typecheck` / `npm test` (131 tests, unchanged -
  a component-only change with no `lib`/`state` logic touched) / all clean.
- Full Playwright driver run against the dev server, twice (once
  identifying the stale `TOKEN_SELECTED_VIA_KEYBOARD` check, once
  confirming the fix): every check `true`/`0`, zero console errors, zero
  axe-core violations at all three scanned states
  (`ACCESSIBILITY_VIOLATIONS_MAIN_EDITOR`/`_IMPORT_DIALOG`/`_MOBILE`).

## What's next

The external audit evaluation's remaining medium/big items - mobile layout
order, keyboard token movement, and the `TokenChip`/`StepCard` canvas
extraction - are still open; see
[reviews/2026-09-17-external-audit-evaluation.md](../reviews/2026-09-17-external-audit-evaluation.md)
for the full remediation plan.
