# Unreachable `"note"` token category shared a name with an unrelated field

> 📌 **Doc status: CURRENT** — one entry in the [Fixed Issues log](./README.md).

- **What broke:** nothing user-visible - `TokenCategory` included a `"note"`
  value with no sample tokens behind it, so `TokenPicker`'s
  samples-only-category filter silently made it unreachable (no tab ever
  rendered for it). Its name also collided, in name only, with the
  unrelated `InstructionToken.note` free-text field.
- **Root cause:** the category was added to the `TokenCategory` union and to
  `TokenPicker`'s `STEP_TOKEN_CATEGORIES` list without ever adding matching
  content to `SAMPLE_TOKENS`.
- **Fix:** dropped `"note"` from `TokenCategory` and from
  `STEP_TOKEN_CATEGORIES`, since it was dead - the type already documents
  that new categories can be added later once there's real content for one.
- **Verified by:** `npm run lint`/`typecheck`/`build` passing, and a grep
  confirming no other code referenced the `"note"` category value.
- **Found & fixed:** 2026-09-13 (via code review, `docs/phase-2/reviews/2026-09-13-1516-review.md`).
