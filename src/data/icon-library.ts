/**
 * Phase 2 task 7 (Icon Library), expanded by Phase 3 task 25 to a curated
 * "v1" recipe vocabulary. Icons are Lucide (lucide-static, ISC license -
 * permissive, same spirit as the plan's "MIT" note; see
 * node_modules/lucide-static/LICENSE), imported by exact file path so Vite
 * bundles only the icons this app actually uses (~50), not the whole
 * 2,000+-icon set.
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
 * A handful of icons are deliberately reused across more than one entry
 * (same pattern already used for Quantity/Time below) where Lucide has no
 * distinct icon for a related concept - e.g. Fry reuses Bake's flame, and
 * Garlic/Tomato/Potato/Cheese/Bread/Salt/Pepper/Sugar all share one generic
 * "food" fallback icon (`utensils`) since Lucide has no literal icon for any
 * of them - decided 2026-09-14 rather than omitting these common staples
 * entirely. Each import is named for the token it's used in, not the icon
 * file, since a name like `flame` would be misleading once it's reused.
 *
 * 2026-09-17: expanded again with 12 generic action verbs (Add, Remove,
 * Wait, Turn, Attach, Detach, Repeat, Measure, Open, Close, Check, Adjust -
 * usable across cooking, assembly, and general procedures, not just
 * recipes) and 15 more ingredients, per real user testing feedback. Lucide
 * has literal icons for only 4 of the 15 (Cherry, Chicken, Ham, Wheat -
 * Wheat reuses Flour's existing `wheat` icon, same reuse pattern as above);
 * the rest (Rice, Pasta, Butter, Honey, Chocolate, Mushroom, Corn, Avocado,
 * Cucumber, Cabbage, Yogurt) fall back to the same shared `genericFood`
 * icon already used for Garlic/Tomato/etc. above, rather than being
 * omitted.
 */
import chop from "lucide-static/icons/utensils-crossed.svg?raw";
import stir from "lucide-static/icons/refresh-cw.svg?raw";
import whisk from "lucide-static/icons/refresh-ccw.svg?raw";
import mix from "lucide-static/icons/blend.svg?raw";
import knead from "lucide-static/icons/hand-fist.svg?raw";
import slice from "lucide-static/icons/slice.svg?raw";
import bake from "lucide-static/icons/flame.svg?raw";
import roast from "lucide-static/icons/flame-kindling.svg?raw";
import boil from "lucide-static/icons/droplets.svg?raw";
import simmer from "lucide-static/icons/thermometer-sun.svg?raw";
import steam from "lucide-static/icons/wind.svg?raw";
import pour from "lucide-static/icons/droplet.svg?raw";
import drain from "lucide-static/icons/funnel.svg?raw";
import chill from "lucide-static/icons/snowflake.svg?raw";
import freeze from "lucide-static/icons/thermometer-snowflake.svg?raw";
import serve from "lucide-static/icons/hand-platter.svg?raw";

import onion from "lucide-static/icons/carrot.svg?raw";
import egg from "lucide-static/icons/egg.svg?raw";
import flour from "lucide-static/icons/wheat.svg?raw";
import water from "lucide-static/icons/glass-water.svg?raw";
import apple from "lucide-static/icons/apple.svg?raw";
import banana from "lucide-static/icons/banana.svg?raw";
import grape from "lucide-static/icons/grape.svg?raw";
import citrus from "lucide-static/icons/citrus.svg?raw";
import beef from "lucide-static/icons/beef.svg?raw";
import fish from "lucide-static/icons/fish.svg?raw";
import milk from "lucide-static/icons/milk.svg?raw";
import beans from "lucide-static/icons/bean.svg?raw";
import nuts from "lucide-static/icons/nut.svg?raw";
import wine from "lucide-static/icons/wine.svg?raw";
import coffee from "lucide-static/icons/coffee.svg?raw";
import soup from "lucide-static/icons/soup.svg?raw";
import leafyGreen from "lucide-static/icons/leafy-green.svg?raw";
import herbs from "lucide-static/icons/sprout.svg?raw";
import genericFood from "lucide-static/icons/utensils.svg?raw";

import pan from "lucide-static/icons/cooking-pot.svg?raw";
import knife from "lucide-static/icons/pocket-knife.svg?raw";
import oven from "lucide-static/icons/microwave.svg?raw";
import blender from "lucide-static/icons/blender.svg?raw";
import fridge from "lucide-static/icons/refrigerator.svg?raw";
import scale from "lucide-static/icons/scale.svg?raw";
import timer from "lucide-static/icons/timer.svg?raw";
import container from "lucide-static/icons/container.svg?raw";

import weight from "lucide-static/icons/weight.svg?raw";
import clock from "lucide-static/icons/clock.svg?raw";

import hot from "lucide-static/icons/thermometer.svg?raw";
import sharp from "lucide-static/icons/triangle-alert.svg?raw";

import add from "lucide-static/icons/plus.svg?raw";
import remove from "lucide-static/icons/minus.svg?raw";
import wait from "lucide-static/icons/hourglass.svg?raw";
import turn from "lucide-static/icons/rotate-cw.svg?raw";
import attach from "lucide-static/icons/paperclip.svg?raw";
import detach from "lucide-static/icons/unlink.svg?raw";
import repeatAction from "lucide-static/icons/repeat.svg?raw";
import measure from "lucide-static/icons/ruler.svg?raw";
import open from "lucide-static/icons/door-open.svg?raw";
import close from "lucide-static/icons/door-closed.svg?raw";
import check from "lucide-static/icons/search-check.svg?raw";
import adjust from "lucide-static/icons/sliders-horizontal.svg?raw";

import cherry from "lucide-static/icons/cherry.svg?raw";
import chicken from "lucide-static/icons/drumstick.svg?raw";
import ham from "lucide-static/icons/ham.svg?raw";

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
  "action.whisk": whisk,
  "action.mix": mix,
  "action.knead": knead,
  "action.slice": slice,
  "action.bake": bake,
  "action.fry": bake,
  "action.roast": roast,
  "action.boil": boil,
  "action.simmer": simmer,
  "action.steam": steam,
  "action.pour": pour,
  "action.drain": drain,
  "action.rinse": boil,
  "action.chill": chill,
  "action.freeze": freeze,
  "action.serve": serve,
  "action.add": add,
  "action.remove": remove,
  "action.wait": wait,
  "action.turn": turn,
  "action.attach": attach,
  "action.detach": detach,
  "action.repeat": repeatAction,
  "action.measure": measure,
  "action.open": open,
  "action.close": close,
  "action.check": check,
  "action.adjust": adjust,

  "object.onion": onion,
  "object.egg": egg,
  "object.flour": flour,
  "object.water": water,
  "object.apple": apple,
  "object.banana": banana,
  "object.grape": grape,
  "object.citrus": citrus,
  "object.beef": beef,
  "object.fish": fish,
  "object.milk": milk,
  "object.beans": beans,
  "object.nuts": nuts,
  "object.oil": pour,
  "object.wine": wine,
  "object.coffee": coffee,
  "object.soup": soup,
  "object.leafy-green": leafyGreen,
  "object.herbs": herbs,
  "object.ice": chill,
  "object.garlic": genericFood,
  "object.tomato": genericFood,
  "object.potato": genericFood,
  "object.cheese": genericFood,
  "object.bread": genericFood,
  "object.salt": genericFood,
  "object.pepper": genericFood,
  "object.sugar": genericFood,
  "object.cherry": cherry,
  "object.chicken": chicken,
  "object.ham": ham,
  "object.wheat": flour,
  "object.rice": genericFood,
  "object.pasta": genericFood,
  "object.butter": genericFood,
  "object.honey": genericFood,
  "object.chocolate": genericFood,
  "object.mushroom": genericFood,
  "object.corn": genericFood,
  "object.avocado": genericFood,
  "object.cucumber": genericFood,
  "object.cabbage": genericFood,
  "object.yogurt": genericFood,

  "tool.pan": pan,
  "tool.knife": knife,
  "tool.oven": oven,
  "tool.blender": blender,
  "tool.fridge": fridge,
  "tool.scale": scale,
  "tool.timer": timer,
  "tool.thermometer": hot,
  "tool.container": container,

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
