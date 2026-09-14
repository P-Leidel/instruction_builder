import { useEffect, useRef } from "preact/hooks";

/**
 * Shared modal focus behavior for a two-button (Cancel/Confirm)
 * `alertdialog` confirming a destructive action - focuses Cancel the
 * moment it opens (the safer default), traps Tab between the two buttons
 * so it can't silently escape to whatever's underneath, and closes on
 * Escape. First written for ImportConfirmDialog (task 19); extracted here
 * once NewDocumentConfirmDialog (task 28) needed the exact same behavior,
 * rather than a second hand-copied version of this same keyboard logic.
 *
 * Only two buttons ever live in either dialog, so trapping Tab between
 * them via two explicit refs is simpler and more robust than a
 * general-purpose "find all focusable elements" query.
 *
 * Returns three ready-to-spread prop bags (`{...dialogProps}` on the
 * dialog wrapper, `{...cancelButtonProps}`/`{...confirmButtonProps}` on
 * the two buttons) rather than raw refs and a bare `handleKeyDown` - a
 * 2026-09-14 architecture review flagged the raw-ref version as an
 * unenforced contract (nothing stopped a caller from forgetting
 * `onKeyDown` on the wrapper, or swapping which ref went on which
 * button, and a missing ref fails silently - see
 * docs/phase-3/audits/2026-09-14-architecture-review.html). Named,
 * spreadable bags don't add compile-time enforcement either, but they
 * collapse three separately-named manual wiring steps into three
 * self-descriptive spreads, a meaningfully smaller mistake surface.
 */
export function useConfirmDialogFocusTrap(open: boolean, onCancel: () => void) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== "Tab") return;
    const cancelButton = cancelRef.current;
    const confirmButton = confirmRef.current;
    if (!cancelButton || !confirmButton) return;
    if (event.shiftKey && window.document.activeElement === cancelButton) {
      event.preventDefault();
      confirmButton.focus();
    } else if (!event.shiftKey && window.document.activeElement === confirmButton) {
      event.preventDefault();
      cancelButton.focus();
    }
  }

  return {
    dialogProps: { onKeyDown: handleKeyDown },
    cancelButtonProps: { ref: cancelRef },
    confirmButtonProps: { ref: confirmRef },
  };
}
