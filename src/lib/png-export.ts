import { downloadBlob, slugify } from "./download";
import { rasterizeCanvasToPngBlob } from "./svg-export";

/**
 * 2x is the plan's own stated success criterion ("PNG exports are sharp at
 * 2x pixel density") - not configurable via UI for the MVP; a density
 * picker can be added later if a real need for 1x/3x shows up.
 */
const PIXEL_DENSITY = 2;

/**
 * Triggers a browser download of `svg` (see `App`'s hidden export-only
 * `InstructionCanvas`) as a PNG file (task 16), per
 * docs/project-plan.md's Export Strategy: the
 * same self-contained, style-baked SVG markup task 15 downloads directly is
 * instead loaded into an `Image` and rasterized onto an offscreen
 * `<canvas>` at `PIXEL_DENSITY`, then read back out via `canvas.toBlob` -
 * no external library, and no canvas-tainting risk (the Known Risk this
 * plan calls out) since every icon is already-inlined markup (task 7) and
 * every font is a system stack, never an externally-loaded resource.
 */
export async function exportCanvasAsPng(svg: SVGSVGElement, title: string): Promise<void> {
  const blob = await rasterizeCanvasToPngBlob(svg, PIXEL_DENSITY);
  downloadBlob(blob, `${slugify(title)}.png`);
}
