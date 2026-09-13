import { useEffect, useRef } from "preact/hooks";
import { StepList } from "./components/StepList/StepList";
import { StepDetails } from "./components/StepDetails/StepDetails";
import { TokenDetails } from "./components/TokenDetails/TokenDetails";
import { InstructionCanvas } from "./components/InstructionCanvas/InstructionCanvas";
import { TokenPicker } from "./components/TokenPicker/TokenPicker";
import { TokenAttachmentPicker } from "./components/TokenAttachmentPicker/TokenAttachmentPicker";
import { DragGhost } from "./components/DragGhost/DragGhost";
import { ImportConfirmDialog } from "./components/ImportConfirmDialog/ImportConfirmDialog";
import { previewMode, toast, pendingImport } from "./state/ui";
import { persistenceStatus } from "./state/persistence";
import { document, undo, redo, canUndo, canRedo } from "./state/document";
import { validateDocument } from "./model/validate";
import { exportDocumentAsJson, parseImportedDocument } from "./lib/document-file";

/**
 * Task 18 (JSON Export): downloads the current document, then - task 14's
 * link into export - shows a non-blocking warning toast if any step is
 * incomplete. The file downloads either way; this only informs, it never
 * gates the export.
 */
function handleExport(): void {
  const issues = validateDocument(document.value).filter((result) => !result.isComplete);
  exportDocumentAsJson(document.value);
  if (issues.length > 0) {
    toast.value = {
      text: `Exported with ${issues.length} incomplete step${issues.length === 1 ? "" : "s"} (missing an action, or empty).`,
      tone: "warning",
    };
  }
}

/**
 * Task 19 (Import): reads the chosen file, parses+shape-validates it (see
 * `parseImportedDocument`), and - on success - hands it to `ImportConfirmDialog`
 * rather than replacing the document immediately, so the user gets an
 * explicit go/no-go before anything is overwritten. A parse/shape failure
 * (bad JSON, missing fields, unsupported schema version) surfaces as an
 * error toast instead, and the current document is left untouched either way.
 */
async function handleImportFileChange(event: Event): Promise<void> {
  const input = event.currentTarget as HTMLInputElement;
  const file = input.files?.[0];
  input.value = ""; // allow re-selecting the same filename later
  if (!file) return;

  try {
    const text = await file.text();
    const imported = parseImportedDocument(text);
    const incompleteCount = validateDocument(imported).filter((result) => !result.isComplete).length;
    pendingImport.value = { document: imported, incompleteCount };
  } catch (err) {
    toast.value = {
      text: err instanceof Error ? err.message : "Could not read that file.",
      tone: "error",
    };
  }
}

/**
 * Task 13 (Undo/Redo): Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z are the standard
 * bindings; Ctrl/Cmd+Y is also wired to redo since that's the common
 * Windows convention. `preventDefault` stops the browser's own per-field
 * undo from also firing on whatever `<input>`/`<textarea>` has focus,
 * which would otherwise race the app's own history restore.
 */
function useHistoryKeyboardShortcuts(): void {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      const meta = event.ctrlKey || event.metaKey;
      if (!meta) return;
      const key = event.key.toLowerCase();
      if (key === "z" && event.shiftKey) {
        event.preventDefault();
        redo();
      } else if (key === "z") {
        event.preventDefault();
        undo();
      } else if (key === "y") {
        event.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}

/**
 * Phase 2 task 5: the toolbar/canvas/panel regions from
 * docs/phase-1/Architecture.md section 5. Placement is driven entirely by
 * grid-template-areas in global.css, so repositioning a region later (e.g.
 * moving StepList to the other side) is a CSS-only change - no markup here
 * needs to move.
 *
 * The canvas region now renders InstructionCanvas (task 6), replacing
 * Phase 1's StepBuilder HTML prototype now that the interaction model is
 * validated (docs/phase-1/UX-and-Wireframes.md).
 *
 * Task 8 (Live Preview): toggling `previewMode` swaps the whole editor for
 * a read-only `InstructionCanvas` - the exact same SVG, just with every
 * editing affordance turned off, rather than a second rendering pipeline.
 *
 * Task 12 (Data Persistence): the document is auto-saved to IndexedDB by
 * state/persistence.ts, invisibly, unless that fails (e.g. Safari private
 * browsing), in which case a banner here warns that changes won't survive
 * closing the tab rather than losing work silently.
 */
export function App() {
  useHistoryKeyboardShortcuts();
  const importInputRef = useRef<HTMLInputElement>(null);

  return (
    <div class="app">
      <header class="app__toolbar">
        <div class="app__titles">
          <h1>Visual Instruction Builder</h1>
          <p class="app__tagline">Phase 2 — instruction canvas</p>
        </div>
        <div class="app__history-controls">
          <button
            type="button"
            class="app__history-button"
            onClick={undo}
            disabled={!canUndo.value}
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
          >
            Undo
          </button>
          <button
            type="button"
            class="app__history-button"
            onClick={redo}
            disabled={!canRedo.value}
            aria-label="Redo"
            title="Redo (Ctrl+Shift+Z)"
          >
            Redo
          </button>
        </div>
        <div class="app__file-controls">
          <button type="button" class="app__file-button" onClick={handleExport}>
            Export
          </button>
          <button type="button" class="app__file-button" onClick={() => importInputRef.current?.click()}>
            Import
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            class="visually-hidden"
            onChange={handleImportFileChange}
          />
        </div>
        <button
          type="button"
          class="app__preview-toggle"
          onClick={() => (previewMode.value = !previewMode.value)}
        >
          {previewMode.value ? "Back to editor" : "Preview"}
        </button>
      </header>
      {persistenceStatus.value === "unavailable" && (
        <p class="app__persistence-warning" role="status">
          Your browser blocked local saving (this is common in private
          browsing). Changes will be lost when you close this tab.
        </p>
      )}
      {toast.value && (
        <div
          class={`app__toast app__toast--${toast.value.tone}`}
          role={toast.value.tone === "error" ? "alert" : "status"}
        >
          <span>{toast.value.text}</span>
          <button
            type="button"
            class="app__toast-dismiss"
            aria-label="Dismiss"
            onClick={() => (toast.value = null)}
          >
            ×
          </button>
        </div>
      )}
      <main class={`app__main${previewMode.value ? " app__main--preview" : ""}`}>
        {previewMode.value ? (
          <InstructionCanvas readOnly />
        ) : (
          <>
            <StepList />
            <StepDetails />
            <TokenDetails />
            <InstructionCanvas />
            <TokenPicker />
            <TokenAttachmentPicker />
          </>
        )}
      </main>
      <DragGhost />
      <ImportConfirmDialog />
    </div>
  );
}
