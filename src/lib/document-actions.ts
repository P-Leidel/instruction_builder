import { validateDocument } from "../model/validate";
import type { InstructionDocument } from "../model/instruction";
import { exportDocumentAsJson, parseImportedDocument } from "./document-file";
import { exportCanvasAsSvg } from "./svg-export";
import { exportCanvasAsPng } from "./png-export";
import { exportCanvasAsPdf } from "./pdf-export";

/**
 * The export/import orchestration `App` used to own directly (five handler
 * functions with no relation to its own render, flagged by a 2026-09-14
 * architecture review - see
 * docs/phase-3/audits/2026-09-14-architecture-review.html). Moved here so
 * it concentrates in one place instead of `app.tsx`'s composition-root
 * JSX, without breaking this codebase's existing convention that `lib/`
 * modules never write UI state directly (every other `lib/` file - the
 * three export modules this one calls, `document-file.ts` - is already
 * pure this way; only `state/persistence.ts` writes `toast` directly, and
 * that's `state/`, not `lib/`). Every function here returns a small result
 * instead - `app.tsx` still owns turning that into a `toast`/`pendingImport`
 * write, since routing to the right signal is real UI-orchestration work,
 * not export logic.
 */

/**
 * Task 14's link into every export format: a non-blocking warning naming
 * how many steps are incomplete. The file has always already downloaded by
 * the time this is computed - it only informs, it never gates an export.
 */
function incompleteStepsWarning(doc: InstructionDocument): string | undefined {
  const issues = validateDocument(doc).filter((result) => !result.isComplete);
  if (issues.length === 0) return undefined;
  return `Exported with ${issues.length} incomplete step${issues.length === 1 ? "" : "s"} (missing an action, or empty).`;
}

/**
 * `error` is set only if the export failed outright and nothing
 * downloaded; `warning` is set if it succeeded but the document has
 * incomplete steps. At most one of the two is ever set.
 */
export interface ExportResult {
  error?: string;
  warning?: string;
}

/** Task 18 (JSON Export): downloads the current document as pretty-printed JSON. */
export function runJsonExport(doc: InstructionDocument): ExportResult {
  exportDocumentAsJson(doc);
  return { warning: incompleteStepsWarning(doc) };
}

/**
 * Task 15 (SVG Export): serializes the hidden, always-mounted read-only
 * `InstructionCanvas` `svgElement` passed in by the caller - never the
 * visible editor canvas, which carries editing-only affordances (remove
 * buttons, selection outlines) that shouldn't end up in an exported file.
 */
export function runSvgExport(svgElement: SVGSVGElement | null, doc: InstructionDocument): ExportResult {
  if (!svgElement) return {}; // the hidden export canvas hasn't mounted yet - shouldn't happen once past first render
  try {
    exportCanvasAsSvg(svgElement, doc.meta.title);
    return { warning: incompleteStepsWarning(doc) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not export an SVG." };
  }
}

/** Task 16 (PNG Export): rasterizes the same hidden export canvas's SVG. */
export async function runPngExport(
  svgElement: SVGSVGElement | null,
  doc: InstructionDocument,
): Promise<ExportResult> {
  if (!svgElement) return {}; // the hidden export canvas hasn't mounted yet - shouldn't happen once past first render
  try {
    await exportCanvasAsPng(svgElement, doc.meta.title);
    return { warning: incompleteStepsWarning(doc) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not export a PNG." };
  }
}

/**
 * Task 17 (Print/PDF Export), baseline tier: opens the browser's print
 * dialog - "Save as PDF" is one of its built-in destinations on every
 * major browser/OS, which is what makes `window.print()` a legitimate MVP
 * PDF export rather than just a printing feature. What's on the printed
 * page is controlled entirely by the `@media print` rules in global.css,
 * not by anything here.
 */
export function runPdfExport(doc: InstructionDocument): ExportResult {
  exportCanvasAsPdf();
  return { warning: incompleteStepsWarning(doc) };
}

export type ImportFileResult =
  | { ok: true; document: InstructionDocument; incompleteCount: number }
  | { ok: false; error: string };

/**
 * Task 19 (Import): reads the chosen file and parses+shape-validates it
 * (see `parseImportedDocument`) - does not replace the document itself.
 * On success, the caller hands the result to `ImportConfirmDialog` for the
 * user's explicit go/no-go rather than replacing anything immediately; on
 * failure (bad JSON, missing fields, unsupported schema version), the
 * caller shows `error` and the current document is left untouched either
 * way.
 */
export async function readImportFile(file: File): Promise<ImportFileResult> {
  try {
    const text = await file.text();
    const imported = parseImportedDocument(text);
    const incompleteCount = validateDocument(imported).filter((result) => !result.isComplete).length;
    return { ok: true, document: imported, incompleteCount };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not read that file." };
  }
}
