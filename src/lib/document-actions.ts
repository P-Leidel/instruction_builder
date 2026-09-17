import { validateDocument } from "../model/validate";
import type { InstructionDocument } from "../model/instruction";
import { exportDocumentAsJson, parseImportedDocument } from "./document-file";
import { exportCanvasAsSvg } from "./svg-export";
import { exportCanvasAsPng } from "./png-export";
import { exportCanvasAsPdf } from "./pdf-export";
import { documentTotalTime } from "./duration";
import type { CanvasLayout } from "./canvas-layout";

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

/**
 * Runs one format's actual export work and turns the outcome into an
 * `ExportResult`: a thrown error becomes `error` (falling back to
 * `fallbackError` if what was thrown isn't an `Error`), a clean run gets
 * `incompleteStepsWarning`'s non-blocking warning. Previously each format
 * wrote its own copy of this try/catch/warning shape, unevenly - JSON had
 * none of it - which is exactly what let JSON silently skip the pattern the
 * other three shared (2026-09-17 remediation - see
 * docs/phase-3/reviews/2026-09-17-whole-codebase-audit-evaluation.md item 7).
 */
async function runExport(
  doc: InstructionDocument,
  fallbackError: string,
  perform: () => void | Promise<void>,
): Promise<ExportResult> {
  try {
    await perform();
    return { warning: incompleteStepsWarning(doc) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : fallbackError };
  }
}

/**
 * `svgElement`/`doc` travel together across every canvas-based export
 * (SVG/PNG/PDF) - never just one alone - so `runCanvasExport` and its three
 * callers below share this one shape instead of each repeating the same two
 * positional params (2026-09-17 remediation, part 2 - see
 * docs/phase-3/reviews/2026-09-17-whole-codebase-audit-evaluation.md item 7's
 * follow-up code review). `layout` deliberately isn't part of this: it's
 * PDF-only, and folding it in here would force SVG/PNG to carry a field they
 * never read.
 */
export interface CanvasExportInput {
  svgElement: SVGSVGElement | null;
  doc: InstructionDocument;
}

/**
 * `runExport`, plus the missing-canvas guard SVG/PNG/PDF export all need
 * (the hidden export canvas hasn't mounted yet - shouldn't happen once past
 * first render) but JSON export doesn't, since it never touches the canvas
 * at all. Deliberately still a silent no-op, not an error: since `App` now
 * passes this a typed `svgRef` instead of a `querySelector`-by-class-name
 * result (2026-09-17 architecture remediation), the only way `svgElement`
 * can be null here is that pre-first-render window, not a stale selector.
 */
async function runCanvasExport(
  { svgElement, doc }: CanvasExportInput,
  fallbackError: string,
  perform: (svgElement: SVGSVGElement) => void | Promise<void>,
): Promise<ExportResult> {
  if (!svgElement) return {};
  return runExport(doc, fallbackError, () => perform(svgElement));
}

/** Task 18 (JSON Export): downloads the current document as pretty-printed JSON. */
export function runJsonExport(doc: InstructionDocument): Promise<ExportResult> {
  return runExport(doc, "Could not export a JSON file.", () => exportDocumentAsJson(doc));
}

/**
 * Task 15 (SVG Export): serializes the hidden, always-mounted read-only
 * `InstructionCanvas` `svgElement` passed in by the caller - never the
 * visible editor canvas, which carries editing-only affordances (remove
 * buttons, selection outlines) that shouldn't end up in an exported file.
 */
export function runSvgExport(input: CanvasExportInput): Promise<ExportResult> {
  return runCanvasExport(input, "Could not export an SVG.", (svg) => exportCanvasAsSvg(svg, input.doc.meta.title));
}

/** Task 16 (PNG Export): rasterizes the same hidden export canvas's SVG. */
export function runPngExport(input: CanvasExportInput): Promise<ExportResult> {
  return runCanvasExport(input, "Could not export a PNG.", (svg) => exportCanvasAsPng(svg, input.doc.meta.title));
}

/**
 * Task 17 (Print/PDF Export), now on the jsPDF + svg2pdf.js "Phase 4
 * stretch tier" (2026-09-17 remediation, replacing the `window.print()`
 * baseline): serializes the same hidden, always-mounted read-only
 * `InstructionCanvas` `svgElement` SVG/PNG export already use, paginated by
 * `pdf-export.ts` into whole-step pages instead of relying on the browser's
 * own (step-cutting, blank-page-prone) print pipeline. The title/total-time
 * heading it draws on page 1 is computed here the same way
 * `InstructionCanvas.tsx` computes its own on-screen heading, since that
 * heading is a DOM sibling of the `<svg>` and never part of what gets
 * serialized. `layout` is the same fixed-desktop `CanvasLayout` the hidden
 * export canvas was rendered with (see `app.tsx`'s `exportLayout`) - pagination
 * reads its real `cardY`/`height` numbers directly instead of scraping them
 * back off the SVG's DOM (2026-09-17 remediation, part 2 - see
 * `lib/pdf-export.ts`'s own comment).
 */
export function runPdfExport(input: CanvasExportInput, layout: CanvasLayout): Promise<ExportResult> {
  const totalTime = documentTotalTime(input.doc.steps);
  return runCanvasExport(input, "Could not export a PDF.", (svg) =>
    exportCanvasAsPdf(svg, input.doc.meta.title, totalTime?.label, layout),
  );
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
