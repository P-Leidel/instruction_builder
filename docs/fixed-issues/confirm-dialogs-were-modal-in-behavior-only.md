# The confirm dialogs behaved like modals without ever declaring it

> 📌 **Doc status: CURRENT** — one entry in the [Fixed Issues log](./README.md).

- **What broke:** both confirm dialogs (Import's "Replace current
  document?" and New document's "Start a new document?") carried
  `role="alertdialog"` and looked modal, but three things a modal actually
  owes its users were missing. `aria-modal="true"` was never set and
  nothing behind the dialog was marked inert or hidden, so a screen reader
  in browse mode could still read and operate the whole page underneath a
  dialog asking whether to discard the user's work. Closing the dialog left
  focus on `<body>`, so a keyboard user had to Tab from the top of the page
  to get back to where they had been. The dialogs' only concession to
  modality was a hand-rolled cycle that bounced Tab between their own two
  buttons.
- **Root cause:** the behavior was assembled by hand, one piece at a time,
  as each dialog was built (task 19, then task 28), rather than from the
  question "what does `aria-modal="true"` commit us to?" The two-button Tab
  cycle in particular *looks* like modality and isn't: it knows about
  exactly two buttons, it does nothing for a screen reader in browse mode,
  and it says nothing about what is behind the dialog. Extracting the
  shared `ConfirmDialog` shell (2026-09-17) didn't introduce any of this -
  it is what made there be exactly one place to fix it.
- **Fix:** `aria-modal="true"` on the dialog, and `inert` on everything the
  app renders outside it - the toolbar, the main editor grid, and both
  banners between them - driven by a new `confirmDialogOpen()` in
  `app.tsx`. That helper is deliberately *not* the existing
  `keyboardShortcutsSuspended()` next to it, which also includes
  `previewMode`: Preview is not modal, and inerting the page during it
  would strand the user on a read-only canvas with no way back. The
  hand-rolled Tab cycle was **deleted** rather than kept alongside `inert`,
  because two mechanisms enforcing one rule is the exact shape that had
  just been removed from `FieldPopover`. Focus is now returned to whatever
  opened the dialog. See CONTEXT.md's "Confirm dialog" for the term this
  established, and `dialog-focus.ts` for the two non-obvious
  consequences below.
- **Two things the fix had to get right that weren't obvious:**
  - **Escape had to move to a `window` listener.** With the Tab cycle gone,
    focus legitimately leaves the dialog's subtree - past the last button
    the browser parks it on `<body>` before starting the tab order over.
    The dialog's own `onKeyDown` only ever saw keys bubbling *through* the
    dialog, so Escape silently stopped working the moment focus sat on
    `<body>`: the dialog became uncloseable by keyboard. This is what the
    native `<dialog>` element does at the document level, and now so does
    this.
  - **The opener can't be read from `document.activeElement` on open.**
    Marking the toolbar `inert` blurs whatever was focused inside it, in
    the same commit that mounts the dialog - so by the time any effect
    runs, `activeElement` is already `<body>` and the thing to return focus
    to has been forgotten. The hook now records the last element focused
    *while the dialog was closed* instead.
- **Verified by:** the driver's `IMPORT_DIALOG_CONTAINS_FOCUS_AND_ESCAPE_CLOSES`
  check, rewritten from "Tab cycles between exactly these two buttons" to
  the honest property - everything behind the dialog reports `inert`, six
  consecutive Tab presses never land on an element outside the dialog, and
  both dialog buttons are still reachable - plus a new
  `CONFIRM_DIALOG_RETURNS_FOCUS_TO_OPENER` check. Both of the non-obvious
  problems above were found by that rewritten check failing, not by
  reading the code: the Escape regression as a hard driver timeout, the
  focus-return gap as a plain `false`. axe-core reports zero violations at
  all five scanned states, the Import dialog among them.
- **Found & fixed:** 2026-09-18 (2026-09-18 codebase health review,
  finding 7).
