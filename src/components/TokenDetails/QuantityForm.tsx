import { useState } from "preact/hooks";
import type { QuantityAttachment } from "../../model/instruction";
import { MIN_QUANTITY, MAX_QUANTITY, buildQuantity } from "../../lib/quantity";
import { EU_FOOD_UNITS } from "../../data/units";

interface QuantityFormProps {
  value: QuantityAttachment | undefined;
  onSave: (next: QuantityAttachment) => void;
  onCancel: () => void;
}

/**
 * The amount+unit edit form for TokenDetails' Quantity field, rendered by
 * `CollapsedField`'s `renderForm` only while its popover is open - mounting
 * fresh on every open (see `CollapsedField`'s own doc comment) is what lets
 * the `useState(() => ...)` draft below re-seed from the current `value`'s
 * structured `amount`/`unit` on every open without an explicit reset hook.
 * `value?.unit` falls back to the first EU unit for a token with no
 * quantity yet (or - a defensive fallback, unreachable via this app's own
 * UI - an older imported document whose quantity predates these structured
 * fields and carries only a `label`).
 */
export function QuantityForm({ value, onSave, onCancel }: QuantityFormProps) {
  const [amountText, setAmountText] = useState(() => String(value?.amount ?? 1));
  const [unit, setUnit] = useState(() => value?.unit ?? EU_FOOD_UNITS[0].value);

  const amount = Number(amountText);
  const isValid = Number.isInteger(amount) && amount >= MIN_QUANTITY && amount <= MAX_QUANTITY;

  function save() {
    const built = buildQuantity(amount, unit);
    if (!built) return;
    onSave(built);
  }

  return (
    <div class="token-details__quantity-form">
      <label class="token-details__quantity-field">
        <span>Amount</span>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={amountText}
          onInput={(e) => setAmountText(e.currentTarget.value)}
          onFocus={(e) => e.currentTarget.select()}
        />
      </label>
      <label class="token-details__quantity-field">
        <span>Unit</span>
        <select value={unit} onChange={(e) => setUnit(e.currentTarget.value)}>
          {EU_FOOD_UNITS.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </select>
      </label>
      {!isValid && (
        <p class="token-details__quantity-error">
          Enter a whole number from {MIN_QUANTITY} to {MAX_QUANTITY}.
        </p>
      )}
      <div class="token-details__quantity-actions">
        <button
          type="button"
          class="collapsed-field__save"
          disabled={!isValid}
          aria-label={isValid ? `Save ${amount} ${unit}` : "Save quantity"}
          onClick={save}
        >
          Save
        </button>
        <button type="button" class="collapsed-field__cancel" aria-label="Cancel editing quantity" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
