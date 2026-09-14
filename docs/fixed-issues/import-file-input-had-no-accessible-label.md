# The hidden Import file input had no accessible label

> 📌 **Doc status: CURRENT** — one entry in the [Fixed Issues log](./README.md).

- **What broke:** the real `<input type="file">` behind the "Import"
  toolbar button (visually hidden, clicked programmatically - see
  `app.tsx`'s `importInputRef`) had no `aria-label`, no wrapping `<label>`,
  and no `title`/`placeholder` fallback. A screen reader landing on it
  (e.g. via a browser's form-controls list, which lists every input
  regardless of visibility) would announce it as an unlabeled file input
  with no indication of what it was for.
- **Root cause:** the visible "Import" button already describes the
  action, so the actual `<input>` it proxies for was never given a label
  of its own - an easy gap to miss since sighted mouse users never
  interact with the hidden input directly.
- **Fix:** added `aria-label="Import instruction file"` directly to the
  input.
- **Verified by:** an axe-core audit - the `label` rule flagged this input
  as a `critical`-impact violation at every one of eight app states tested
  before the fix, and zero violations after.
- **Found & fixed:** 2026-09-14 (task 22, Add Accessibility Features).
