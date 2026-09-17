import type { TokenCategory } from "../model/instruction";

/**
 * Curated recipe token vocabulary (Phase 2 task 7's small prototype set,
 * expanded to Phase 3 task 26's "v1" list). Real icons are resolved
 * separately (data/icon-library.ts, task 25) by `iconId`, so this data can
 * be swapped/extended later without changing the model or any component
 * prop shapes.
 */
export interface SampleToken {
  iconId: string;
  category: TokenCategory;
  label: string;
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

export const SAMPLE_TOKENS: SampleToken[] = [
  { iconId: "action.chop", category: "action", label: "Chop" },
  { iconId: "action.slice", category: "action", label: "Slice" },
  { iconId: "action.stir", category: "action", label: "Stir" },
  { iconId: "action.whisk", category: "action", label: "Whisk" },
  { iconId: "action.mix", category: "action", label: "Mix" },
  { iconId: "action.knead", category: "action", label: "Knead" },
  { iconId: "action.bake", category: "action", label: "Bake" },
  { iconId: "action.fry", category: "action", label: "Fry" },
  { iconId: "action.roast", category: "action", label: "Roast" },
  { iconId: "action.boil", category: "action", label: "Boil" },
  { iconId: "action.simmer", category: "action", label: "Simmer" },
  { iconId: "action.steam", category: "action", label: "Steam" },
  { iconId: "action.pour", category: "action", label: "Pour" },
  { iconId: "action.drain", category: "action", label: "Drain" },
  { iconId: "action.rinse", category: "action", label: "Rinse" },
  { iconId: "action.chill", category: "action", label: "Chill" },
  { iconId: "action.freeze", category: "action", label: "Freeze" },
  { iconId: "action.serve", category: "action", label: "Serve" },
  { iconId: "action.add", category: "action", label: "Add" },
  { iconId: "action.remove", category: "action", label: "Remove" },
  { iconId: "action.wait", category: "action", label: "Wait" },
  { iconId: "action.turn", category: "action", label: "Turn" },
  { iconId: "action.attach", category: "action", label: "Attach" },
  { iconId: "action.detach", category: "action", label: "Detach" },
  { iconId: "action.repeat", category: "action", label: "Repeat" },
  { iconId: "action.measure", category: "action", label: "Measure" },
  { iconId: "action.open", category: "action", label: "Open" },
  { iconId: "action.close", category: "action", label: "Close" },
  { iconId: "action.check", category: "action", label: "Check" },
  { iconId: "action.adjust", category: "action", label: "Adjust" },

  { iconId: "object.onion", category: "object", label: "Onion" },
  { iconId: "object.garlic", category: "object", label: "Garlic" },
  { iconId: "object.egg", category: "object", label: "Egg" },
  { iconId: "object.flour", category: "object", label: "Flour" },
  { iconId: "object.water", category: "object", label: "Water" },
  { iconId: "object.apple", category: "object", label: "Apple" },
  { iconId: "object.banana", category: "object", label: "Banana" },
  { iconId: "object.grape", category: "object", label: "Grape" },
  { iconId: "object.citrus", category: "object", label: "Citrus" },
  { iconId: "object.tomato", category: "object", label: "Tomato" },
  { iconId: "object.potato", category: "object", label: "Potato" },
  { iconId: "object.leafy-green", category: "object", label: "Leafy Greens" },
  { iconId: "object.herbs", category: "object", label: "Herbs" },
  { iconId: "object.beef", category: "object", label: "Beef" },
  { iconId: "object.fish", category: "object", label: "Fish" },
  { iconId: "object.beans", category: "object", label: "Beans" },
  { iconId: "object.nuts", category: "object", label: "Nuts" },
  { iconId: "object.milk", category: "object", label: "Milk" },
  { iconId: "object.cheese", category: "object", label: "Cheese" },
  { iconId: "object.oil", category: "object", label: "Oil" },
  { iconId: "object.bread", category: "object", label: "Bread" },
  { iconId: "object.wine", category: "object", label: "Wine" },
  { iconId: "object.coffee", category: "object", label: "Coffee" },
  { iconId: "object.soup", category: "object", label: "Soup" },
  { iconId: "object.ice", category: "object", label: "Ice" },
  { iconId: "object.salt", category: "object", label: "Salt" },
  { iconId: "object.pepper", category: "object", label: "Pepper" },
  { iconId: "object.sugar", category: "object", label: "Sugar" },
  { iconId: "object.cherry", category: "object", label: "Cherry" },
  { iconId: "object.chicken", category: "object", label: "Chicken" },
  { iconId: "object.ham", category: "object", label: "Ham" },
  { iconId: "object.wheat", category: "object", label: "Wheat" },
  { iconId: "object.rice", category: "object", label: "Rice" },
  { iconId: "object.pasta", category: "object", label: "Pasta" },
  { iconId: "object.butter", category: "object", label: "Butter" },
  { iconId: "object.honey", category: "object", label: "Honey" },
  { iconId: "object.chocolate", category: "object", label: "Chocolate" },
  { iconId: "object.mushroom", category: "object", label: "Mushroom" },
  { iconId: "object.corn", category: "object", label: "Corn" },
  { iconId: "object.avocado", category: "object", label: "Avocado" },
  { iconId: "object.cucumber", category: "object", label: "Cucumber" },
  { iconId: "object.cabbage", category: "object", label: "Cabbage" },
  { iconId: "object.yogurt", category: "object", label: "Yogurt" },

  { iconId: "tool.pan", category: "tool", label: "Pan" },
  { iconId: "tool.knife", category: "tool", label: "Knife" },
  { iconId: "tool.oven", category: "tool", label: "Oven" },
  { iconId: "tool.blender", category: "tool", label: "Blender" },
  { iconId: "tool.fridge", category: "tool", label: "Fridge" },
  { iconId: "tool.scale", category: "tool", label: "Scale" },
  { iconId: "tool.timer", category: "tool", label: "Timer" },
  { iconId: "tool.thermometer", category: "tool", label: "Thermometer" },
  { iconId: "tool.container", category: "tool", label: "Container" },

  { iconId: "warning.hot", category: "warning", label: "Hot!" },
  { iconId: "warning.sharp", category: "warning", label: "Sharp!" },

  // Quantity and Time have no fixed presets - Quantity is a free amount+unit
  // form (TokenDetails' QuantityRow) and Time is a free day/hour/minute/second
  // form (DurationField), not a pick-from-a-list vocabulary like the
  // categories above.
];
