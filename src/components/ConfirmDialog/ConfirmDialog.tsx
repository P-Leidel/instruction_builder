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
 * `useConfirmDialogFocusTrap`'s focus/Escape behavior was shared
 * before this (2026-09-17 remediation, item 15). Each caller still owns its
 * own confirm/cancel logic (which session action to call, which toast to
 * show) - this only owns the shell and the focus wiring.
 *
 * `aria-modal="true"` alongside `role="alertdialog"` (2026-09-18
 * architecture review, finding 7): these dialogs always behaved modally
 * and never said so, which left a screen reader in browse mode free to
 * walk the document behind them. The declaration is only honest because
 * `app.tsx` marks everything outside this dialog `inert` while one is
 * open - see CONTEXT.md's "Confirm dialog" for what modality commits this
 * app to, and `dialog-focus-trap.ts` for why the hand-rolled Tab cycle
 * that used to stand in for it is gone.
 */
export function ConfirmDialog({ open, idPrefix, heading, body, confirmLabel, onCancel, onConfirm }: ConfirmDialogProps) {
  const { cancelButtonProps } = useConfirmDialogFocusTrap(open, onCancel);

  if (!open) return null;

  const headingId = `${idPrefix}-heading`;
  const bodyId = `${idPrefix}-body`;

  return (
    <div class="confirm-dialog-overlay">
      <div
        class="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-describedby={bodyId}
      >
        <h2 id={headingId}>{heading}</h2>
        <p id={bodyId}>{body}</p>
        <div class="confirm-dialog-actions">
          <button type="button" class="confirm-dialog-cancel" onClick={onCancel} {...cancelButtonProps}>
            Cancel
          </button>
          <button type="button" class="confirm-dialog-confirm" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
