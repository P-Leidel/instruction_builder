import { useState } from "preact/hooks";
import type { TokenCategory } from "../../model/instruction";
import { selectedToken, attachToSelectedToken } from "../../state/document";
import { activeAttachmentCategory } from "../../state/ui";
import { SAMPLE_TOKENS, CATEGORY_LABELS, type SampleToken } from "../../data/sample-tokens";
import { QUANTITY_ICON_ID } from "../../data/icon-library";
import { EU_FOOD_UNITS } from "../../data/units";
import { Icon } from "../Icon/Icon";

// Time is deliberately not here - it attaches to a step as well as a token,
// needs its own day/hour/minute/second input rather than a picked value,
// and lives in Step/Token details' DurationField instead (see
// docs/phase-2/Progress-Log.md for why it was factored out of this picker).
const ATTACHMENT_CATEGORIES: TokenCategory[] = ["quantity", "warning"];

const MIN_QUANTITY = 1;
const MAX_QUANTITY = 99999;

/** Amount (1-99999, integer) + a common EU food unit - Quantity's own form, not a preset grid. */
function QuantityForm() {
  const [amountText, setAmountText] = useState("1");
  const [unit, setUnit] = useState(EU_FOOD_UNITS[0].value);

  const amount = Number(amountText);
  const isValid = Number.isInteger(amount) && amount >= MIN_QUANTITY && amount <= MAX_QUANTITY;

  function attach() {
    if (!isValid) return;
    attachToSelectedToken("quantity", { iconId: QUANTITY_ICON_ID, label: `${amount} ${unit}` });
  }

  return (
    <div class="token-attachment-picker__form">
      <label class="token-attachment-picker__field">
        <span>Amount</span>
        <input
          type="number"
          min={MIN_QUANTITY}
          max={MAX_QUANTITY}
          step={1}
          value={amountText}
          onInput={(e) => setAmountText(e.currentTarget.value)}
        />
      </label>
      <label class="token-attachment-picker__field">
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
        <p class="token-attachment-picker__error">
          Enter a whole number from {MIN_QUANTITY} to {MAX_QUANTITY}.
        </p>
      )}
      <button type="button" class="token-attachment-picker__attach" disabled={!isValid} onClick={attach}>
        Attach
      </button>
    </div>
  );
}

/**
 * "Add to token": attaches a Quantity or Warning to the currently *selected
 * token* (InstructionCanvas's two-stage select - a token, not just its
 * step, must be selected). Click-only by design (no drag, unlike
 * TokenPicker) - attaching only makes sense once a specific token is
 * already selected, so there's no "drop anywhere and we'll figure out the
 * target" case to support.
 */
export function TokenAttachmentPicker() {
  const token = selectedToken.value;
  const active = activeAttachmentCategory.value ?? ATTACHMENT_CATEGORIES[0];
  const warningTokens = SAMPLE_TOKENS.filter((t) => t.category === "warning");

  return (
    <div class="token-attachment-picker">
      <h2 class="token-picker__heading">Add to token</h2>
      {!token ? (
        <p class="token-details__empty">
          Select a step, then click one of its tokens to attach items to it.
        </p>
      ) : (
        <>
          <div class="token-picker__tabs" role="tablist" aria-label="Attachment category">
            {ATTACHMENT_CATEGORIES.map((category) => (
              <button
                type="button"
                key={category}
                role="tab"
                aria-selected={category === active}
                aria-controls="token-attachment-picker-panel"
                class={`token-picker__tab${category === active ? " token-picker__tab--active" : ""}`}
                onClick={() => (activeAttachmentCategory.value = category)}
              >
                {CATEGORY_LABELS[category]}
              </button>
            ))}
          </div>
          <div class="token-picker__grid" role="tabpanel" id="token-attachment-picker-panel">
            {active === "quantity" ? (
              <QuantityForm />
            ) : (
              warningTokens.map((sample: SampleToken) => (
                <button
                  type="button"
                  key={sample.iconId}
                  class="token-picker__button"
                  onClick={() =>
                    attachToSelectedToken("warning", { iconId: sample.iconId, label: sample.label })
                  }
                >
                  <Icon iconId={sample.iconId} size={22} />
                  <span class="token-picker__label">{sample.label}</span>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
