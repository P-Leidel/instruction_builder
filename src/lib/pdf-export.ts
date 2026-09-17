import { downloadBlob, slugify } from "./document-file";
import { cloneCanvasForExport } from "./svg-export";
import { paginateSteps, type StepBounds } from "./pdf-pagination";

// A4, not Letter - this app's target audience is European (see 2026-09-17
// remediation grill). Chosen deliberately now that jsPDF generates the file
// directly: there's no more OS print dialog offering its own paper-size
// choice the way `window.print()` used to.
const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
// A real printer can't reproduce true edge-to-edge output, so - unlike the
// 0-margin Letter page `window.print()` happened to produce by accident
// (nothing ever set an explicit margin) - this one is deliberate.
const MARGIN_MM = 15;
const USABLE_WIDTH_MM = PAGE_WIDTH_MM - MARGIN_MM * 2;
const USABLE_HEIGHT_MM = PAGE_HEIGHT_MM - MARGIN_MM * 2;

// The title/total-time heading (InstructionCanvas's own `<h2>`, a sibling of
// the `<svg>` - never part of what `cloneCanvasForExport` serializes) is
// redrawn once via jsPDF's own text API instead, only on page 1 (see
// paginateSteps's page-0 budget below) - not repeated on later pages.
const HEADING_FONT_SIZE_PT = 14;
const HEADING_BLOCK_MM = 12;

interface ExportStep extends StepBounds {
  top: number;
  height: number;
}

/**
 * Reads each step's card position/height straight off the live export
 * canvas DOM - the same "read the rendered DOM back out rather than
 * recompute layout a second way" approach `lib/canvas-layout.ts`'s module
 * comment already describes the export pipeline following (SVG/PNG export
 * serialize the live SVG node itself; this reads its step groups' own
 * `transform`/background-rect `height` instead of calling
 * `computeCanvasLayout` a second time with a possibly-stale `isDesktop`).
 *
 * Selects `[data-step-index]`, not `[data-step-id]` - `TokenChip` also
 * carries `data-step-id` (for `pointer-drag.ts`'s drop-target resolution),
 * so that selector would match every token group too, feeding pagination a
 * pile of spurious zero-height "step" entries at each token's own local
 * `transform` position. `data-step-index` is the attribute already unique
 * to a step group (see `pointer-drag.ts`'s `resolveStepDropIndex`).
 */
function readStepBounds(svg: SVGSVGElement): ExportStep[] {
  const groups = Array.from(svg.querySelectorAll<SVGGElement>("[data-step-index]"));
  return groups
    .map((group) => {
      const translateMatch = /translate\(\s*[-\d.]+\s*,\s*([-\d.]+)\s*\)/.exec(
        group.getAttribute("transform") ?? "",
      );
      const top = translateMatch ? Number(translateMatch[1]) : 0;
      const bg = group.querySelector<SVGRectElement>(".instruction-canvas__step-bg");
      const height = bg ? Number(bg.getAttribute("height") ?? "0") : 0;
      return { top, height };
    })
    .sort((a, b) => a.top - b.top);
}

/**
 * Triggers a browser download of `svg` (see `App`'s hidden export-only
 * `InstructionCanvas`) as a paginated PDF - task 17's "Phase 4 stretch
 * tier", replacing the `window.print()` baseline (2026-09-17 remediation):
 * that atomic approach had no way to keep `page-break`-style rules from
 * cutting a step's card in half, since CSS fragmentation only applies to
 * block boxes in document flow, never to groups inside one shared `<svg>`'s
 * paint. This instead crops the *same* self-contained, style-baked clone
 * SVG/PNG export already build (`cloneCanvasForExport`) to one `viewBox`
 * slice per page - one greedily-packed run of whole steps
 * (`paginateSteps`), never a partial one - and renders each slice onto its
 * own jsPDF page via svg2pdf.js. No DOM restructuring: the shared hidden
 * export canvas, and SVG/PNG export's own use of it, are untouched.
 *
 * `title`/`totalTimeLabel` come from the caller (`document-actions.ts`)
 * rather than being read off the DOM, since the heading text they build
 * lives outside the `<svg>` entirely.
 *
 * jsPDF and svg2pdf.js are dynamically imported (not a static top-level
 * import) so they only ever load into the bundle - and only ever execute -
 * when a user actually clicks Export PDF, rather than being pulled into
 * every page load (and, incidentally, every Vitest module graph: importing
 * svg2pdf.js eagerly crashes outside a real browser environment).
 */
export async function exportCanvasAsPdf(
  svg: SVGSVGElement,
  title: string,
  totalTimeLabel: string | undefined,
): Promise<void> {
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([import("jspdf"), import("svg2pdf.js")]);
  const { width: canvasWidth } = svg.viewBox.baseVal;
  const steps = readStepBounds(svg);
  const scale = USABLE_WIDTH_MM / canvasWidth;
  const firstPageHeightUnits = (USABLE_HEIGHT_MM - HEADING_BLOCK_MM) / scale;
  const laterPageHeightUnits = USABLE_HEIGHT_MM / scale;

  const pages = paginateSteps(steps, (pageIndex) =>
    pageIndex === 0 ? firstPageHeightUnits : laterPageHeightUnits,
  );

  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const baked = cloneCanvasForExport(svg);
  const headingText = totalTimeLabel ? `${totalTimeLabel} - ${title || "Untitled instructions"}` : title || "Untitled instructions";

  if (pages.length === 0) {
    // An empty document (no steps yet) still downloads a one-page PDF with
    // just the heading, rather than nothing happening at all.
    pdf.setFontSize(HEADING_FONT_SIZE_PT);
    pdf.text(headingText, MARGIN_MM, MARGIN_MM + 6);
  }

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    if (pageIndex > 0) pdf.addPage();
    const pageSteps = pages[pageIndex];
    const sliceTop = pageSteps[0].top;
    const sliceBottom = pageSteps[pageSteps.length - 1].top + pageSteps[pageSteps.length - 1].height;
    const sliceHeight = sliceBottom - sliceTop;

    const slice = baked.cloneNode(true) as SVGSVGElement;
    slice.setAttribute("viewBox", `0 ${sliceTop} ${canvasWidth} ${sliceHeight}`);
    slice.setAttribute("width", String(canvasWidth));
    slice.setAttribute("height", String(sliceHeight));

    const contentTopMm = pageIndex === 0 ? MARGIN_MM + HEADING_BLOCK_MM : MARGIN_MM;
    if (pageIndex === 0) {
      pdf.setFontSize(HEADING_FONT_SIZE_PT);
      pdf.text(headingText, MARGIN_MM, MARGIN_MM + 6);
    }

    await svg2pdf(slice, pdf, {
      x: MARGIN_MM,
      y: contentTopMm,
      width: USABLE_WIDTH_MM,
      height: sliceHeight * scale,
    });
  }

  downloadBlob(pdf.output("blob"), `${slugify(title)}.pdf`);
}
