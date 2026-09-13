import { pendingImport, toast } from "../../state/ui";
import { replaceDocument } from "../../state/document";

/**
 * Task 19 (Import): a confirmation gate between a successfully parsed file
 * and it actually replacing the current document - rendered once at the app
 * root (like `DragGhost`) so it can overlay every panel. Only ever shown
 * once `App`'s file-input handler has already parsed and shape-validated
 * the file (see `parseImportedDocument`); this component's only job is the
 * user's explicit go/no-go, not any part of the parsing itself.
 */
export function ImportConfirmDialog() {
  const pending = pendingImport.value;
  if (!pending) return null;

  const importedDocument = pending.document;
  const stepCount = importedDocument.steps.length;

  function cancel(): void {
    pendingImport.value = null;
  }

  function confirm(): void {
    replaceDocument(importedDocument);
    pendingImport.value = null;
    toast.value = { text: "Imported.", tone: "info" };
  }

  return (
    <div class="import-confirm-overlay">
      <div
        class="import-confirm-dialog"
        role="alertdialog"
        aria-labelledby="import-confirm-heading"
        aria-describedby="import-confirm-body"
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
        <div class="import-confirm-actions">
          <button type="button" class="import-confirm-cancel" onClick={cancel}>
            Cancel
          </button>
          <button type="button" class="import-confirm-replace" onClick={confirm}>
            Replace
          </button>
        </div>
      </div>
    </div>
  );
}
