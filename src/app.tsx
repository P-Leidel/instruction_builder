import { useEffect, useRef } from "preact/hooks";
import { effect } from "@preact/signals";
import { StepList } from "./components/StepList/StepList";
import { StepDetails } from "./components/StepDetails/StepDetails";
import { TokenDetails } from "./components/TokenDetails/TokenDetails";
import { InstructionCanvas } from "./components/InstructionCanvas/InstructionCanvas";
import { TokenPicker } from "./components/TokenPicker/TokenPicker";
import { TokenAttachmentPicker } from "./components/TokenAttachmentPicker/TokenAttachmentPicker";
import { DragGhost } from "./components/DragGhost/DragGhost";
import { ImportConfirmDialog } from "./components/ImportConfirmDialog/ImportConfirmDialog";
import { NewDocumentConfirmDialog } from "./components/NewDocumentConfirmDialog/NewDocumentConfirmDialog";
import { previewMode, toast, pendingImport, confirmingNewDocument } from "./state/ui";
import { persistenceStatus } from "./state/persistence";
import { document, undo, redo, canUndo, canRedo, updateTitle } from "./state/document";
import {
  runJsonExport,
  runSvgExport,
  runPngExport,
  runPdfExport,
  readImportFile,
  type ExportResult,
} from "./lib/document-actions";

/**
 * Turns a `lib/document-actions.ts` result into the one toast this app
 * ever shows at a time - the one piece of export orchestration that
 * genuinely belongs here rather than in `lib/`, since routing a result to
 * the right signal is UI orchestration, not export logic.
 */
function showExportResult(result: ExportResult): void {
  if (result.error) {
    toast.value = { text: result.error, tone: "error" };
  } else if (result.warning) {
    toast.value = { text: result.warning, tone: "warning" };
  }
}

/** Task 18 (JSON Export): downloads the current document as pretty-printed JSON. */
function handleExportJson(): void {
  showExportResult(runJsonExport(document.value));
}

/**
 * Task 15 (SVG Export) / Task 16 (PNG Export): both serialize the hidden,
 * always-mounted read-only `InstructionCanvas` kept in `exportCanvasRef`
 * below - never the visible editor canvas, which carries editing-only
 * affordances (remove buttons, selection outlines) that shouldn't end up in
 * an exported file.
 */
function handleExportSvg(svgElement: SVGSVGElement | null): void {
  showExportResult(runSvgExport(svgElement, document.value));
}

async function handleExportPng(svgElement: SVGSVGElement | null): Promise<void> {
  showExportResult(await runPngExport(svgElement, document.value));
}

/**
 * Task 17 (Print/PDF Export), baseline tier: opens the browser's print
 * dialog - "Save as PDF" is one of its built-in destinations on every
 * major browser/OS, which is what makes `window.print()` a legitimate
 * MVP PDF export rather than just a printing feature. What's on the
 * printed page is controlled entirely by the `@media print` rules in
 * global.css, not by anything here.
 */
function handleExportPdf(): void {
  showExportResult(runPdfExport(document.value));
}

/**
 * Task 19 (Import): reads the chosen file, parses+shape-validates it (see
 * `lib/document-actions.ts`'s `readImportFile`), and - on success - hands it
 * to `ImportConfirmDialog` rather than replacing the document immediately,
 * so the user gets an explicit go/no-go before anything is overwritten. A
 * parse/shape failure (bad JSON, missing fields, unsupported schema
 * version) surfaces as an error toast instead, and the current document is
 * left untouched either way.
 */
async function handleImportFileChange(event: Event): Promise<void> {
  const input = event.currentTarget as HTMLInputElement;
  const file = input.files?.[0];
  input.value = ""; // allow re-selecting the same filename later
  if (!file) return;

  const result = await readImportFile(file);
  if (result.ok) {
    pendingImport.value = { document: result.document, incompleteCount: result.incompleteCount };
  } else {
    toast.value = { text: result.error, tone: "error" };
  }
}

/**
 * Task 27: keeps the browser tab title in sync with the document's own
 * `meta.title`, so the browser's native "Save as PDF" dialog (Export PDF,
 * task 17) suggests a filename that matches it instead of this app's
 * static title - the one export path `meta.title` couldn't reach before,
 * since `window.print()` has no filename of its own to derive (see
 * docs/known-issues.md's former "every export downloads as
 * untitled-instructions" entry). Uses `@preact/signals`' own `effect()`
 * (auto-tracks `document.value.meta.title`, reruns on every change)
 * rather than `useEffect`'s dependency array, since App doesn't otherwise
 * re-render on every document change - `effect()`'s disposer is returned
 * from `useEffect` so it's cleaned up the same way a normal effect would be.
 */
function useDocumentTitleSync(): void {
  useEffect(() => effect(() => {
    window.document.title = document.value.meta.title || "Visual Instruction Builder";
  }), []);
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
 * docs/phase-1/architecture.md section 5. `.app__col-left`/`.app__col-right`
 * wrap the three-panel stack on each side in its own independent flex
 * column (task 28 UI polish follow-up) - each side's height now depends
 * only on its own panels' content, not on a shared grid row also spanning
 * the *other* side's stack, which previously left "Add to token" (the
 * right column's second panel) stranded below a large gap dictated by
 * "Step details"/"Token details" (the left column's own content) rather
 * than anything in its own column. Reordering a region within a side is
 * still markup-only within that side's `<div>`; swapping which side a
 * whole stack sits on is `grid-template-columns`'s column order plus this
 * markup's element order.
 *
 * The canvas region now renders InstructionCanvas (task 6), replacing
 * Phase 1's StepBuilder HTML prototype now that the interaction model is
 * validated (docs/phase-1/ux-and-wireframes.md).
 *
 * Task 8 (Live Preview): toggling `previewMode` swaps the whole editor for
 * a read-only `InstructionCanvas` - the exact same SVG, just with every
 * editing affordance turned off, rather than a second rendering pipeline.
 *
 * Task 12 (Data Persistence): the document is auto-saved to IndexedDB by
 * state/persistence.ts, invisibly, unless that fails (e.g. Safari private
 * browsing), in which case a banner here warns that changes won't survive
 * closing the tab rather than losing work silently.
 *
 * Task 15 (SVG Export) / Task 16 (PNG Export): a second `InstructionCanvas`
 * (`readOnly`) is always mounted, hidden via `.app__export-canvas` in
 * global.css - never shown, never interactive - purely so both export
 * buttons always have a live, current SVG node to read from
 * (`lib/svg-export.ts`, `lib/png-export.ts`) without re-rendering or
 * recomputing layout of their own, and without exporting the visible
 * editor's editing-only affordances (remove buttons, selection outlines).
 * PNG export rasterizes that same node's serialized markup rather than
 * re-deriving anything - see `lib/svg-export.ts`'s
 * `rasterizeCanvasToPngBlob`.
 *
 * Task 17 (Print/PDF Export): that same hidden export canvas doubles as
 * the print source - `global.css`'s `@media print` block hides everything
 * else on the page (`.app__toolbar`, `.app__main`, toasts, dialogs) and
 * un-hides `.app__export-canvas` for the duration of the print, so
 * "Export PDF" (`window.print()`, `lib/pdf-export.ts`) prints the exact
 * same read-only rendering SVG/PNG export already use, rather than
 * whatever the editor happens to be showing.
 */
export function App() {
  useHistoryKeyboardShortcuts();
  useDocumentTitleSync();
  const importInputRef = useRef<HTMLInputElement>(null);
  const exportCanvasRef = useRef<HTMLDivElement>(null);
  const getExportSvgElement = () =>
    exportCanvasRef.current?.querySelector<SVGSVGElement>(".instruction-canvas__svg") ?? null;

  return (
    <div class="app">
      <header class="app__toolbar">
        <div class="app__titles">
          <h1>Visual Instruction Builder</h1>
          <p class="app__tagline">Build step-by-step recipe instructions</p>
          <label class="app__document-title">
            <span class="visually-hidden">Document title</span>
            <input
              type="text"
              value={document.value.meta.title}
              placeholder="Untitled instructions"
              onInput={(event) => updateTitle(event.currentTarget.value)}
            />
          </label>
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
        <button
          type="button"
          class="app__file-button"
          onClick={() => (confirmingNewDocument.value = true)}
        >
          New
        </button>
        <div class="app__file-controls">
          <button type="button" class="app__file-button" onClick={handleExportJson}>
            Export JSON
          </button>
          <button type="button" class="app__file-button" onClick={() => handleExportSvg(getExportSvgElement())}>
            Export SVG
          </button>
          <button type="button" class="app__file-button" onClick={() => handleExportPng(getExportSvgElement())}>
            Export PNG
          </button>
          <button type="button" class="app__file-button" onClick={handleExportPdf}>
            Export PDF
          </button>
          <button type="button" class="app__file-button" onClick={() => importInputRef.current?.click()}>
            Import
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            aria-label="Import instruction file"
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
            <div class="app__col-left">
              <StepList />
              <StepDetails />
              <TokenDetails />
            </div>
            <InstructionCanvas />
            <div class="app__col-right">
              <TokenPicker />
              <TokenAttachmentPicker />
            </div>
          </>
        )}
      </main>
      <DragGhost />
      <ImportConfirmDialog />
      <NewDocumentConfirmDialog />
      <div class="app__export-canvas" aria-hidden="true" ref={exportCanvasRef}>
        <InstructionCanvas readOnly />
      </div>
    </div>
  );
}
