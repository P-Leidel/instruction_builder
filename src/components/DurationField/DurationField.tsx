import { useState } from "preact/hooks";
import type { DurationAttachment } from "../../model/instruction";
import { buildDuration, splitDuration } from "../../lib/duration";

interface DurationFieldProps {
  /** Shown above the control, matching the surrounding panel's field labels (e.g. "Time"). */
  label: string;
  value: DurationAttachment | undefined;
  onChange: (time: DurationAttachment | undefined) => void;
}

const ZERO = { days: 0, hours: 0, minutes: 0, seconds: 0 };

/**
 * Coerces a unit input's raw text to a non-negative number, defaulting to 0
 * for anything that doesn't parse (an empty field, or stray non-digit text -
 * these inputs are `type="text"`, not `type="number"`, so nothing stops a
 * user from typing letters). Out-of-range values (e.g. "90" minutes) are
 * intentionally left alone here and only clamped on Save, by `buildDuration`
 * - same as before this was type="text".
 */
function toFiniteNonNegative(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

/**
 * A "few clicks" day/hour/minute/second duration editor, shared by
 * StepDetails (a step's own time estimate) and TokenDetails (a single
 * token's time) - see InstructionStep.time/InstructionToken.time. Unlike
 * Quantity and Warning (TokenDetails' own fields), Time can apply to a step
 * as well as a token, so it stays its own shared component rather than
 * living only in TokenDetails. TokenDetails' QuantityRow duplicates this
 * component's collapsed/edit-toggle interaction rather than reusing it
 * directly - a four-number duration and a two-field amount+unit form don't
 * share enough shape to be worth a common prop surface.
 *
 * Collapsed to a single line (a value + Edit/Remove, or just a "+ Time"
 * button when unset) so it doesn't dominate the panel - the four inputs
 * only appear while actively editing.
 */
export function DurationField({ label, value, onChange }: DurationFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(ZERO);

  function startEditing() {
    setDraft(value ? splitDuration(value.seconds) : ZERO);
    setEditing(true);
  }

  function save() {
    onChange(buildDuration(draft.days, draft.hours, draft.minutes, draft.seconds));
    setEditing(false);
  }

  const totalIsZero = draft.days === 0 && draft.hours === 0 && draft.minutes === 0 && draft.seconds === 0;

  if (editing) {
    return (
      <div class="duration-field">
        <span class="duration-field__label">{label}</span>
        <div class="duration-field__inputs">
          <label class="duration-field__unit">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={draft.days}
              aria-label="Days"
              onInput={(e) => setDraft({ ...draft, days: toFiniteNonNegative(e.currentTarget.value) })}
              onFocus={(e) => e.currentTarget.select()}
            />
            <span>d</span>
          </label>
          <label class="duration-field__unit">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={draft.hours}
              aria-label="Hours"
              onInput={(e) => setDraft({ ...draft, hours: toFiniteNonNegative(e.currentTarget.value) })}
              onFocus={(e) => e.currentTarget.select()}
            />
            <span>h</span>
          </label>
          <label class="duration-field__unit">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={draft.minutes}
              aria-label="Minutes"
              onInput={(e) => setDraft({ ...draft, minutes: toFiniteNonNegative(e.currentTarget.value) })}
              onFocus={(e) => e.currentTarget.select()}
            />
            <span>m</span>
          </label>
          <label class="duration-field__unit">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={draft.seconds}
              aria-label="Seconds"
              onInput={(e) => setDraft({ ...draft, seconds: toFiniteNonNegative(e.currentTarget.value) })}
              onFocus={(e) => e.currentTarget.select()}
            />
            <span>s</span>
          </label>
        </div>
        <div class="duration-field__actions">
          <button
            type="button"
            class="duration-field__save"
            disabled={totalIsZero}
            aria-label={`Save ${label.toLowerCase()}`}
            onClick={save}
          >
            Save
          </button>
          <button
            type="button"
            class="duration-field__cancel"
            aria-label={`Cancel editing ${label.toLowerCase()}`}
            onClick={() => setEditing(false)}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (value) {
    return (
      <div class="duration-field">
        <span class="duration-field__label">{label}</span>
        <div class="duration-field__display">
          <span class="duration-field__value">{value.label}</span>
          <div class="duration-field__display-actions">
            <button
              type="button"
              class="duration-field__edit"
              aria-label={`Edit ${label.toLowerCase()}`}
              onClick={startEditing}
            >
              Edit
            </button>
            <button
              type="button"
              class="duration-field__remove"
              aria-label={`Remove ${label.toLowerCase()}`}
              onClick={() => onChange(undefined)}
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div class="duration-field">
      <span class="duration-field__label">{label}</span>
      <button
        type="button"
        class="duration-field__add"
        aria-label={`Add ${label.toLowerCase()}`}
        onClick={startEditing}
      >
        + Time
      </button>
    </div>
  );
}
