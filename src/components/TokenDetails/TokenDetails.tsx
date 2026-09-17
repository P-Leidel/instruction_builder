import { useState } from "preact/hooks";
import type { InstructionStep, InstructionToken } from "../../model/instruction";
import {
  selectedStep,
  selectedToken,
  updateTokenLabel,
  updateTokenNote,
  removeTokenAttachment,
  attachToToken,
  setTokenTime,
  copyToken,
} from "../../state/document";
import { toast } from "../../state/ui";
import { SAMPLE_TOKENS } from "../../data/sample-tokens";
import { Icon } from "../Icon/Icon";
import { CollapsedField } from "../CollapsedField/CollapsedField";
import { DurationField } from "../DurationField/DurationField";
import { QuantityForm } from "./QuantityForm";

const TITLE_MAX_LENGTH = 18;
const NOTE_MAX_LENGTH = 249;

const WARNING_TOKENS = SAMPLE_TOKENS.filter((t) => t.category === "warning");

/**
 * The "Quantity" field: collapsed to one line (a value with Edit/Remove, or
 * a "+ Quantity" button when unset) - the same `CollapsedField` chrome as
 * `DurationField`'s "+ Time" above it, supplying only its own value
 * display and `QuantityForm`. Unlike `DurationField`'s static aria-labels (a
 * step/token only ever has one time), Edit/Remove stay dynamic (e.g.
 * "Remove 3 kg") since a quantity's actual value is more distinguishing
 * information than "there's a quantity set" - passed via `ariaLabels`. No
 * visible "Quantity" label is shown at all - the same "the button already
 * says what it does" reasoning behind `DurationField`'s `showLabel={false}`
 * - so this passes `showLabel={false}` explicitly. `editing`/`onEditingChange`
 * are controlled by TimeAndQuantityRow below so opening this closes Token
 * time, and vice versa.
 */
function QuantityRow({
  step,
  token,
  editing,
  onEditingChange,
}: {
  step: InstructionStep;
  token: InstructionToken;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
}) {
  return (
    <CollapsedField
      label="Quantity"
      showLabel={false}
      value={token.quantity}
      editing={editing}
      onEditingChange={onEditingChange}
      renderValue={(v) => v.label}
      ariaLabels={
        token.quantity
          ? { edit: `Edit ${token.quantity.label}`, remove: `Remove ${token.quantity.label}` }
          : undefined
      }
      renderForm={(close) => (
        <QuantityForm
          value={token.quantity}
          onSave={(next) => {
            attachToToken(step.id, token.id, "quantity", next);
            close();
          }}
          onCancel={close}
        />
      )}
      onRemove={() => removeTokenAttachment(step.id, token.id, "quantity")}
    />
  );
}

/**
 * Wraps Token time and Quantity in one row and coordinates them so opening
 * either's edit form closes the other's - two testers-requested changes at
 * once: the "+ Quantity" button sits inline next to "+ Time" (a shared flex
 * row, `.token-details__time-quantity-row`, rather than two stacked fields),
 * and only one of the two can be mid-edit at a time. The `openField` state
 * that makes the second part possible has to live above both fields since
 * they used to manage their own `editing` state independently; a normal
 * Save or Cancel in either still closes it the same way it always closed
 * that field's own state, since `onEditingChange` is just where that state
 * now lives. Keyed by `token.id` in TokenDetails below, same reason
 * DurationField/QuantityRow were already individually keyed - so switching
 * tokens can't leave a stale field open or leak one token's in-progress
 * edit into the next.
 */
function TimeAndQuantityRow({ step, token }: { step: InstructionStep; token: InstructionToken }) {
  const [openField, setOpenField] = useState<"time" | "quantity" | null>(null);

  return (
    <div class="token-details__time-quantity-row">
      <DurationField
        label="Time"
        value={token.time}
        onChange={(time) => setTokenTime(step.id, token.id, time)}
        showLabel={false}
        editing={openField === "time"}
        onEditingChange={(next) => setOpenField(next ? "time" : null)}
      />
      <QuantityRow
        step={step}
        token={token}
        editing={openField === "quantity"}
        onEditingChange={(next) => setOpenField(next ? "quantity" : null)}
      />
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
              attachToToken(step.id, token.id, "warning", { iconId: sample.iconId, label: sample.label })
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

/** Copy button's handler - also the keyboard `Ctrl+C` path's shared shape (see app.tsx). */
function handleCopy(step: InstructionStep, token: InstructionToken): void {
  copyToken(step.id, token.id);
  toast.value = { text: `Copied ${token.label ?? token.iconId}`, tone: "info" };
}

/**
 * Editor for the currently selected token - see InstructionCanvas's
 * two-stage select behavior: a token only becomes selectable, and shows up
 * here, once its step is already selected. Mirrors StepDetails: a
 * user-editable title/notes pair.
 *
 * What used to be a separate TokenAttachmentPicker panel ("Add to token",
 * right column) is now two of this panel's own fields: Quantity (sharing
 * DurationField's collapsed/edit-toggle interaction - see QuantityRow) and
 * Warning (the last field, keeping the older always-visible chip+preset-grid
 * look - see WarningRow). There's no longer a shared "Attachments" wrapper
 * around them; each is its own standalone field like Title/Notes. Token time
 * and Quantity specifically sit in one row and are mutually exclusive when
 * editing - see TimeAndQuantityRow. `TimeAndQuantityRow`/`WarningRow` are
 * keyed by `token.id` so switching tokens doesn't leak one token's
 * in-progress edit into the next.
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
    // Matches the canvas's own selected-step highlight (same border color
    // and thickness as `.instruction-canvas__step-bg--selected`) - shown
    // here rather than on StepDetails whenever a token is selected, since
    // this panel only ever renders this branch once one is (see the guard
    // above).
    <div class="token-details token-details--selected">
      <div class="token-details__header">
        <h2 class="token-details__heading">Token details</h2>
        <button
          type="button"
          class="token-details__copy-button"
          title="Copy (Ctrl+C)"
          onClick={() => handleCopy(step, token)}
        >
          Copy
        </button>
      </div>

      <label class="token-details__field">
        <span class="token-details__label">Title</span>
        <input
          type="text"
          value={token.label ?? ""}
          placeholder="e.g. Chop"
          maxLength={TITLE_MAX_LENGTH}
          onInput={(event) => updateTokenLabel(step.id, token.id, event.currentTarget.value)}
        />
      </label>

      <label class="token-details__field">
        <span class="token-details__label">Notes</span>
        <textarea
          value={token.note ?? ""}
          placeholder="Add any extra detail for this token..."
          rows={3}
          maxLength={NOTE_MAX_LENGTH}
          onInput={(event) => updateTokenNote(step.id, token.id, event.currentTarget.value)}
        />
      </label>

      <TimeAndQuantityRow key={token.id} step={step} token={token} />
      <WarningRow key={`warning-${token.id}`} step={step} token={token} />
    </div>
  );
}
