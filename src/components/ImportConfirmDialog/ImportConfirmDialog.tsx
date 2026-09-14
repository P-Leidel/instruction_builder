import { useEffect, useRef } from "preact/hooks";
import { pendingImport, toast } from "../../state/ui";
import { replaceDocument } from "../../state/document";

/**
 * Task 19 (Import): a confirmation gate between a successfully parsed file
 * and it actually replacing the current document - rendered once at the app
 * root (like `DragGhost`) so it can overlay every panel. Only ever shown
 * once `App`'s file-input handler has already parsed and shape-validated
 * the file (see `parseImportedDocument`); this component's only job is the
 * user's explicit go/no-go, not any part of the parsing itself.
 *
 * Task 22: an `alertdialog` needs to actually behave like a modal for
 * keyboard/screen-reader users, not just carry the role - focus moves to
 * Cancel (the safer default for a destructive "replace everything" action)
 * the moment it opens, Escape cancels same as clicking Cancel, and Tab is
 * trapped between the two buttons so it can't silently escape to whatever's
 * underneath.
 */
export function ImportConfirmDialog() {
  const pending = pendingImport.value;
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (pending) cancelRef.current?.focus();
  }, [pending]);

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

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
      return;
    }
    if (event.key !== "Tab") return;
    // Only two buttons ever live in this dialog, so trapping Tab between
    // them is just "Shift+Tab off the first wraps to the last, and vice
    // versa" - no need for a general-purpose focusable-element query.
    const cancelButton = cancelRef.current;
    const replaceButton = cancelButton?.nextElementSibling as HTMLElement | null;
    if (!cancelButton || !replaceButton) return;
    if (event.shiftKey && document.activeElement === cancelButton) {
      event.preventDefault();
      replaceButton.focus();
    } else if (!event.shiftKey && document.activeElement === replaceButton) {
      event.preventDefault();
      cancelButton.focus();
    }
  }

  return (
    <div class="import-confirm-overlay">
      <div
        class="import-confirm-dialog"
        role="alertdialog"
        aria-labelledby="import-confirm-heading"
        aria-describedby="import-confirm-body"
        onKeyDown={handleKeyDown}
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
          <button type="button" class="import-confirm-cancel" ref={cancelRef} onClick={cancel}>
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
