import type { DurationAttachment } from "../../model/instruction";
import { CollapsedField } from "../CollapsedField/CollapsedField";
import { DurationForm } from "./DurationForm";

interface DurationFieldProps {
  /** Shown above the control, matching the surrounding panel's field labels (e.g. "Time"). */
  label: string;
  value: DurationAttachment | undefined;
  onChange: (time: DurationAttachment | undefined) => void;
  /** Hides the label span (default true) - TokenDetails hides it since its "+ Time"/value/Edit/Remove buttons already say what the field is; StepDetails still shows "Step time" since it isn't paired inline with another field the way Token time is with Quantity. */
  showLabel?: boolean;
  /** Controlled open/closed state, for a parent that needs to coordinate this field with a sibling (TokenDetails' Token time vs. Quantity - see TimeAndQuantityRow). Omit to fall back to self-managed state, as StepDetails does. */
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
}

/**
 * A "few clicks" day/hour/minute/second duration editor, shared by
 * StepDetails (a step's own time estimate) and TokenDetails (a single
 * token's time) - see InstructionStep.time/InstructionToken.time. Unlike
 * Quantity and Warning (TokenDetails' own fields), Time can apply to a step
 * as well as a token, so it stays its own shared component rather than
 * living only in TokenDetails. The collapsed/edit-toggle chrome (the
 * "+ Time" button, the value+Edit/Remove display, the popover) lives in
 * `CollapsedField`, shared with TokenDetails' `QuantityRow` - this component
 * now only supplies the value's display and its own `DurationForm`.
 */
export function DurationField({
  label,
  value,
  onChange,
  showLabel = true,
  editing,
  onEditingChange,
}: DurationFieldProps) {
  return (
    <CollapsedField
      label={label}
      showLabel={showLabel}
      value={value}
      editing={editing}
      onEditingChange={onEditingChange}
      renderValue={(v) => v.label}
      renderForm={(close) => (
        <DurationForm
          label={label}
          value={value}
          onSave={(next) => {
            onChange(next);
            close();
          }}
          onCancel={close}
        />
      )}
      onRemove={() => onChange(undefined)}
    />
  );
}
