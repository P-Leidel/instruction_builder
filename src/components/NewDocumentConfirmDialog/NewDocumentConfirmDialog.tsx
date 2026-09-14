import { confirmingNewDocument, toast } from "../../state/ui";
import { replaceDocument } from "../../state/document";
import { createEmptyDocument } from "../../model/instruction";
import { useConfirmDialogFocusTrap } from "../../lib/dialog-focus-trap";

/**
 * Task 28 (UI Polish Pass): a confirmation gate before starting a new,
 * blank document - added because there was previously no way to do this at
 * all short of clearing browser storage (`createEmptyDocument` existed only
 * as the document session's own throwaway default before a saved document
 * loads). Rendered once at the app root, same as `ImportConfirmDialog`,
 * which this deliberately mirrors: same overlay/dialog styling
 * (`.confirm-dialog-*`) and the same shared `useConfirmDialogFocusTrap`
 * (`lib/dialog-focus-trap.ts`) for focus-on-open/Tab-trap/Escape behavior,
 * since this is the same "confirm a destructive replace" shape Import
 * already established.
 *
 * Goes through `replaceDocument` - the same session action Import uses -
 * so starting over is recorded in undo history like any other document
 * change, not a special-cased reset.
 */
export function NewDocumentConfirmDialog() {
  const open = confirmingNewDocument.value;

  function cancel(): void {
    confirmingNewDocument.value = false;
  }

  const { dialogProps, cancelButtonProps, confirmButtonProps } = useConfirmDialogFocusTrap(open, cancel);

  if (!open) return null;

  function confirm(): void {
    replaceDocument(createEmptyDocument());
    confirmingNewDocument.value = false;
    toast.value = { text: "Started a new document.", tone: "info" };
  }

  return (
    <div class="confirm-dialog-overlay">
      <div
        class="confirm-dialog"
        role="alertdialog"
        aria-labelledby="new-document-confirm-heading"
        aria-describedby="new-document-confirm-body"
        {...dialogProps}
      >
        <h2 id="new-document-confirm-heading">Start a new document?</h2>
        <p id="new-document-confirm-body">
          This will replace everything in the editor right now with a blank
          document. You can undo this afterward.
        </p>
        <div class="confirm-dialog-actions">
          <button type="button" class="confirm-dialog-cancel" onClick={cancel} {...cancelButtonProps}>
            Cancel
          </button>
          <button type="button" class="confirm-dialog-confirm" onClick={confirm} {...confirmButtonProps}>
            Start New
          </button>
        </div>
      </div>
    </div>
  );
}
