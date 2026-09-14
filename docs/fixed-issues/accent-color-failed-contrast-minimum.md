# The accent color's white text/icons fell short of WCAG AA contrast

> 📌 **Doc status: CURRENT** — one entry in the [Fixed Issues log](./README.md).

- **What broke:** white text on the app's accent blue (`--color-accent:
  #4f6bff`) - the Preview toggle button, a token picker's active category
  tab, and the Import confirm dialog's Replace button - only reached a
  4.3:1 contrast ratio. WCAG 2 AA requires 4.5:1 for normal-size text, so
  low-vision users could find these specific labels hard to read even
  though nothing else about the buttons looked broken.
- **Root cause:** the accent color itself was chosen for its look, not
  checked against WCAG's contrast formula - it happened to land just
  under the 4.5:1 line for white text/icons on top of it.
- **Fix:** darkened `--color-accent` from `#4f6bff` to `#4b66f2` (still the
  same hue, ~5% darker), which reaches ~4.69:1 against white - fixed at
  the single design-token level in `global.css` rather than per-component,
  so every current and future use of white-on-accent inherits the fix.
- **Verified by:** an axe-core audit run against eight different app states
  (initial load, a token selected, an attachment added, Preview mode, a
  toast visible, the Import confirm dialog open, and a 390px mobile
  viewport) - `color-contrast` was the only rule violated at any state
  before the fix (2-4 nodes per state, all resolving to this one color),
  and zero violations of any kind at any state after.
- **Found & fixed:** 2026-09-14 (task 22, Add Accessibility Features).
