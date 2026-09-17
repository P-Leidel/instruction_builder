import { confirmingNewDocument, toast } from "../../state/ui";
import { replaceDocument } from "../../state/document";
import { createEmptyDocument } from "../../model/instruction";
import { ConfirmDialog } from "../ConfirmDialog/ConfirmDialog";

/**
 * Task 28 (UI Polish Pass): a confirmation gate before starting a new,
 * blank document - added because there was previously no way to do this at
 * all short of clearing browser storage (`createEmptyDocument` existed only
 * as the document session's own throwaway default before a saved document
 * loads). Renders the shared `ConfirmDialog` shell (also used by
 * `ImportConfirmDialog` - 2026-09-17 remediation, item 15) with this
 * dialog's own heading/body/confirm logic.
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

  function confirm(): void {
    replaceDocument(createEmptyDocument());
    confirmingNewDocument.value = false;
    toast.value = { text: "Started a new document.", tone: "info" };
  }

  return (
    <ConfirmDialog
      open={open}
      idPrefix="new-document-confirm"
      heading="Start a new document?"
      body="This will replace everything in the editor right now with a blank document. You can undo this afterward."
      confirmLabel="Start New"
      onCancel={cancel}
      onConfirm={confirm}
    />
  );
}
