/**
 * Phase 2 task 7 (Icon Library). Icons are Lucide (lucide-static, ISC
 * license - permissive, same spirit as the plan's "MIT" note; see
 * node_modules/lucide-static/LICENSE), imported by exact file path so Vite
 * bundles only the ~17 icons this app actually uses, not the whole set.
 *
 * Each import is the icon's raw <svg>...</svg> source (Vite's `?raw`
 * suffix), 24x24 viewBox, stroke="currentColor". `innerMarkupOf` strips the
 * outer <svg> tag so the path/circle/etc. markup can be inlined directly
 * into this app's own SVG documents (InstructionCanvas) rather than
 * referenced via <image href>. That matters for task 15 (SVG export): an
 * exported document with <image> references to files outside the app would
 * be broken once opened elsewhere, but inlined paths make the export
 * self-contained. TokenPicker (plain HTML, not SVG) wraps the same inner
 * markup in its own <svg> element instead.
 *
 * Icon choices are approximate where Lucide has no literal match (e.g. no
 * "onion" or "oven" icon exists) - swapping any single mapping later never
 * touches the model, since tokens only ever store a stable `iconId` string.
 */
import chop from "lucide-static/icons/utensils-crossed.svg?raw";
import stir from "lucide-static/icons/refresh-cw.svg?raw";
import bake from "lucide-static/icons/flame.svg?raw";
import boil from "lucide-static/icons/droplets.svg?raw";
import mix from "lucide-static/icons/blend.svg?raw";

import onion from "lucide-static/icons/carrot.svg?raw";
import egg from "lucide-static/icons/egg.svg?raw";
import flour from "lucide-static/icons/wheat.svg?raw";
import water from "lucide-static/icons/glass-water.svg?raw";

import pan from "lucide-static/icons/cooking-pot.svg?raw";
import knife from "lucide-static/icons/pocket-knife.svg?raw";
import oven from "lucide-static/icons/microwave.svg?raw";

import weight from "lucide-static/icons/weight.svg?raw";
import clock from "lucide-static/icons/clock.svg?raw";

import hot from "lucide-static/icons/thermometer.svg?raw";
import sharp from "lucide-static/icons/triangle-alert.svg?raw";

// Every Quantity (any amount+unit) and every duration (any d/h/m/s value)
// reuses one icon each - the actual value is shown as text (see
// InstructionCanvas's chip badges and the step duration header), so the
// icon only needs to signal "this is a quantity" / "this is a duration" in
// Token/Step details, not visually distinguish individual values.
export const QUANTITY_ICON_ID = "quantity.amount";
export const TIME_ICON_ID = "time.duration";

/**
 * Strips the outer <svg ...> wrapper (and lucide-static's leading
 * `<!-- @license ... -->` comment, which a naive "first '>' " search would
 * stop at instead of the real tag) down to the inner path/circle markup.
 */
function innerMarkupOf(svgSource: string): string {
  const withoutComments = svgSource.replace(/<!--[\s\S]*?-->/g, "");
  const match = withoutComments.match(/<svg\b[^>]*>([\s\S]*)<\/svg>/);
  if (!match) {
    throw new Error("icon-library: could not parse an <svg> wrapper out of the source");
  }
  return match[1].trim();
}

/**
 * Every Lucide icon shares these presentation attributes on its outer
 * <svg> - stripped along with the wrapper above, so callers re-apply them
 * on whatever element hosts the inlined markup (a <g> in InstructionCanvas,
 * a <svg> in the Icon component) rather than repeating them per icon file.
 */
export const ICON_PRESENTATION_PROPS = {
  fill: "none",
  stroke: "currentColor",
  "stroke-width": 2,
  "stroke-linecap": "round" as const,
  "stroke-linejoin": "round" as const,
};

const RAW_ICONS: Record<string, string> = {
  "action.chop": chop,
  "action.stir": stir,
  "action.bake": bake,
  "action.boil": boil,
  "action.mix": mix,
  "object.onion": onion,
  "object.egg": egg,
  "object.flour": flour,
  "object.water": water,
  "tool.pan": pan,
  "tool.knife": knife,
  "tool.oven": oven,
  [QUANTITY_ICON_ID]: weight,
  "warning.hot": hot,
  "warning.sharp": sharp,
  [TIME_ICON_ID]: clock,
};

const ICON_MARKUP: Record<string, string> = Object.fromEntries(
  Object.entries(RAW_ICONS).map(([iconId, svg]) => [iconId, innerMarkupOf(svg)]),
);

/** Lucide's native viewBox - every icon here uses this same box. */
export const ICON_VIEW_BOX = "0 0 24 24";

/** Resolves iconId -> inlineable inner SVG markup, for use inside another <svg>. */
export function iconMarkup(iconId: string): string | undefined {
  return ICON_MARKUP[iconId];
}
