# Task 16 — PNG Export

> 📌 **Doc status: CURRENT** — one file in the
> [Phase 2 Progress Log](./README.md).

- Reuses task 15's whole pipeline rather than building a second one: `lib/svg-export.ts` gained `rasterizeCanvasToPngBlob(svg, pixelDensity)`, which builds the exact same self-contained, style-baked SVG markup `exportCanvasAsSvg` downloads, loads it into an `Image` via a `Blob` object URL, and draws it onto an offscreen `<canvas>` sized to the SVG's own design-unit dimensions times `pixelDensity` - per `docs/project-plan.md`'s Export Strategy, no library needed. A new `lib/png-export.ts` wraps that with the actual download (`exportCanvasAsPng`, fixed at 2x - the plan's own "sharp at 2x pixel density" success criterion, not user-configurable for the MVP).
- **Depended on a small addition to task 15's own export pipeline:** the shared clone-building step (`cloneCanvasForExport` in `svg-export.ts`) now also sets explicit `width`/`height` attributes on the exported clone (read from the live canvas's `viewBox`) - without them, an `<svg>` with only a `viewBox` has no well-defined natural size once it's outside a page that sizes it via CSS, which `Image.onload` needs to know how big to rasterize. This also incidentally makes the plain `.svg` download from task 15 more portable (an explicit intrinsic size, not just a `viewBox` a viewer has to interpret).
- Canvas tainting (a Known Risk called out in the plan for exactly this export path) was a non-issue in practice: every icon is already-inlined markup (task 7), and the baked `font-family` is always a system font stack, never an external `@font-face` - nothing in the rasterized image is a cross-origin resource `canvas.toBlob()` could refuse to read back.
- Toolbar gained a third "Export PNG" button alongside "Export JSON"/"Export SVG". The three export handlers' shared "task 14 incomplete-steps warning toast" logic was factored into one `warnAboutIncompleteSteps()` in `app.tsx` once PNG made it a third near-identical copy, rather than duplicated again.

## Files touched — PNG Export (task 16)

- `src/lib/svg-export.ts` — internal clone-building step extracted into `cloneCanvasForExport`/`serializeCanvasForExport` (now also sets explicit `width`/`height` on the clone from the live `viewBox`); added `rasterizeCanvasToPngBlob(svg, pixelDensity): Promise<Blob>`, shared rasterization logic PNG export (and potentially a future print/PDF raster fallback, task 17) both use.
- `src/lib/png-export.ts` — new: `exportCanvasAsPng(svg, title)`, fixed at `PIXEL_DENSITY = 2`.
- `src/app.tsx` — added `handleExportPng`; toolbar gained a third "Export PNG" button; factored the three export handlers' shared incomplete-steps-warning logic into one `warnAboutIncompleteSteps()`; added a `getExportSvgElement()` helper (was inlined twice for SVG export, now shared by SVG and PNG).
- `docs/known-issues.md` — the `untitled-instructions.<ext>` filename entry now covers `.png` too.
- `.claude/skills/run-instruction-builder/driver.mjs`, `SKILL.md` — new `PNG_EXPORT_IS_RASTERIZED_AT_PIXEL_DENSITY`/`PNG_EXPORT_WARNS_ABOUT_INCOMPLETE_STEPS` checks; the first reads the downloaded PNG's raw `IHDR` chunk directly rather than depending on an image-decoding library.
