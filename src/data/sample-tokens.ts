import type { TokenCategory } from "../model/instruction";

/**
 * Placeholder token vocabulary for the Phase 1/2 prototype. Real icons are
 * resolved separately (data/icon-library.ts, task 7) by `iconId`, so this
 * data can be swapped/extended later without changing the model or any
 * component prop shapes.
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
  { iconId: "action.stir", category: "action", label: "Stir", description: "Mix gently with a spoon or utensil." },
  { iconId: "action.bake", category: "action", label: "Bake", description: "Cook using dry heat in an oven." },
  { iconId: "action.boil", category: "action", label: "Boil", description: "Heat a liquid until it bubbles rapidly." },
  { iconId: "action.mix", category: "action", label: "Mix", description: "Combine two or more ingredients together." },

  { iconId: "object.onion", category: "object", label: "Onion", description: "A layered bulb vegetable." },
  { iconId: "object.egg", category: "object", label: "Egg", description: "A whole egg, shell removed unless noted." },
  { iconId: "object.flour", category: "object", label: "Flour", description: "Milled grain, usually wheat." },
  { iconId: "object.water", category: "object", label: "Water", description: "Plain drinking water." },

  { iconId: "tool.pan", category: "tool", label: "Pan", description: "A stovetop frying pan or skillet." },
  { iconId: "tool.knife", category: "tool", label: "Knife", description: "A kitchen knife for cutting." },
  { iconId: "tool.oven", category: "tool", label: "Oven", description: "A conventional oven for baking or roasting." },

  { iconId: "warning.hot", category: "warning", label: "Hot!", description: "Caution: this step involves high heat." },
  { iconId: "warning.sharp", category: "warning", label: "Sharp!", description: "Caution: this step involves a sharp edge." },

  // Quantity and Time have no fixed presets - Quantity is a free amount+unit
  // form (TokenAttachmentPicker) and Time is a free day/hour/minute/second
  // form (DurationField), not a pick-from-a-list vocabulary like the
  // categories above.
];
