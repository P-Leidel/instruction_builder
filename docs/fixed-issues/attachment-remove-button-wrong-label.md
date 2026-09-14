# Attachment remove button labeled with the category name, not the actual value

> 📌 **Doc status: CURRENT** — one entry in the [Fixed Issues log](./README.md).

- **What broke:** the "×" button removing a Quantity or Warning from a
  token was labeled (for screen readers) "Remove Warnings" / "Remove
  Quantities" - the plural category name - regardless of which specific
  item it removed, so a token with only one attachment of a kind had no way
  to know *which value* a remove button referred to from its label alone.
- **Root cause:** the label was built from `CATEGORY_LABELS[kind]` (a
  fixed, category-level string) rather than the attachment's own value.
- **Fix:** label now reads `Remove ${attachment.label ?? CATEGORY_LABELS[kind]}`
  - e.g. "Remove Sharp!" or "Remove 250 g" - falling back to the category
  name only if an attachment somehow has no label of its own.
- **Verified by:** the Playwright driver's attachment-removal step, updated
  to locate the button by its new, specific accessible name.
- **Found & fixed:** 2026-09-13.
