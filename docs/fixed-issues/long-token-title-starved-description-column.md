# A long token title in Step details starved its description column

> 📌 **Doc status: CURRENT** — one entry in the [Fixed Issues log](./README.md).

- **What broke:** in Step details' "Tokens in this step" list, a token
  with a long, user-typed title left almost no room for its app-given
  description next to it - the description wrapped one word per line in a
  very narrow column, unreadable at phone widths, even though nothing
  visibly overflowed the page.
- **Root cause:** `.step-details__token` (renamed to `.step-details__token-button`
  in task 22, when that list became a set of keyboard-selectable buttons -
  the grid layout below moved with it) laid its icon/label/description
  out as a CSS Grid row with `grid-template-columns: auto auto 1fr`. An
  `auto` track sizes to its content's preferred (max-content) width first,
  before anything is given to the `1fr` track - so a long label claimed
  most of the row's width up front, and the description's `1fr` track only
  ever got whatever was left over.
- **Fix:** changed the label and description tracks to
  `minmax(0, 1fr) minmax(0, 1.3fr)` instead of `auto 1fr` - both can now
  shrink all the way to 0 and share the row's actual available width
  fairly, wrapping at a reasonable width each instead of one starving the
  other.
- **Verified by:** a screenshot at 360px with a long, deliberately chosen
  token title next to its (also non-trivial) description - before the fix,
  the description wrapped as a single-word-per-line stack; after, both
  columns wrap at a comparable, readable width.
- **Found & fixed:** 2026-09-14 (task 21, Build Responsive Layouts).
