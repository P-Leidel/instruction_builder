# DurationField showed a stale, unsaved edit after switching tokens or steps

> 📌 **Doc status: CURRENT** — one entry in the [Fixed Issues log](./README.md).

- **What broke:** if you clicked "Edit" (or "+ Time") on one token's or
  step's time, changed a value, and then selected a *different* token or
  step **without** saving or cancelling, the newly-selected token/step's
  Time field stayed stuck showing the previous one's unsaved editing form -
  reported by the user as time "not properly being displayed above the
  token."
- **Root cause:** `DurationField` keeps its own local `editing`/`draft`
  state. `StepDetails`/`TokenDetails` rendered it with no `key` prop, so
  Preact reused the *same component instance* across a token/step switch
  (same position in the render tree) - its internal state carried over
  instead of resetting for the newly-selected entity. Every other field in
  those panels (Title, Notes) is a plain controlled input with no local
  state of its own, which is why only this component could exhibit this
  class of bug.
- **Fix:** added `key={token.id}` / `key={step.id}` to the two
  `DurationField` usages, forcing Preact to mount a fresh instance (with
  reset state) whenever the selected token or step changes.
- **Verified by:** two dedicated Playwright regression checks
  (`DURATION_FIELD_RESETS_PER_TOKEN`, `DURATION_FIELD_RESETS_PER_STEP`) that
  reproduce exactly this sequence - start an edit, switch selection without
  saving, assert the new selection shows its own (unedited) state, not the
  old one's leftover form.
- **Found & fixed:** 2026-09-13.
