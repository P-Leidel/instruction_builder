import type { QuantityAttachment } from "../model/instruction";
import { QUANTITY_ICON_ID } from "../data/icon-library";

export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 99999;

/**
 * Builds a `QuantityAttachment` from separate amount/unit fields, mirroring
 * `lib/duration.ts`'s `buildDuration`. Returns `undefined` for an amount
 * outside `MIN_QUANTITY..MAX_QUANTITY` (including a non-integer, since the
 * amount field is whole-number-only) rather than clamping, since - unlike a
 * duration, which always has *some* valid clamped value - there's no
 * sensible amount to silently substitute for the caller's invalid one.
 */
export function buildQuantity(amount: number, unit: string): QuantityAttachment | undefined {
  if (!Number.isInteger(amount) || amount < MIN_QUANTITY || amount > MAX_QUANTITY) return undefined;
  return { iconId: QUANTITY_ICON_ID, label: `${amount} ${unit}`, amount, unit };
}
