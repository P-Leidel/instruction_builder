/**
 * Task 17 (Print/PDF Export), baseline tier: `window.print()` plus the
 * `@media print` rules in `global.css` (which isolate the hidden, read-only
 * export canvas from `app.tsx` as the only thing on the printed page - the
 * same canvas SVG/PNG export already reuse, so a printed PDF/paper copy
 * never includes editing-only affordances either). No library, no canvas
 * rasterization - the browser's own print pipeline does the layout.
 *
 * This function is the seam for the Phase 4 stretch tier: swapping in
 * jsPDF + svg2pdf.js for a true vector PDF only means changing this one
 * function's body - callers and the toolbar button stay the same.
 */
export function exportCanvasAsPdf(): void {
  window.print();
}
