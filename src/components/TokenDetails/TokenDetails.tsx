import {
  selectedStep,
  selectedToken,
  updateTokenLabel,
  updateTokenNote,
  removeTokenAttachment,
  setTokenTime,
  type AttachmentKind,
} from "../../state/document";
import { CATEGORY_LABELS, descriptionFor } from "../../data/sample-tokens";
import { Icon } from "../Icon/Icon";
import { DurationField } from "../DurationField/DurationField";

const ATTACHMENT_KINDS: AttachmentKind[] = ["warning", "quantity"];

/**
 * Editor for the currently selected token - see InstructionCanvas's
 * two-stage select behavior: a token only becomes selectable, and shows up
 * here, once its step is already selected. Mirrors StepDetails: a
 * user-editable title/notes pair, plus the read-only app-given description
 * from sample-tokens.ts.
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

      <div class="token-details__attachments">
        <span class="token-details__label">Attached</span>
        {ATTACHMENT_KINDS.every((kind) => !token[kind]) ? (
          <p class="token-details__empty">
            None yet - add one from "Add to token" on the right.
          </p>
        ) : (
          <ul class="token-details__attachment-list">
            {ATTACHMENT_KINDS.filter((kind) => token[kind]).map((kind) => {
              const attachment = token[kind]!;
              return (
                <li key={kind} class="token-details__attachment">
                  <Icon iconId={attachment.iconId} size={16} />
                  <span class="token-details__attachment-label">
                    {attachment.label ?? CATEGORY_LABELS[kind]}
                  </span>
                  <button
                    type="button"
                    class="token-details__attachment-remove"
                    aria-label={`Remove ${attachment.label ?? CATEGORY_LABELS[kind]}`}
                    onClick={() => removeTokenAttachment(step.id, token.id, kind)}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
