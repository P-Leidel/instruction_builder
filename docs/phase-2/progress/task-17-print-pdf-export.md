# Task 17 — Print/PDF Export

> 📌 **Doc status: CURRENT** — one file in the
> [Phase 2 Progress Log](./README.md).

- Ships the plan's baseline tier only, as specified: a dedicated `@media print` stylesheet plus `window.print()` - "Save as PDF" is a built-in destination in every major browser/OS print dialog, which is what makes this a legitimate MVP PDF export rather than just a printing feature. The vector-PDF stretch tier (jsPDF + svg2pdf.js) stays deferred to Phase 4 per the plan.
- **Reuses the same hidden export canvas SVG/PNG export already read from**, rather than printing whatever the editor happens to be showing: `global.css`'s new `@media print` block hides `.app__toolbar`, `.app__main` (the whole editor grid or the preview canvas, whichever is active), toasts, the drag ghost, and the import dialog, then switches `.app__export-canvas` from its normal `position: absolute; width: 0; height: 0; overflow: hidden` clip back into plain visible flow for the duration of the print. The printed page is always that one clean, read-only rendering - no editing affordances, no toolbar chrome - regardless of whether the user was mid-edit or already in Preview mode when they clicked the button.
- `lib/pdf-export.ts`'s `exportCanvasAsPdf()` is a single-line `window.print()` call, deliberately kept as its own module rather than inlined in `app.tsx` - it's the seam the Phase 4 stretch tier will swap out later without touching the toolbar button or its caller.
- Toolbar gained a fourth "Export PDF" button alongside JSON/SVG/PNG, wired through the same shared `warnAboutIncompleteSteps()` every other export format already uses.
- Unlike SVG/PNG/JSON, there's no downloaded file to inspect - it's confirmed with Playwright's `emulateMedia({ media: "print" })`, which applies the exact same CSS a real print/"Save as PDF" would without opening any dialog, plus a `beforeprint` event listener to confirm the button really calls `window.print()` (Playwright's `dialog` event only covers `alert`/`confirm`/`prompt`/`beforeunload`, never `window.print()`'s native, non-scriptable dialog - headless Chromium fires `beforeprint`/`afterprint` around the call without ever showing one).

## Files touched — Print/PDF Export (task 17)

- `src/lib/pdf-export.ts` — new: `exportCanvasAsPdf()`, a single `window.print()` call kept as its own module as the seam for the Phase 4 vector-PDF (jsPDF + svg2pdf.js) stretch tier.
- `src/app.tsx` — added `handleExportPdf`; toolbar gained a fourth "Export PDF" button, wired through the existing shared `warnAboutIncompleteSteps()`.
- `src/styles/global.css` — new `@media print` block: hides `.app__toolbar`/`.app__main`/`.app__toast`/`.drag-ghost`/`.import-confirm-overlay`; switches `.app__export-canvas` from its normal 0×0 clip back into visible flow and strips its panel chrome (background/border/shadow) for a clean printed page.
- `.claude/skills/run-instruction-builder/driver.mjs`, `SKILL.md` — new `PDF_EXPORT_INVOKED_WINDOW_PRINT`/`PDF_EXPORT_WARNS_ABOUT_INCOMPLETE_STEPS`/`PRINT_STYLESHEET_ISOLATES_READONLY_CANVAS` checks, using `page.emulateMedia` and a `beforeprint` listener rather than a downloaded file.
