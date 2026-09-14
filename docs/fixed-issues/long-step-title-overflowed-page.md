# A long step title overflowed the page instead of truncating with an ellipsis

> 📌 **Doc status: CURRENT** — one entry in the [Fixed Issues log](./README.md).

- **What broke:** a step given a long, unbroken title (e.g. one long
  sentence with no early line-break opportunity) didn't truncate with the
  ellipsis `.step-list__summary` was already styled for
  (`overflow: hidden; text-overflow: ellipsis; white-space: nowrap`).
  Instead the step's whole row - and the entire page - grew wide enough to
  fit the untruncated title, forcing horizontal scroll on every screen,
  not just the step list.
- **Root cause:** `.step-list__summary` (the title text) is a `flex: 1`
  child of `.step-list__item` (the step row button), which is itself a
  `flex: 1` child of its `<li>`. Neither `.step-list__item` nor its
  ancestors had `min-width: 0`. A flex item's automatic minimum width
  defaults to its content's own un-wrapped size unless overridden - so with
  `white-space: nowrap` making the title's full length that "content size,"
  `.step-list__item` refused to shrink below it, and that refusal
  propagated all the way up to the page. The `flex: 1`/`text-overflow`
  styling on the summary itself was never reached, because its container
  never actually became narrower than the untruncated text.
- **Fix:** added `min-width: 0` to `.step-list__item` - the standard fix
  for "flex: 1 + text-overflow: ellipsis doesn't truncate." Once the item
  itself is allowed to shrink below its content's un-wrapped size, the
  existing ellipsis styling on `.step-list__summary` takes over correctly.
- **Verified by:** the same scripted six-width audit as the toolbar
  overflow fix above, using a step titled with a ~100-character sentence -
  confirmed 350-380px of page overflow at 360/390px before the fix
  (persisting across every later screenshot in the same test run, since the
  page never reloads between checks), zero after, with the title now
  visibly truncating to "A very long step title that coul…" in a
  screenshot.
- **Found & fixed:** 2026-09-14 (task 21, Build Responsive Layouts).
