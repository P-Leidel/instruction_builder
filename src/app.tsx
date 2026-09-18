import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { effect } from "@preact/signals";
import { StepDetails } from "./components/StepDetails/StepDetails";
import { TokenDetails } from "./components/TokenDetails/TokenDetails";
import { InstructionCanvas } from "./components/InstructionCanvas/InstructionCanvas";
import { DESKTOP_QUERY, computeCanvasLayout, type CanvasLayout } from "./lib/canvas-layout";
import { TokenPicker } from "./components/TokenPicker/TokenPicker";
import { DragGhost } from "./components/DragGhost/DragGhost";
import { ImportConfirmDialog } from "./components/ImportConfirmDialog/ImportConfirmDialog";
import { NewDocumentConfirmDialog } from "./components/NewDocumentConfirmDialog/NewDocumentConfirmDialog";
import { previewMode, toast, pendingImport, confirmingNewDocument, copyTokenWithToast } from "./state/ui";
import { persistenceStatus } from "./state/persistence";
import {
  document,
  undo,
  redo,
  canUndo,
  canRedo,
  updateTitle,
  selectedStep,
  selectedToken,
  copiedToken,
  pasteToken,
} from "./state/document";
import {
  runJsonExport,
  runSvgExport,
  runPngExport,
  runPdfExport,
  readImportFile,
  type ExportResult,
} from "./lib/document-actions";
import { MOD_KEY_LABEL } from "./lib/platform";

const DOCUMENT_TITLE_MAX_LENGTH = 50;

/**
 * Tracks the `min-width: 800px` breakpoint so the live editable canvas can
 * switch between desktop's wrapped multi-row chips and mobile's single row
 * per step. Kept as a plain hook (not a signal) since it's a local rendering
 * concern, not shared app state. Moved here from `InstructionCanvas.tsx`
 * (2026-09-17 export-viewport-independence remediation): `App` is now the
 * one place that decides `isDesktop` for the live canvas and computes
 * `computeCanvasLayout` for all three `InstructionCanvas` instances, so the
 * component itself never reads the viewport - only this, single, editable
 * instance still needs to.
 */
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia(DESKTOP_QUERY).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => setIsDesktop(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isDesktop;
}

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
async function handleExportJson(): Promise<void> {
  showExportResult(await runJsonExport(document.value));
}

/**
 * Task 15 (SVG Export) / Task 16 (PNG Export): both serialize the hidden,
 * always-mounted read-only `InstructionCanvas` below, read through the
 * `svgRef` `App` passes straight into it (2026-09-17 architecture
 * remediation - see `InstructionCanvas`'s own `svgRef` doc comment) - never
 * the visible editor canvas, which carries editing-only affordances (remove
 * buttons, selection outlines) that shouldn't end up in an exported file.
 */
async function handleExportSvg(svgElement: SVGSVGElement | null): Promise<void> {
  showExportResult(await runSvgExport({ svgElement, doc: document.value }));
}

async function handleExportPng(svgElement: SVGSVGElement | null): Promise<void> {
  showExportResult(await runPngExport({ svgElement, doc: document.value }));
}

/**
 * Task 17 (Print/PDF Export): serializes the same hidden, always-mounted
 * read-only `InstructionCanvas` `svgElement` SVG/PNG export use (see their
 * own comments above) into a real, paginated PDF file download - not
 * `window.print()` any more (2026-09-17 remediation: see
 * `lib/pdf-export.ts`'s own comment for why). A user who wants a physical
 * copy prints the downloaded PDF from their own viewer, same as any other
 * downloaded PDF; a native Ctrl+P/File>Print still falls back to this
 * app's `@media print` rules (unchanged, left as an unsupported path - see
 * the 2026-09-17 remediation grill's Q7). Pagination bounds come from
 * `layout` (the same fixed-desktop `CanvasLayout` the hidden export canvas
 * was rendered with) rather than being scraped back off the SVG's DOM - see
 * `lib/pdf-export.ts`'s own comment (2026-09-17 remediation, part 2).
 */
async function handleExportPdf(svgElement: SVGSVGElement | null, layout: CanvasLayout): Promise<void> {
  showExportResult(await runPdfExport({ svgElement, doc: document.value }, layout));
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
 * `meta.title`. Originally added so the browser's native "Save as PDF"
 * dialog would suggest a matching filename for Export PDF - that path now
 * downloads a `.pdf` directly via `slugify(meta.title)` instead (2026-09-17
 * remediation, see `lib/pdf-export.ts`), so this effect's remaining reason
 * to exist is the native Ctrl+P/File>Print fallback (`app.tsx`'s own
 * `handleExportPdf` comment), which still goes through the browser's own
 * dialog and still benefits from a matching tab title. Uses
 * `@preact/signals`' own `effect()` (auto-tracks `document.value.meta.title`,
 * reruns on every change) rather than `useEffect`'s dependency array, since
 * App doesn't otherwise re-render on every document change - `effect()`'s
 * disposer is returned from `useEffect` so it's cleaned up the same way a
 * normal effect would be.
 */
function useDocumentTitleSync(): void {
  useEffect(() => effect(() => {
    window.document.title = document.value.meta.title || "Visual Instruction Builder";
  }), []);
}

/**
 * Whether the global keyboard shortcuts below (undo/redo, copy/paste)
 * should stay dormant: a confirm dialog (Import/New document) is open, or
 * Preview mode is showing a read-only canvas. Both `window`-level listeners
 * used to ignore all three - the confirm dialogs' own focus handling
 * (`dialog-focus-trap.ts`) only handles Escape, so every other key
 * bubbled past their focused Cancel button up to these listeners, letting
 * e.g. Ctrl+Z undo the document sitting behind an open dialog, or Ctrl+V
 * paste into Preview's supposedly read-only canvas (2026-09-17 audit
 * remediation, finding 4). Checked here, at the source, rather than by
 * making the focus trap swallow every keystroke - that would be a second,
 * redundant place enforcing the same rule.
 */
function keyboardShortcutsSuspended(): boolean {
  return pendingImport.value !== null || confirmingNewDocument.value || previewMode.value;
}

/**
 * Whether a confirm dialog (Import/New document) is currently open, and so
 * whether everything outside it should be `inert` (2026-09-18 architecture
 * review, finding 7 - see `ConfirmDialog.tsx` and CONTEXT.md's "Confirm
 * dialog").
 *
 * Deliberately *not* `keyboardShortcutsSuspended` above, even though the
 * two overlap on both dialog signals: that one also includes `previewMode`,
 * and Preview is not modal - inerting the page during Preview would make
 * the read-only canvas, the toolbar and the "Back to editor" button all
 * unreachable. Two names for two genuinely different questions, rather
 * than one predicate quietly answering both.
 *
 * Called from `App`'s render (not from an event handler like
 * `keyboardShortcutsSuspended`), so reading these two signals subscribes
 * `App` to them - which is the point: `App` otherwise never re-renders
 * when a dialog opens, and the `inert` attributes below would never
 * update. It costs one extra `App` render per dialog open and per close.
 */
function confirmDialogOpen(): boolean {
  return pendingImport.value !== null || confirmingNewDocument.value;
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
      if (!meta || keyboardShortcutsSuspended()) return;
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

/** True for an `<input>`/`<textarea>`/contenteditable currently receiving keystrokes. */
function isTextEntryTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

/**
 * Copy/paste tokens: `Ctrl/Cmd+C` copies the selected token (see
 * CONTEXT.md's "Token clipboard"), `Ctrl/Cmd+V` pastes onto the selected
 * step - the same actions as TokenDetails'/StepDetails' own Copy/Paste
 * buttons (see their own comments), wired globally too like undo/redo above.
 * Unlike undo/redo, this one skips entirely while focus is in a text
 * input/textarea/contenteditable (`isTextEntryTarget`), so typing in the
 * Title/Notes fields keeps the browser's native text copy/paste instead of
 * this shortcut hijacking it.
 */
function useTokenClipboardKeyboardShortcuts(): void {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      const meta = event.ctrlKey || event.metaKey;
      if (!meta || isTextEntryTarget(event.target) || keyboardShortcutsSuspended()) return;
      const key = event.key.toLowerCase();
      if (key === "c") {
        const step = selectedStep.value;
        const token = selectedToken.value;
        if (!step || !token) return;
        event.preventDefault();
        copyTokenWithToast(step, token);
      } else if (key === "v") {
        if (!copiedToken.value) return;
        event.preventDefault();
        pasteToken();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}

/**
 * Phase 2 task 5: the toolbar/canvas/panel regions from
 * docs/phase-1/architecture.md section 5. `.app__col-left`/`.app__col-right`
 * wrap each side's panel stack in its own independent flex column (task 28
 * UI polish follow-up) - each side's height now depends only on its own
 * panels' content, not on a shared grid row also spanning the *other*
 * side's stack. Reordering a region within a side is still markup-only
 * within that side's `<div>`; swapping which side a whole stack sits on is
 * `grid-template-columns`'s column order plus this markup's element order.
 * The left column used to open with a standalone StepList panel (select/
 * add/remove/reorder steps); that functionality moved onto the canvas
 * itself, so the column now opens directly with `StepDetails` (see
 * InstructionCanvas.tsx's own doc comment for the canvas-native controls).
 * The right column used to carry a second panel, TokenAttachmentPicker
 * ("Add to token"), below `TokenPicker`; that functionality folded into two
 * of `TokenDetails`'s own fields, Quantity and Warning, instead (see
 * TokenDetails.tsx's doc comment), so the right column is now just
 * `TokenPicker` on its own.
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
 * Task 17 (Print/PDF Export): "Export PDF" now serializes that same hidden
 * export canvas's `svgElement` into a real, paginated PDF download
 * (`lib/pdf-export.ts`, jsPDF + svg2pdf.js) exactly like SVG/PNG export do,
 * rather than opening the browser's print dialog - see `handleExportPdf`'s
 * own comment for why (2026-09-17 remediation). `global.css`'s `@media
 * print` block still exists as a fallback for a native Ctrl+P/File>Print,
 * which bypasses this button entirely and can't be intercepted from JS -
 * that block still hides everything but `.app__export-canvas` for that
 * unsupported path, even though the supported path (this button) no longer
 * uses it at all.
 */
export function App() {
  useHistoryKeyboardShortcuts();
  useTokenClipboardKeyboardShortcuts();
  useDocumentTitleSync();
  const importInputRef = useRef<HTMLInputElement>(null);
  const exportSvgRef = useRef<SVGSVGElement>(null);
  const getExportSvgElement = () => exportSvgRef.current;

  const isDesktop = useIsDesktop();
  const steps = document.value.steps;
  // The live editable canvas gets the real viewport; Preview and the hidden
  // export canvas both get a fixed desktop layout instead (2026-09-17
  // remediation) - a shared/printed document shouldn't render structurally
  // differently depending on which device happened to trigger the export,
  // and Preview's whole job is to stand in for what export actually
  // produces (see InstructionCanvas.tsx's `readOnly` doc comment). Sharing
  // one `exportLayout` between both read-only instances also means it's
  // computed once, not twice, for what's provably the same input.
  const liveLayout = useMemo(() => computeCanvasLayout(steps, isDesktop), [steps, isDesktop]);
  const exportLayout = useMemo(() => computeCanvasLayout(steps, true), [steps]);
  // Everything the app renders *outside* an open confirm dialog carries
  // this: the toolbar, the main editor grid, and the two banners between
  // them. That is the whole page bar the dialog itself, `DragGhost` (which
  // can't be mid-drag while a dialog is open) and the hidden export canvas
  // (already `aria-hidden`, and read-only, so it holds nothing focusable).
  // The two banners are included even though only the toast contains a
  // focusable element today - "everything behind the dialog" is the rule,
  // and leaving a Dismiss button tabbable behind a modal is exactly the
  // hole `aria-modal="true"` would then be lying about.
  const backgroundInert = confirmDialogOpen();

  return (
    <div class="app">
      <header class="app__toolbar" inert={backgroundInert}>
        <div class="app__titles">
          <h1>Visual Instruction Builder</h1>
          <p class="app__tagline">Build step-by-step recipe instructions</p>
          <label class="app__document-title">
            <span class="visually-hidden">Document title</span>
            <input
              type="text"
              value={document.value.meta.title}
              placeholder="Untitled instructions"
              maxLength={DOCUMENT_TITLE_MAX_LENGTH}
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
            title={`Undo (${MOD_KEY_LABEL}+Z)`}
          >
            Undo
          </button>
          <button
            type="button"
            class="app__history-button"
            onClick={redo}
            disabled={!canRedo.value}
            aria-label="Redo"
            title={`Redo (${MOD_KEY_LABEL}+Shift+Z)`}
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
          <button
            type="button"
            class="app__file-button"
            onClick={() => handleExportPdf(getExportSvgElement(), exportLayout)}
          >
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
        <p class="app__persistence-warning" role="status" inert={backgroundInert}>
          Your browser blocked local saving (this is common in private
          browsing). Changes will be lost when you close this tab.
        </p>
      )}
      {toast.value && (
        <div
          class={`app__toast app__toast--${toast.value.tone}`}
          role={toast.value.tone === "error" ? "alert" : "status"}
          inert={backgroundInert}
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
      <main class={`app__main${previewMode.value ? " app__main--preview" : ""}`} inert={backgroundInert}>
        {previewMode.value ? (
          <InstructionCanvas readOnly layout={exportLayout} />
        ) : (
          <>
            <div class="app__col-left">
              <StepDetails />
              <TokenDetails />
            </div>
            <InstructionCanvas layout={liveLayout} />
            <div class="app__col-right">
              <TokenPicker />
            </div>
          </>
        )}
      </main>
      <DragGhost />
      <ImportConfirmDialog />
      <NewDocumentConfirmDialog />
      {/*
        `inert` as well as `aria-hidden`, and unconditionally rather than
        only behind a dialog: `.instruction-canvas` is `overflow-x: auto`,
        and Chromium makes scroll containers keyboard-focusable, so this
        hidden, zero-sized, read-only copy of the document was a real Tab
        stop on every page - focus simply vanished into a node nobody can
        see. Found by the driver's own tab-stop probe while checking the
        confirm dialogs' modality (2026-09-18 review, finding 7); the hole
        predates that work and had nothing to do with dialogs. `inert`
        doesn't affect layout or `getComputedStyle`, so SVG/PNG/PDF
        export's style-baking reads exactly what it read before.
      */}
      <div class="app__export-canvas" aria-hidden="true" inert>
        <InstructionCanvas readOnly layout={exportLayout} svgRef={exportSvgRef} />
      </div>
    </div>
  );
}
