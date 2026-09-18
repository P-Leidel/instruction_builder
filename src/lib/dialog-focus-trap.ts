import { useEffect, useRef } from "preact/hooks";

/**
 * Shared modal focus behavior for a two-button (Cancel/Confirm)
 * `alertdialog` confirming a destructive action - focuses Cancel the
 * moment it opens (the safer default), closes on Escape from anywhere,
 * and returns focus to whatever opened the dialog when it closes. First
 * written for ImportConfirmDialog (task 19); extracted here once
 * NewDocumentConfirmDialog (task 28) needed the exact same behavior,
 * rather than a second hand-copied version of this same keyboard logic.
 *
 * **There is deliberately no Tab trap here any more** (2026-09-18
 * architecture review, finding 7). There used to be one: Tab cycled
 * between the two buttons via two explicit refs. It was removed at the
 * same time `app.tsx` started marking the rest of the page `inert` while
 * a confirm dialog is open, because `inert` already removes everything
 * behind the dialog from the tab order - as a property of the page, for
 * every focusable element, including ones added later - and two
 * mechanisms enforcing one rule is precisely the shape that was just
 * removed from `FieldPopover` (which declared `aria-modal="false"` while
 * cycling Tab, so the declaration and the behavior contradicted each
 * other). The hand-rolled cycle also only ever knew about two buttons: a
 * third control in a future dialog would have been silently unreachable.
 *
 * **Escape is a `window` listener, not the dialog's own `onKeyDown`.**
 * That was not a stylistic change. Without the Tab cycle, focus legitimately
 * leaves the dialog's subtree: past the last button the browser parks it on
 * `<body>` before starting the order again (everything else being `inert`,
 * there is nowhere else for it to go). A `keydown` handler on the dialog
 * element only ever sees keys that bubble *through* the dialog, so Escape
 * silently stopped closing the dialog the moment focus sat on `<body>` -
 * caught by the driver's own `IMPORT_DIALOG_TRAPS_FOCUS_AND_ESCAPE_CLOSES`
 * check when it started tabbing past two stops. Listening on `window`
 * matches what the native `<dialog>` element does, and is correct whether
 * or not focus happens to be inside.
 *
 * Focus return is the other half of modality and was missing entirely:
 * closing the dialog used to leave focus on `<body>`, so a keyboard user
 * had to Tab from the top of the page to get back to where they were.
 * `FieldPopover` already restored focus correctly; these two dialogs
 * didn't. It is restored from the effect's cleanup, which Preact runs
 * after the commit that removes `inert` - so the element being focused is
 * focusable again by the time this reaches for it.
 *
 * **The opener cannot be read from `document.activeElement` when the
 * dialog opens**, which is the non-obvious part. Marking the toolbar
 * `inert` *blurs* whatever was focused inside it, and that happens during
 * the same commit that mounts this dialog - so by the time any effect
 * runs, `activeElement` is already `<body>` and the opener is forgotten.
 * (The driver caught this as a straight `false`, not as anything visible.)
 * Hence the `focusin` log below: the last element focused *while the
 * dialog was closed* is the opener, recorded before `inert` can erase it.
 *
 * Returns one ready-to-spread prop bag (`{...cancelButtonProps}` on the
 * Cancel button) rather than a raw ref - a 2026-09-14 architecture review
 * flagged the raw-ref version as an unenforced contract (a missing ref
 * fails silently - see
 * docs/phase-3/audits/2026-09-14-architecture-review.html). The other two
 * bags this used to return are both gone with the behavior they wired up:
 * `confirmButtonProps` held the Tab cycle's second ref, and `dialogProps`
 * held the `onKeyDown` that Escape no longer travels through.
 */
export function useConfirmDialogFocusTrap(open: boolean, onCancel: () => void) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const lastFocusedWhileClosed = useRef<HTMLElement | null>(null);
  const focusOnClose = useRef<HTMLElement | null>(null);
  // Both read by listeners that are registered once rather than on every
  // render, so neither closes over a stale render's values while `open`
  // stays the open-effect's only dependency.
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    function rememberOpener(event: FocusEvent): void {
      // While open, every focus move is this dialog's own doing. And
      // `<body>` is what focus falls back to when `inert` blurs the real
      // opener - recording that would overwrite the very thing being
      // preserved.
      if (openRef.current) return;
      const target = event.target;
      if (target instanceof HTMLElement && target !== window.document.body) {
        lastFocusedWhileClosed.current = target;
      }
    }
    window.document.addEventListener("focusin", rememberOpener);
    return () => window.document.removeEventListener("focusin", rememberOpener);
  }, []);

  useEffect(() => {
    if (!open) return;

    focusOnClose.current = lastFocusedWhileClosed.current;
    cancelRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onCancelRef.current();
    }
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      // `isConnected`, because the opener can legitimately be gone by now -
      // both current triggers are permanent toolbar controls, but nothing
      // guarantees that for a future caller, and focusing a detached node
      // silently drops focus to <body> instead of leaving it where it is.
      const target = focusOnClose.current;
      focusOnClose.current = null;
      if (target?.isConnected) target.focus();
    };
  }, [open]);

  return {
    cancelButtonProps: { ref: cancelRef },
  };
}
