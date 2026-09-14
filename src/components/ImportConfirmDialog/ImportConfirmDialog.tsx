import { pendingImport, toast } from "../../state/ui";
import { replaceDocument } from "../../state/document";
import { useConfirmDialogFocusTrap } from "../../lib/dialog-focus-trap";

/**
 * Task 19 (Import): a confirmation gate between a successfully parsed file
 * and it actually replacing the current document - rendered once at the app
 * root (like `DragGhost`) so it can overlay every panel. Only ever shown
 * once `App`'s file-input handler has already parsed and shape-validated
 * the file (see `parseImportedDocument`); this component's only job is the
 * user's explicit go/no-go, not any part of the parsing itself.
 *
 * Task 22: an `alertdialog` needs to actually behave like a modal for
 * keyboard/screen-reader users, not just carry the role - see
 * `useConfirmDialogFocusTrap` (`lib/dialog-focus-trap.ts`, shared with
 * task 28's NewDocumentConfirmDialog) for the focus/Tab-trap/Escape
 * behavior.
 */
export function ImportConfirmDialog() {
  const pending = pendingImport.value;

  function cancel(): void {
    pendingImport.value = null;
  }

  const { dialogProps, cancelButtonProps, confirmButtonProps } = useConfirmDialogFocusTrap(
    pending !== null,
    cancel,
  );

  if (!pending) return null;

  const importedDocument = pending.document;
  const stepCount = importedDocument.steps.length;

  function confirm(): void {
    replaceDocument(importedDocument);
    pendingImport.value = null;
    toast.value = { text: "Imported.", tone: "info" };
  }

  return (
    <div class="confirm-dialog-overlay">
      <div
        class="confirm-dialog"
        role="alertdialog"
        aria-labelledby="import-confirm-heading"
        aria-describedby="import-confirm-body"
        {...dialogProps}
      >
        <h2 id="import-confirm-heading">Replace current document?</h2>
        <p id="import-confirm-body">
          Importing "{importedDocument.meta.title}" will replace everything in
          the editor right now. It has {stepCount} step{stepCount === 1 ? "" : "s"}
          {pending.incompleteCount > 0
            ? `, ${pending.incompleteCount} incomplete`
            : ""}
          . You can undo this afterward.
        </p>
        <div class="confirm-dialog-actions">
          <button type="button" class="confirm-dialog-cancel" onClick={cancel} {...cancelButtonProps}>
            Cancel
          </button>
          <button type="button" class="confirm-dialog-confirm" onClick={confirm} {...confirmButtonProps}>
            Replace
          </button>
        </div>
      </div>
    </div>
  );
}
