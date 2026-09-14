import { useRef } from "preact/hooks";
import {
  document,
  selectedStepId,
  selectStep,
  addStep,
  removeStep,
  reorderSteps,
  moveStepUp,
  moveStepDown,
} from "../../state/document";
import { validateStep } from "../../model/validate";
import { dragGhost } from "../../state/drag";
import { beginPointerDrag, createClickAfterDragGuard } from "../../lib/pointer-drag";

const dragGuard = createClickAfterDragGuard();

/** Finds the index a step dropped at clientY should land at, among `[data-step-index]` items. */
function resolveDropIndex(clientY: number, container: HTMLElement): number {
  const items = Array.from(container.querySelectorAll<HTMLElement>("[data-step-index]"));
  for (const item of items) {
    const rect = item.getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) {
      return Number(item.getAttribute("data-step-index"));
    }
  }
  return items.length;
}

/**
 * Lists all steps in the document and lets the user select/add/remove/
 * reorder one. Reordering (task 9) is a drag on the step button itself,
 * sharing the same Pointer Events tracker as the canvas/picker; a quick tap
 * (no real movement) still just selects the step, same as Phase 1. Task 22
 * adds Move up/down buttons as the keyboard-operable alternative to that
 * drag, via `moveStepUp`/`moveStepDown` (state/document.ts) - unlike the
 * drag handler below, these buttons never have to reason about
 * `reorderSteps`'s own pre-removal splice-index convention themselves.
 */
export function StepList() {
  const steps = document.value.steps;
  const listRef = useRef<HTMLOListElement>(null);

  return (
    <div class="step-list">
      <h2 class="step-list__heading">Steps</h2>
      <ol class="step-list__items" ref={listRef}>
        {steps.map((step, index) => {
          const result = validateStep(step);
          const isSelected = step.id === selectedStepId.value;
          const issuesId = `step-issues-${step.id}`;
          return (
            <li key={step.id} data-step-index={index}>
              <button
                type="button"
                class={`step-list__item${isSelected ? " step-list__item--selected" : ""}`}
                aria-current={isSelected ? "step" : undefined}
                aria-describedby={!result.isComplete ? issuesId : undefined}
                onClick={() => {
                  if (dragGuard.wasJustDragged()) return;
                  selectStep(step.id);
                }}
                onPointerDown={(event) => {
                  beginPointerDrag(event, {
                    onMove: (x, y) => {
                      dragGhost.value = { label: step.title || "Untitled step", x, y };
                    },
                    onDrop: (_x, y, wasDrag) => {
                      dragGhost.value = null;
                      if (!wasDrag || !listRef.current) return;
                      dragGuard.markDragged();
                      reorderSteps(index, resolveDropIndex(y, listRef.current));
                    },
                  });
                }}
              >
                <span class="step-list__number">{index + 1}</span>
                <span class="step-list__summary">{step.title || "Untitled step"}</span>
                {!result.isComplete && (
                  <span class="step-list__flag" aria-hidden="true" title={result.issues.join(", ")}>
                    !
                  </span>
                )}
                {!result.isComplete && (
                  <span id={issuesId} class="visually-hidden">
                    {result.issues.join(", ")}
                  </span>
                )}
              </button>
              {steps.length > 1 && (
                <div class="step-list__reorder">
                  <button
                    type="button"
                    class="step-list__move"
                    aria-label={`Move step ${index + 1} up`}
                    disabled={index === 0}
                    onClick={() => moveStepUp(step.id)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    class="step-list__move"
                    aria-label={`Move step ${index + 1} down`}
                    disabled={index === steps.length - 1}
                    onClick={() => moveStepDown(step.id)}
                  >
                    ↓
                  </button>
                </div>
              )}
              {steps.length > 1 && (
                <button
                  type="button"
                  class="step-list__remove"
                  aria-label={`Remove step ${index + 1}`}
                  onClick={() => removeStep(step.id)}
                >
                  ×
                </button>
              )}
            </li>
          );
        })}
      </ol>
      <button type="button" class="step-list__add" onClick={addStep}>
        + Add step
      </button>
    </div>
  );
}
