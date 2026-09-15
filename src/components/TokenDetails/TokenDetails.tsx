import { useState } from "preact/hooks";
import type { InstructionStep, InstructionToken, TokenAttachment } from "../../model/instruction";
import {
  selectedStep,
  selectedToken,
  updateTokenLabel,
  updateTokenNote,
  removeTokenAttachment,
  attachToSelectedToken,
  setTokenTime,
} from "../../state/document";
import { SAMPLE_TOKENS, descriptionFor } from "../../data/sample-tokens";
import { QUANTITY_ICON_ID } from "../../data/icon-library";
import { EU_FOOD_UNITS } from "../../data/units";
import { Icon } from "../Icon/Icon";
import { DurationField } from "../DurationField/DurationField";

const MIN_QUANTITY = 1;
const MAX_QUANTITY = 99999;

const WARNING_TOKENS = SAMPLE_TOKENS.filter((t) => t.category === "warning");

/**
 * Splits a "3 kg"-shaped label back into its amount/unit parts, for
 * pre-filling the edit form when editing an already-attached quantity -
 * mirrors lib/duration.ts's splitDuration. Falls back to 1/first-unit for
 * an unset or unrecognized value (e.g. a value from an older schema).
 */
function splitQuantity(attachment: TokenAttachment | undefined): { amountText: string; unit: string } {
  const fallback = { amountText: "1", unit: EU_FOOD_UNITS[0].value };
  if (!attachment?.label) return fallback;
  const [amountText, ...unitParts] = attachment.label.split(" ");
  const unit = unitParts.join(" ");
  return EU_FOOD_UNITS.some((u) => u.value === unit) ? { amountText, unit } : fallback;
}

/**
 * The "Quantity" field: collapsed to one line (a value with Edit/Remove, or
 * a "+ Quantity" button when unset) with a separate committed edit mode
 * (Save/Cancel) - the same collapsed/edit-toggle interaction as
 * `DurationField`'s "Token time" above it, duplicated here rather than
 * shared (Quantity's edit form - amount + unit - is different enough from
 * Duration's four d/h/m/s inputs that a shared component would mostly be
 * passing through props; revisit if a third value-editor like this shows
 * up). Editing an already-attached value pre-fills the form from it, same
 * as DurationField's `startEditing`. Unlike DurationField's static
 * aria-labels (a step/token only ever has one time), Edit/Remove/Save stay
 * dynamic (e.g. "Remove 3 kg") since a quantity's actual value is more
 * distinguishing information than "there's a time set".
 */
function QuantityRow({ step, token }: { step: InstructionStep; token: InstructionToken }) {
  const [editing, setEditing] = useState(false);
  const [amountText, setAmountText] = useState("1");
  const [unit, setUnit] = useState(EU_FOOD_UNITS[0].value);

  const amount = Number(amountText);
  const isValid = Number.isInteger(amount) && amount >= MIN_QUANTITY && amount <= MAX_QUANTITY;

  function startEditing() {
    const draft = splitQuantity(token.quantity);
    setAmountText(draft.amountText);
    setUnit(draft.unit);
    setEditing(true);
  }

  function save() {
    if (!isValid) return;
    attachToSelectedToken("quantity", { iconId: QUANTITY_ICON_ID, label: `${amount} ${unit}` });
    setEditing(false);
  }

  if (editing) {
    return (
      <div class="token-details__field">
        <span class="token-details__label">Quantity</span>
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
              class="token-details__quantity-save"
              disabled={!isValid}
              aria-label={isValid ? `Save ${amount} ${unit}` : "Save quantity"}
              onClick={save}
            >
              Save
            </button>
            <button
              type="button"
              class="token-details__quantity-cancel"
              aria-label="Cancel editing quantity"
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (token.quantity) {
    return (
      <div class="token-details__field">
        <span class="token-details__label">Quantity</span>
        <div class="token-details__quantity-display">
          <span class="token-details__quantity-value">{token.quantity.label}</span>
          <div class="token-details__quantity-display-actions">
            <button
              type="button"
              class="token-details__quantity-edit"
              aria-label={`Edit ${token.quantity.label}`}
              onClick={startEditing}
            >
              Edit
            </button>
            <button
              type="button"
              class="token-details__quantity-remove"
              aria-label={`Remove ${token.quantity.label}`}
              onClick={() => removeTokenAttachment(step.id, token.id, "quantity")}
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div class="token-details__field">
      <span class="token-details__label">Quantity</span>
      <button type="button" class="token-details__quantity-add" aria-label="Add quantity" onClick={startEditing}>
        + Quantity
      </button>
    </div>
  );
}

/**
 * The "Warning" field: the current value (if any, in the same
 * icon+label+remove chip look attachments have always used) plus its two
 * presets, always shown inline (not behind a tab or a collapse trigger)
 * since there are only two. The currently-attached preset is marked
 * active. Now the only field still using the old "attachment" chip look -
 * Quantity moved to DurationField's collapsed/edit-toggle pattern instead
 * (see QuantityRow above), since Warning's fixed two-preset choice doesn't
 * need a committed edit mode the way a free-typed amount does.
 */
function WarningRow({ step, token }: { step: InstructionStep; token: InstructionToken }) {
  return (
    <div class="token-details__field">
      <span class="token-details__label">Warning</span>
      {token.warning && (
        <div class="token-details__attachment">
          <Icon iconId={token.warning.iconId} size={16} />
          <span class="token-details__attachment-label">{token.warning.label}</span>
          <button
            type="button"
            class="token-details__attachment-remove"
            aria-label={`Remove ${token.warning.label ?? "warning"}`}
            onClick={() => removeTokenAttachment(step.id, token.id, "warning")}
          >
            ×
          </button>
        </div>
      )}
      <div class="token-picker__grid">
        {WARNING_TOKENS.map((sample) => (
          <button
            type="button"
            key={sample.iconId}
            class={`token-picker__button${
              token.warning?.iconId === sample.iconId ? " token-picker__button--active" : ""
            }`}
            onClick={() =>
              attachToSelectedToken("warning", { iconId: sample.iconId, label: sample.label })
            }
          >
            <Icon iconId={sample.iconId} size={22} />
            <span class="token-picker__label">{sample.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Editor for the currently selected token - see InstructionCanvas's
 * two-stage select behavior: a token only becomes selectable, and shows up
 * here, once its step is already selected. Mirrors StepDetails: a
 * user-editable title/notes pair, plus the read-only app-given description
 * from sample-tokens.ts.
 *
 * What used to be a separate TokenAttachmentPicker panel ("Add to token",
 * right column) is now two of this panel's own fields: Quantity (right
 * below Token time, sharing DurationField's collapsed/edit-toggle
 * interaction - see QuantityRow) and Warning (the last field, keeping the
 * older always-visible chip+preset-grid look - see WarningRow). There's no
 * longer a shared "Attachments" wrapper around them; each is its own
 * standalone field like Title/Notes/Token time. `QuantityRow`/`WarningRow`
 * are keyed by `token.id` for the same reason DurationField is below - so
 * switching tokens doesn't leak one token's in-progress edit into the next.
 */
export function TokenDetails() {
  const step = selectedStep.value;
  const token = selectedToken.value;

  if (!step || !token) {
    return (
      <div class="token-details">
        <h2 class="token-details__heading">Token details</h2>
        <p class="token-details__empty">
          Select a step, then click one of its tokens to edit it here.
        </p>
      </div>
    );
  }

  return (
    <div class="token-details">
      <h2 class="token-details__heading">Token details</h2>

      <p class="token-details__summary">
        <Icon iconId={token.iconId} size={18} /> {descriptionFor(token.iconId)}
      </p>

      <label class="token-details__field">
        <span class="token-details__label">Title</span>
        <input
          type="text"
          value={token.label ?? ""}
          placeholder="e.g. Chop"
          onInput={(event) => updateTokenLabel(step.id, token.id, event.currentTarget.value)}
        />
      </label>

      <label class="token-details__field">
        <span class="token-details__label">Notes</span>
        <textarea
          value={token.note ?? ""}
          placeholder="Add any extra detail for this token..."
          rows={3}
          onInput={(event) => updateTokenNote(step.id, token.id, event.currentTarget.value)}
        />
      </label>

      {/* `key={token.id}` forces a fresh instance per token - without it,
          Preact reuses the same DurationField across a token switch and its
          internal `editing` state (e.g. mid-edit, unsaved) leaks from the
          previously selected token into whichever token is selected now,
          showing a stale editing form instead of the new token's actual
          time (or lack of one). */}
      <DurationField
        key={token.id}
        label="Token time"
        value={token.time}
        onChange={(time) => setTokenTime(step.id, token.id, time)}
      />

      <QuantityRow key={`quantity-${token.id}`} step={step} token={token} />
      <WarningRow key={`warning-${token.id}`} step={step} token={token} />
    </div>
  );
}
