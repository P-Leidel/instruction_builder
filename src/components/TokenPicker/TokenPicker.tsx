import type { TokenCategory } from "../../model/instruction";
import { createToken } from "../../model/instruction";
import { addTokenToSelectedStep, addTokenToStep } from "../../state/document";
import { dragGhost, dropTarget } from "../../state/drag";
import { activeTokenCategory } from "../../state/ui";
import { beginPointerDrag, resolveTokenDropTarget, createClickAfterDragGuard } from "../../lib/pointer-drag";
import { SAMPLE_TOKENS, CATEGORY_LABELS, type SampleToken } from "../../data/sample-tokens";
import { Icon } from "../Icon/Icon";

// Quantity, Warning, and Time are attached *to* a token instead - see
// TokenAttachmentPicker's "Add to token" menu - so they're excluded here
// even though sample-tokens.ts still lists them.
const STEP_TOKEN_CATEGORIES: TokenCategory[] = ["action", "object", "tool"];

const CATEGORIES_WITH_SAMPLES = STEP_TOKEN_CATEGORIES.filter((category) =>
  SAMPLE_TOKENS.some((t) => t.category === category),
);

// Suppresses the browser's compatibility `click` event (fired right after
// pointerup, needed for keyboard/simple-tap activation) from also adding a
// second token via the old click behavior once a real drag has happened.
const dragGuard = createClickAfterDragGuard();

/**
 * Token vocabulary, offered two ways: tap a button to add it to the
 * currently selected step (task 11, unchanged since Phase 1), or drag it
 * onto any step directly on the canvas (task 9) - dragging doesn't require
 * a step to be pre-selected, since the drop target says where it goes. Both
 * share one Pointer Events code path, which is what makes touch input
 * (task 10) work without a separate implementation.
 *
 * As the vocabulary grows past a handful of icons per category, showing
 * every category's grid at once (the original fieldset/legend layout)
 * stops scaling - so categories are tabs instead: one active category's
 * grid is rendered at a time, switching is a plain click, and every
 * existing token button (click-to-add, drag-to-drop) is unaffected by
 * which tab is active, since it's the exact same button in a smaller list.
 */
export function TokenPicker() {
  const active = activeTokenCategory.value ?? CATEGORIES_WITH_SAMPLES[0];
  const tokensInCategory = SAMPLE_TOKENS.filter((t) => t.category === active);

  return (
    <div class="token-picker">
      <h2 class="token-picker__heading">Add to step</h2>
      <div class="token-picker__tabs" role="tablist" aria-label="Token category">
        {CATEGORIES_WITH_SAMPLES.map((category) => (
          <button
            type="button"
            key={category}
            role="tab"
            aria-selected={category === active}
            aria-controls="token-picker-panel"
            class={`token-picker__tab${category === active ? " token-picker__tab--active" : ""}`}
            onClick={() => (activeTokenCategory.value = category)}
          >
            {CATEGORY_LABELS[category]}
          </button>
        ))}
      </div>
      <div class="token-picker__grid" role="tabpanel" id="token-picker-panel">
        {tokensInCategory.map((sample: SampleToken) => (
          <button
            type="button"
            key={sample.iconId}
            class="token-picker__button"
            onClick={() => {
              if (dragGuard.wasJustDragged()) return;
              addTokenToSelectedStep(createToken(sample.category, sample.iconId, sample.label));
            }}
            onPointerDown={(event) => {
              beginPointerDrag(event, {
                onMove: (x, y) => {
                  dragGhost.value = { label: sample.label, x, y };
                  dropTarget.value = resolveTokenDropTarget(x, y);
                },
                onDrop: (x, y, wasDrag) => {
                  dragGhost.value = null;
                  dropTarget.value = null;
                  if (!wasDrag) return;
                  dragGuard.markDragged();
                  const target = resolveTokenDropTarget(x, y);
                  if (target) {
                    addTokenToStep(
                      target.stepId,
                      createToken(sample.category, sample.iconId, sample.label),
                      target.index,
                    );
                  }
                },
              });
            }}
          >
            <Icon iconId={sample.iconId} size={22} />
            <span class="token-picker__label">{sample.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
