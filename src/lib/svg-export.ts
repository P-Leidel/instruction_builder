import { downloadBlob, slugify } from "./document-file";

/**
 * The canvas's entire visual appearance - fills, strokes, fonts, colors -
 * comes from CSS classes in global.css (resolved against its
 * custom-property design tokens), not inline attributes. `XMLSerializer`
 * only captures DOM markup, never the stylesheet that gives it meaning, so
 * serializing the live SVG node as-is would download a file that opens as
 * unstyled/invisible shapes in any tool that isn't this app's own page.
 * These are exactly (and only) the presentation properties this app's
 * canvas rules in global.css actually set - see the `.instruction-canvas__*`
 * rules - not a general-purpose style-baking list. Exported (not just used
 * internally) so `svg-export.test.ts` can assert this list actually stays
 * in sync with global.css, rather than trusting this comment alone - see
 * docs/known-issues.md's "chip style-baking allowlist" entry, added after
 * a 2026-09-14 architecture review flagged the two having no seam back to
 * each other as a silent-drift risk.
 */
export const BAKED_STYLE_PROPS = [
  "fill",
  "stroke",
  "stroke-width",
  "stroke-dasharray",
  "stroke-linejoin",
  "stroke-linecap",
  "color", // resolves descendants' `stroke="currentColor"` (see data/icon-library.ts)
  "font-family",
  "font-size",
  "font-weight",
  "font-variant-numeric",
] as const;

/**
 * Copies `source`'s resolved styles onto `target` as an inline `style`
 * attribute, recursively - `source` must still be attached to the document
 * (computed style is meaningless on a detached node), `target` must be a
 * structurally identical clone of it (e.g. via `cloneNode(true)`) so the two
 * trees can be walked in lockstep by child index.
 *
 * Every property in `BAKED_STYLE_PROPS` is driven purely by an element's own
 * tag/class and its ancestors' resolved styles (never by sibling index or
 * anything else structural - see the comment on `BAKED_STYLE_PROPS`), so two
 * elements with the same tag+class whose ancestor chains baked to the same
 * style string are guaranteed to resolve to the same computed style
 * themselves. `cache` exploits that: a real instruction canvas repeats the
 * same tag/class subtree (an icon's paths, a chip's badge) many times over,
 * and this skips the forced synchronous style recalc of `getComputedStyle`
 * for every repeat after the first instead of paying for one per element.
 */
function bakeComputedStyles(source: Element, target: Element): void {
  bakeComputedStylesRecursive(source, target, new Map(), "");
}

function bakeComputedStylesRecursive(
  source: Element,
  target: Element,
  cache: Map<string, string>,
  ancestorStyle: string,
): void {
  const cacheKey = `${source.tagName}|${source.getAttribute("class") ?? ""}|${ancestorStyle}`;
  let style = cache.get(cacheKey);
  if (style === undefined) {
    const computed = getComputedStyle(source);
    style = BAKED_STYLE_PROPS.map((prop) => `${prop}: ${computed.getPropertyValue(prop)}`).join("; ");
    cache.set(cacheKey, style);
  }
  target.setAttribute("style", style);
  for (let i = 0; i < source.children.length; i++) {
    bakeComputedStylesRecursive(source.children[i], target.children[i], cache, style);
  }
}

/**
 * Builds a standalone, self-contained clone of `svg` (the live, read-only
 * canvas's own `<svg>` element - see `App`'s hidden export-only
 * `InstructionCanvas`), suitable for serializing outside this app's page:
 * every class-driven style baked to an inline `style` attribute (see
 * `bakeComputedStyles`), plus explicit `width`/`height` attributes taken
 * from the live element's `viewBox` - without them, an `<svg>` with only a
 * `viewBox` has no well-defined intrinsic size once it's outside a page
 * that sizes it via CSS (`.instruction-canvas__svg`'s `width: clamp(...)`),
 * which matters both for opening the file directly and for PNG export
 * (task 16), which loads this markup into an `Image` and needs a real
 * natural size to rasterize from.
 */
function cloneCanvasForExport(svg: SVGSVGElement): SVGSVGElement {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const { width, height } = svg.viewBox.baseVal;
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  bakeComputedStyles(svg, clone);
  return clone;
}

/** Serializes `svg` (see `cloneCanvasForExport`) to a standalone XML string. */
function serializeCanvasForExport(svg: SVGSVGElement): string {
  const clone = cloneCanvasForExport(svg);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
}

/**
 * Triggers a browser download of `svg` as a standalone `.svg` file (task
 * 15). Per docs/project-plan.md's Export
 * Strategy, this serializes the real rendered DOM (`XMLSerializer`) rather
 * than a from-scratch re-render - but only after baking every class-driven
 * style onto a cloned copy first (see `cloneCanvasForExport`), so the file
 * is genuinely self-contained: icons are already inlined markup (see
 * data/icon-library.ts), and now colors/fonts are inlined too, with no
 * dependency on this app's stylesheet to render correctly elsewhere.
 */
export function exportCanvasAsSvg(svg: SVGSVGElement, title: string): void {
  const markup = serializeCanvasForExport(svg);
  downloadBlob(new Blob([markup], { type: "image/svg+xml" }), `${slugify(title)}.svg`);
}

/**
 * Renders `svg` to a `<canvas>` at `pixelDensity` and resolves with the
 * result as a PNG `Blob` (task 16). Shared by `exportCanvasAsPng`
 * (lib/png-export.ts) and, if a print/PDF path ever needs a raster
 * fallback (task 17), that too - the SVG-to-canvas rasterization step is
 * the same regardless of what happens to the resulting image afterward.
 */
export function rasterizeCanvasToPngBlob(svg: SVGSVGElement, pixelDensity: number): Promise<Blob> {
  const markup = serializeCanvasForExport(svg);
  const { width, height } = svg.viewBox.baseVal;

  return new Promise((resolve, reject) => {
    const svgUrl = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml" }));
    const image = new Image();
    image.onload = () => {
      // Drawing a vector image onto a canvas larger than its own natural
      // size rasterizes it fresh at the destination resolution (this is
      // what makes `pixelDensity` produce a genuinely sharper PNG, not a
      // blurry upscale of a fixed-resolution bitmap) - see
      // docs/project-plan.md's Export Strategy.
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * pixelDensity);
      canvas.height = Math.round(height * pixelDensity);
      const ctx = canvas.getContext("2d");
      URL.revokeObjectURL(svgUrl);
      if (!ctx) {
        reject(new Error("This browser can't render a 2D canvas."));
        return;
      }
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Rendering the PNG failed."));
      }, "image/png");
    };
    image.onerror = () => {
      URL.revokeObjectURL(svgUrl);
      reject(new Error("Could not load the canvas as an image."));
    };
    image.src = svgUrl;
  });
}
