import { useRef, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { FieldPopover } from "../FieldPopover/FieldPopover";

interface CollapsedFieldAriaLabels {
  add?: string;
  edit?: string;
  remove?: string;
}

interface CollapsedFieldProps<T> {
  /** Shown above the control (when `showLabel`) and as the "+ <label>" add-button text; also the source of the default Add/Edit/Remove aria-labels below. */
  label: string;
  /** Hides the label span (default true) - a caller that pairs this field inline with another self-describing field (TokenDetails' Token time beside Quantity) hides it, the same way `DurationField`'s own `showLabel` used to. */
  showLabel?: boolean;
  value: T | undefined;
  /** Renders the collapsed display for an already-set value (e.g. a duration's "1h 30m" label). */
  renderValue: (value: T) => ComponentChildren;
  /**
   * Renders this field's edit form inside the popover - called only while
   * `editing` is true, so a caller's form component (DurationForm,
   * QuantityForm) mounts fresh on every open and unmounts on every close.
   * That remount is what re-seeds a plain `useState(() => ...)` draft
   * initializer from the current `value` on each open, the same
   * remount-to-reset idiom this codebase already uses elsewhere
   * (`key={token.id}`) - so this field needs no `onOpen` hook to do it.
   * Receives `close`, which the form calls after a Save or Cancel commits
   * (or discards) its own draft.
   */
  renderForm: (close: () => void) => ComponentChildren;
  /** Clears the value entirely - the collapsed display's own "Remove" button, separate from anything the edit form's Save/Cancel can do. */
  onRemove: () => void;
  /** Controlled open/closed state, for a parent coordinating this field with a sibling (see TokenDetails' TimeAndQuantityRow). Omit to fall back to self-managed state. */
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
  /**
   * Overrides the default `Add/Edit/Remove ${label.toLowerCase()}` aria-labels.
   * DurationField never needs this - a step/token only ever has one time, so
   * the static default is already distinguishing enough. QuantityRow opts
   * into `remove`/`edit` because a quantity's actual value ("3 kg") is more
   * useful to a screen reader than "there's a quantity set".
   */
  ariaLabels?: CollapsedFieldAriaLabels;
}

/**
 * The collapsed/edit-toggle chrome shared by every "few clicks" value field
 * in this app - a "+ <label>" button when unset, or a value with Edit/Remove
 * once set, with the actual edit form floating in a `FieldPopover` rather
 * than expanding in place (see FieldPopover's own doc comment for why:
 * a field's own footprint must never change just because its form opened,
 * or a sibling field next to it - Token time beside Quantity - gets shoved
 * around). `DurationField` and TokenDetails' `QuantityRow` used to each
 * hand-roll this identical add/display/edit/remove/popover-anchor structure
 * around their own, genuinely different, edit forms (four d/h/m/s inputs vs.
 * an amount+unit pair) - this extracts the chrome once and takes the form
 * itself as a render prop, so each caller supplies only what's actually
 * different: how a value displays, and its own small form component.
 */
export function CollapsedField<T>({
  label,
  showLabel = true,
  value,
  renderValue,
  renderForm,
  onRemove,
  editing: controlledEditing,
  onEditingChange,
  ariaLabels,
}: CollapsedFieldProps<T>) {
  const [uncontrolledEditing, setUncontrolledEditing] = useState(false);
  const editing = controlledEditing ?? uncontrolledEditing;
  const triggerRef = useRef<HTMLButtonElement>(null);

  function setEditing(next: boolean) {
    setUncontrolledEditing(next);
    onEditingChange?.(next);
  }

  const close = () => setEditing(false);
  const lowerLabel = label.toLowerCase();
  const popover = editing && (
    <FieldPopover anchorRef={triggerRef} onClose={close} ariaLabel={label}>
      {renderForm(close)}
    </FieldPopover>
  );

  if (value) {
    return (
      <div class="collapsed-field">
        {showLabel && <span class="collapsed-field__label">{label}</span>}
        <div class="collapsed-field__display">
          <span class="collapsed-field__value">{renderValue(value)}</span>
          <div class="collapsed-field__display-actions">
            <span class="field-popover-anchor">
              <button
                ref={triggerRef}
                type="button"
                class="collapsed-field__edit"
                aria-haspopup="dialog"
                aria-expanded={editing}
                aria-label={ariaLabels?.edit ?? `Edit ${lowerLabel}`}
                onClick={() => setEditing(true)}
              >
                Edit
              </button>
              {popover}
            </span>
            <button
              type="button"
              class="collapsed-field__remove"
              aria-label={ariaLabels?.remove ?? `Remove ${lowerLabel}`}
              onClick={onRemove}
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div class="collapsed-field">
      {showLabel && <span class="collapsed-field__label">{label}</span>}
      <span class="field-popover-anchor">
        <button
          ref={triggerRef}
          type="button"
          class="collapsed-field__add"
          aria-haspopup="dialog"
          aria-expanded={editing}
          aria-label={ariaLabels?.add ?? `Add ${lowerLabel}`}
          onClick={() => setEditing(true)}
        >
          + {label}
        </button>
        {popover}
      </span>
    </div>
  );
}
