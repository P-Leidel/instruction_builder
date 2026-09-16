import {
  selectedStep,
  selectedTokenId,
  selectToken,
  updateStepTitle,
  updateStepDescription,
  setStepTime,
} from "../../state/document";
import { Icon } from "../Icon/Icon";
import { DurationField } from "../DurationField/DurationField";

const TITLE_MAX_LENGTH = 50;
const DESCRIPTION_MAX_LENGTH = 249;

/**
 * Editor for the selected step's user-authored title/details, plus a plain
 * list of its tokens (icon + label only - the app-given description per
 * token lives in TokenDetails now, once a token is selected there). Opens
 * the left panel column (the standalone StepList panel that used to sit
 * above it was folded into the canvas itself - see InstructionCanvas.tsx).
 *
 * Task 22: each token in that list is also a button selecting it (this list
 * only renders once a step is already selected, so the canvas's two-stage
 * select rule - a token only selects once its step does - is automatically
 * satisfied). This is the keyboard-operable path to a token's TokenDetails
 * panel; the canvas's own SVG token chips remain pointer/touch-only, same as
 * before - so this list stays even though it no longer shows a description,
 * since it's still the only way a keyboard user can select a token at all.
 */
export function StepDetails() {
  const step = selectedStep.value;

  if (!step) {
    return (
      <div class="step-details">
        <h2 class="step-details__heading">Step details</h2>
        <p class="step-details__empty">Select a step to edit its title and details.</p>
      </div>
    );
  }

  return (
    <div class="step-details">
      <h2 class="step-details__heading">Step details</h2>

      <label class="step-details__field">
        <span class="step-details__label">Title</span>
        <input
          type="text"
          value={step.title ?? ""}
          placeholder="e.g. Chop the onion"
          maxLength={TITLE_MAX_LENGTH}
          onInput={(event) => updateStepTitle(step.id, event.currentTarget.value)}
        />
      </label>

      <label class="step-details__field">
        <span class="step-details__label">Details</span>
        <textarea
          value={step.description ?? ""}
          placeholder="Add any extra detail for this step..."
          rows={3}
          maxLength={DESCRIPTION_MAX_LENGTH}
          onInput={(event) => updateStepDescription(step.id, event.currentTarget.value)}
        />
      </label>

      {/* `key={step.id}` forces a fresh instance per step - without it, Preact
          reuses the same DurationField across a step switch and its
          internal `editing` state (e.g. mid-edit, unsaved) leaks from the
          previously selected step into whichever step is selected now. */}
      <DurationField
        key={step.id}
        label="Step time"
        value={step.time}
        onChange={(time) => setStepTime(step.id, time)}
      />

      <div class="step-details__tokens">
        <span class="step-details__label">Tokens in this step</span>
        {step.tokens.length === 0 ? (
          <p class="step-details__empty">No tokens yet - add some from the panel on the right.</p>
        ) : (
          <ul class="step-details__token-list">
            {step.tokens.map((token) => {
              const isSelected = token.id === selectedTokenId.value;
              return (
                <li key={token.id} class="step-details__token">
                  <button
                    type="button"
                    class={`step-details__token-button${isSelected ? " step-details__token-button--selected" : ""}`}
                    aria-current={isSelected ? "true" : undefined}
                    onClick={() => selectToken(step.id, token.id)}
                  >
                    <Icon iconId={token.iconId} size={18} />
                    <span class="step-details__token-label">{token.label ?? token.iconId}</span>
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
