# QuantityForm draft amount/unit leaked from one token to the next

> 📌 **Doc status: CURRENT** — one entry in the [Fixed Issues log](./README.md).

- **What broke:** typing a draft amount/unit into "Add to token"'s Quantity
  form for one token, then switching to a *different* token without
  clicking Attach, left the new token's Quantity form showing the previous
  token's unsaved draft instead of resetting to the default (1, first
  unit).
- **Root cause:** `QuantityForm` (`TokenAttachmentPicker.tsx`) held its
  draft `amountText`/`unit` in local `useState`, but was rendered with no
  `key` tied to the selected token - Preact reused the same component
  instance (and its state) across a token switch instead of remounting it.
  The same bug class had already been found and fixed for `DurationField`
  elsewhere in the codebase; this instance of it was missed at the time.
- **Fix:** added `key={token.id}` to `<QuantityForm />`, forcing a fresh
  instance (and fresh default state) per selected token.
- **Verified by:** a dedicated Playwright regression check
  (`QUANTITY_FORM_RESETS_PER_TOKEN`) that types a draft, switches tokens,
  and asserts the form reset to its defaults - confirmed it fails on the
  pre-fix code and passes after.
- **Found & fixed:** 2026-09-13 (via code review, `docs/phase-2/reviews/2026-09-13-1539-review.md`).
