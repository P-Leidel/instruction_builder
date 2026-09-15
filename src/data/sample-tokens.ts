import type { TokenCategory } from "../model/instruction";

/**
 * Curated recipe token vocabulary (Phase 2 task 7's small prototype set,
 * expanded to Phase 3 task 26's "v1" list). Real icons are resolved
 * separately (data/icon-library.ts, task 25) by `iconId`, so this data can
 * be swapped/extended later without changing the model or any component
 * prop shapes.
 *
 * `description` is a short, app-authored explanation of what the token
 * means - shown in StepDetails/TokenDetails next to the user's own
 * title/details, not something the user edits themselves.
 */
export interface SampleToken {
  iconId: string;
  category: TokenCategory;
  label: string;
  description: string;
}

/** Display name per category, shared by every token-picking UI. */
export const CATEGORY_LABELS: Record<TokenCategory, string> = {
  action: "Actions",
  object: "Objects",
  tool: "Tools",
  quantity: "Quantities",
  warning: "Warnings",
  time: "Time",
};

/** App-given explanation for a sample token's icon, shared by StepDetails/TokenDetails. */
export function descriptionFor(iconId: string): string | undefined {
  return SAMPLE_TOKENS.find((s) => s.iconId === iconId)?.description;
}

export const SAMPLE_TOKENS: SampleToken[] = [
  { iconId: "action.chop", category: "action", label: "Chop", description: "Cut into small pieces with a knife." },
  { iconId: "action.slice", category: "action", label: "Slice", description: "Cut into thin, even pieces." },
  { iconId: "action.stir", category: "action", label: "Stir", description: "Mix gently with a spoon or utensil." },
  { iconId: "action.whisk", category: "action", label: "Whisk", description: "Beat rapidly to blend or add air." },
  { iconId: "action.mix", category: "action", label: "Mix", description: "Combine two or more ingredients together." },
  { iconId: "action.knead", category: "action", label: "Knead", description: "Work dough by pressing and folding it repeatedly." },
  { iconId: "action.bake", category: "action", label: "Bake", description: "Cook using dry heat in an oven." },
  { iconId: "action.fry", category: "action", label: "Fry", description: "Cook in hot oil or fat." },
  { iconId: "action.roast", category: "action", label: "Roast", description: "Cook uncovered with dry heat, usually in an oven." },
  { iconId: "action.boil", category: "action", label: "Boil", description: "Heat a liquid until it bubbles rapidly." },
  { iconId: "action.simmer", category: "action", label: "Simmer", description: "Cook gently in liquid just below boiling." },
  { iconId: "action.steam", category: "action", label: "Steam", description: "Cook using hot water vapor." },
  { iconId: "action.pour", category: "action", label: "Pour", description: "Transfer a liquid from one container to another." },
  { iconId: "action.drain", category: "action", label: "Drain", description: "Remove liquid, usually through a strainer." },
  { iconId: "action.rinse", category: "action", label: "Rinse", description: "Wash briefly under running water." },
  { iconId: "action.chill", category: "action", label: "Chill", description: "Cool in a refrigerator." },
  { iconId: "action.freeze", category: "action", label: "Freeze", description: "Cool below freezing in a freezer." },
  { iconId: "action.serve", category: "action", label: "Serve", description: "Plate and present the finished dish." },

  { iconId: "object.onion", category: "object", label: "Onion", description: "A layered bulb vegetable." },
  { iconId: "object.garlic", category: "object", label: "Garlic", description: "A pungent bulb used to flavor dishes." },
  { iconId: "object.egg", category: "object", label: "Egg", description: "A whole egg, shell removed unless noted." },
  { iconId: "object.flour", category: "object", label: "Flour", description: "Milled grain, usually wheat." },
  { iconId: "object.water", category: "object", label: "Water", description: "Plain drinking water." },
  { iconId: "object.apple", category: "object", label: "Apple", description: "A common fruit, eaten fresh or cooked." },
  { iconId: "object.banana", category: "object", label: "Banana", description: "A sweet, soft fruit." },
  { iconId: "object.grape", category: "object", label: "Grape", description: "A small, sweet fruit, usually eaten fresh." },
  { iconId: "object.citrus", category: "object", label: "Citrus", description: "A citrus fruit such as lemon, lime, or orange." },
  { iconId: "object.tomato", category: "object", label: "Tomato", description: "A juicy, red fruit used as a vegetable." },
  { iconId: "object.potato", category: "object", label: "Potato", description: "A starchy root vegetable." },
  { iconId: "object.leafy-green", category: "object", label: "Leafy Greens", description: "Lettuce or other leafy greens." },
  { iconId: "object.herbs", category: "object", label: "Herbs", description: "Fresh or dried herbs." },
  { iconId: "object.beef", category: "object", label: "Beef", description: "Meat from cattle." },
  { iconId: "object.fish", category: "object", label: "Fish", description: "Any edible fish." },
  { iconId: "object.beans", category: "object", label: "Beans", description: "Dried or fresh beans." },
  { iconId: "object.nuts", category: "object", label: "Nuts", description: "Any edible nut." },
  { iconId: "object.milk", category: "object", label: "Milk", description: "Dairy milk." },
  { iconId: "object.cheese", category: "object", label: "Cheese", description: "A dairy product made from milk." },
  { iconId: "object.oil", category: "object", label: "Oil", description: "Cooking oil." },
  { iconId: "object.bread", category: "object", label: "Bread", description: "A baked food made from flour and water." },
  { iconId: "object.wine", category: "object", label: "Wine", description: "Wine, used for drinking or cooking." },
  { iconId: "object.coffee", category: "object", label: "Coffee", description: "Brewed coffee." },
  { iconId: "object.soup", category: "object", label: "Soup", description: "A prepared soup or broth." },
  { iconId: "object.ice", category: "object", label: "Ice", description: "Frozen water, used to cool or chill." },
  { iconId: "object.salt", category: "object", label: "Salt", description: "A mineral seasoning." },
  { iconId: "object.pepper", category: "object", label: "Pepper", description: "A spice or vegetable, depending on variety." },
  { iconId: "object.sugar", category: "object", label: "Sugar", description: "A sweetener." },

  { iconId: "tool.pan", category: "tool", label: "Pan", description: "A stovetop frying pan or skillet." },
  { iconId: "tool.knife", category: "tool", label: "Knife", description: "A kitchen knife for cutting." },
  { iconId: "tool.oven", category: "tool", label: "Oven", description: "A conventional oven for baking or roasting." },
  { iconId: "tool.blender", category: "tool", label: "Blender", description: "An appliance for blending or pureeing." },
  { iconId: "tool.fridge", category: "tool", label: "Fridge", description: "An appliance for keeping food cold." },
  { iconId: "tool.scale", category: "tool", label: "Scale", description: "A kitchen scale for weighing ingredients." },
  { iconId: "tool.timer", category: "tool", label: "Timer", description: "A timer for tracking cook time." },
  { iconId: "tool.thermometer", category: "tool", label: "Thermometer", description: "A thermometer for checking food temperature." },
  { iconId: "tool.container", category: "tool", label: "Container", description: "A container for storing or holding ingredients." },

  { iconId: "warning.hot", category: "warning", label: "Hot!", description: "Caution: this step involves high heat." },
  { iconId: "warning.sharp", category: "warning", label: "Sharp!", description: "Caution: this step involves a sharp edge." },

  // Quantity and Time have no fixed presets - Quantity is a free amount+unit
  // form (TokenDetails' QuantityRow) and Time is a free day/hour/minute/second
  // form (DurationField), not a pick-from-a-list vocabulary like the
  // categories above.
];
