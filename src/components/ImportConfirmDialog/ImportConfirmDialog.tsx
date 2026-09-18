import { pendingImport, toast } from "../../state/ui";
import { replaceDocument } from "../../state/document";
import { ConfirmDialog } from "../ConfirmDialog/ConfirmDialog";

/**
 * Task 19 (Import): a confirmation gate between a successfully parsed file
 * and it actually replacing the current document - rendered once at the app
 * root (like `DragGhost`) so it can overlay every panel. Only ever shown
 * once `App`'s file-input handler has already parsed and shape-validated
 * the file (see `parseImportedDocument`); this component's only job is the
 * user's explicit go/no-go, not any part of the parsing itself.
 *
 * Task 22: an `alertdialog` needs to actually behave like a modal for
 * keyboard/screen-reader users, not just carry the role - see the shared
 * `ConfirmDialog` shell (`components/ConfirmDialog`, also used by
 * `NewDocumentConfirmDialog` - 2026-09-17 remediation, item 15) for the
 * `aria-modal`/focus/Escape behavior, and CONTEXT.md's "Confirm dialog"
 * for what modality commits this app to.
 */
export function ImportConfirmDialog() {
  const pending = pendingImport.value;

  function cancel(): void {
    pendingImport.value = null;
  }

  if (!pending) return null;

  const importedDocument = pending.document;
  const stepCount = importedDocument.steps.length;

  function confirm(): void {
    replaceDocument(importedDocument);
    pendingImport.value = null;
    toast.value = { text: "Imported.", tone: "info" };
  }

  return (
    <ConfirmDialog
      open
      idPrefix="import-confirm"
      heading="Replace current document?"
      body={
        <>
          Importing "{importedDocument.meta.title}" will replace everything in
          the editor right now. It has {stepCount} step{stepCount === 1 ? "" : "s"}
          {pending.incompleteCount > 0 ? `, ${pending.incompleteCount} incomplete` : ""}
          . You can undo this afterward.
        </>
      }
      confirmLabel="Replace"
      onCancel={cancel}
      onConfirm={confirm}
    />
  );
}
