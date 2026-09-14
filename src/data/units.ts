/**
 * Common EU food-measurement units for the Quantity attachment. Deliberately
 * a plain, swappable list rather than baked into the model or a component -
 * when Phase 3's content-pack system lands (see
 * docs/project-plan.md), a non-food domain (e.g.
 * assembly instructions) can offer a different unit list without this
 * file's shape - or the Quantity attachment's own shape - needing to change.
 */
export interface UnitOption {
  /** Stored on the attachment and shown to the user - short by design, it renders inside a small chip badge. */
  value: string;
  /** Slightly longer form shown in the unit picker's own dropdown. */
  label: string;
}

export const EU_FOOD_UNITS: UnitOption[] = [
  { value: "g", label: "g (grams)" },
  { value: "kg", label: "kg (kilograms)" },
  { value: "ml", label: "ml (milliliters)" },
  { value: "l", label: "l (liters)" },
  { value: "tsp", label: "tsp (teaspoon)" },
  { value: "tbsp", label: "tbsp (tablespoon)" },
  { value: "pinch", label: "pinch" },
  { value: "pcs", label: "pcs (pieces)" },
];
