import type { ComponentChildren } from "preact";
import { useConfirmDialogFocusTrap } from "../../lib/dialog-focus-trap";

interface ConfirmDialogProps {
  open: boolean;
  /** Used to derive `id="${idPrefix}-heading"`/`"${idPrefix}-body"` for the `aria-labelledby`/`aria-describedby` pair. */
  idPrefix: string;
  heading: string;
  body: ComponentChildren;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * The overlay/heading/body/actions markup `ImportConfirmDialog` and
 * `NewDocumentConfirmDialog` used to each write out separately - only
 * `useConfirmDialogFocusTrap`'s focus/Tab-trap/Escape behavior was shared
 * before this (2026-09-17 remediation, item 15). Each caller still owns its
 * own confirm/cancel logic (which session action to call, which toast to
 * show) - this only owns the shell and the focus trap wiring.
 */
export function ConfirmDialog({ open, idPrefix, heading, body, confirmLabel, onCancel, onConfirm }: ConfirmDialogProps) {
  const { dialogProps, cancelButtonProps, confirmButtonProps } = useConfirmDialogFocusTrap(open, onCancel);

  if (!open) return null;

  const headingId = `${idPrefix}-heading`;
  const bodyId = `${idPrefix}-body`;

  return (
    <div class="confirm-dialog-overlay">
      <div class="confirm-dialog" role="alertdialog" aria-labelledby={headingId} aria-describedby={bodyId} {...dialogProps}>
        <h2 id={headingId}>{heading}</h2>
        <p id={bodyId}>{body}</p>
        <div class="confirm-dialog-actions">
          <button type="button" class="confirm-dialog-cancel" onClick={onCancel} {...cancelButtonProps}>
            Cancel
          </button>
          <button type="button" class="confirm-dialog-confirm" onClick={onConfirm} {...confirmButtonProps}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
