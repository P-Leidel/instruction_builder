import { useState } from "preact/hooks";
import type { DurationAttachment } from "../../model/instruction";
import { buildDuration, splitDuration } from "../../lib/duration";

interface DurationFormProps {
  /** Only used to phrase the Save/Cancel aria-labels (e.g. "Save time") - matches the field's own label. */
  label: string;
  value: DurationAttachment | undefined;
  onSave: (next: DurationAttachment) => void;
  onCancel: () => void;
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
 * The day/hour/minute/second edit form for `DurationField`'s Token/Step
 * time, rendered by `CollapsedField`'s `renderForm` only while its popover
 * is open - mounting fresh on every open (see `CollapsedField`'s own doc
 * comment) is what lets the `useState(() => ...)` draft below re-seed from
 * the current `value` on every open without an explicit reset hook.
 */
export function DurationForm({ label, value, onSave, onCancel }: DurationFormProps) {
  const [draft, setDraft] = useState(() => (value ? splitDuration(value.seconds) : ZERO));
  const totalIsZero = draft.days === 0 && draft.hours === 0 && draft.minutes === 0 && draft.seconds === 0;

  function save() {
    const built = buildDuration(draft.days, draft.hours, draft.minutes, draft.seconds);
    if (!built) return;
    onSave(built);
  }

  return (
    <>
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
          class="collapsed-field__save"
          disabled={totalIsZero}
          aria-label={`Save ${label.toLowerCase()}`}
          onClick={save}
        >
          Save
        </button>
        <button
          type="button"
          class="collapsed-field__cancel"
          aria-label={`Cancel editing ${label.toLowerCase()}`}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </>
  );
}
