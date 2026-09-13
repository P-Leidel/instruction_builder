import { signal, computed } from "@preact/signals";
import {
  createEmptyDocument,
  createEmptyStep,
  type InstructionDocument,
  type InstructionToken,
  type TokenAttachment,
  type DurationAttachment,
} from "../model/instruction";

/**
 * The two generic attachment kinds a token can carry via TokenAttachmentPicker
 * - see TokenAttachment. Time is deliberately not one of these: it has its
 * own dedicated shape (DurationAttachment), its own input UI (DurationField,
 * not the picker), and can attach to a step as well as a token - see
 * setTokenTime/setStepTime below.
 */
export type AttachmentKind = "quantity" | "warning";

/**
 * All mutable app state lives in signals rather than component state, so the
 * step list, step builder, and (from Phase 2 onward) the canvas stay in sync
 * without prop-drilling. Phase 1 holds this in memory only — no persistence,
 * no undo — matching the Phase 1 scope in docs/phase-1/Architecture.md.
 *
 * Note: the `document` signal below intentionally shadows the DOM's global
 * `document`. No file in src/ needs both in the same scope today, but if one
 * ever does, import this one under an alias (e.g. `import { document as doc }`).
 */
export const document = signal<InstructionDocument>(createEmptyDocument());
export const selectedStepId = signal<string | null>(
  document.value.steps[0]?.id ?? null,
);
/**
 * A token is only ever considered "selected" alongside its (also-selected)
 * step - see InstructionCanvas's two-stage click behavior: the first click
 * on a step selects the step, and only a further click on one of its tokens
 * selects that token. Always go through selectStep/selectToken below rather
 * than assigning these two signals directly, so they can't drift out of sync
 * (e.g. a token staying "selected" after its step is deselected).
 */
export const selectedTokenId = signal<string | null>(null);

/**
 * Task 13 (Undo/Redo): `past`/`future` hold whole prior/subsequent document
 * snapshots rather than individual diffs - the document is small enough
 * (a handful of steps/tokens) that snapshotting is simpler and safer than a
 * command/diff log, and every mutator below already produces a fresh
 * immutable `InstructionDocument` via `setSteps`, so a snapshot is just
 * "the value `document` held right before this change."
 */
const MAX_HISTORY = 100;
export const past = signal<InstructionDocument[]>([]);
export const future = signal<InstructionDocument[]>([]);
export const canUndo = computed(() => past.value.length > 0);
export const canRedo = computed(() => future.value.length > 0);

/**
 * Free-text fields (step/token title and notes) call their mutator on every
 * keystroke (see StepDetails/TokenDetails - no local draft state, unlike
 * DurationField/QuantityForm), so recording history on every call would
 * make undo revert one character at a time. Mutators for those fields pass
 * `coalesce: true` to `setSteps`, which merges a run of calls arriving
 * within `COALESCE_WINDOW_MS` of each other into the single history entry
 * already pushed for the first one - so a whole burst of typing (even
 * across a mid-burst field/token switch, a deliberate simplification) undoes
 * in one step, and only a pause longer than the window starts a new one.
 * Every other mutator (add/remove/move/attach/etc.) always pushes its own
 * entry, since each already represents one discrete user action.
 */
const COALESCE_WINDOW_MS = 700;
let lastPushWasCoalesce = false;
let lastPushAt = 0;

function recordHistory(coalesce: boolean): void {
  const now = Date.now();
  const withinCoalesceWindow = coalesce && lastPushWasCoalesce && now - lastPushAt < COALESCE_WINDOW_MS;
  if (!withinCoalesceWindow) {
    const next = [...past.value, document.value];
    past.value = next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
    future.value = [];
  }
  lastPushWasCoalesce = coalesce;
  lastPushAt = now;
}

/**
 * Restores a history snapshot as the live document, re-resolving selection
 * against it rather than assigning `selectedStepId`/`selectedTokenId`
 * directly via `selectStep`/`selectToken` (see the note on those above) -
 * this is the one place that deliberately deviates, because undo/redo
 * should keep the current selection alive across a change that didn't
 * touch it (e.g. undoing an edit to a *different* step) instead of always
 * resetting to "no token selected" the way every other mutation does.
 */
function restoreDocument(doc: InstructionDocument): void {
  document.value = { ...doc, meta: { ...doc.meta, updatedAt: new Date().toISOString() } };
  const stepId = doc.steps.some((s) => s.id === selectedStepId.value)
    ? selectedStepId.value
    : doc.steps[0]?.id ?? null;
  selectedStepId.value = stepId;
  const step = doc.steps.find((s) => s.id === stepId);
  selectedTokenId.value = step?.tokens.some((t) => t.id === selectedTokenId.value)
    ? selectedTokenId.value
    : null;
}

/** Reverts the most recent change (or coalesced run of changes) - a no-op if there's nothing to undo. */
export function undo(): void {
  if (past.value.length === 0) return;
  const previous = past.value[past.value.length - 1];
  past.value = past.value.slice(0, -1);
  future.value = [document.value, ...future.value];
  lastPushWasCoalesce = false;
  restoreDocument(previous);
}

/** Reapplies the most recently undone change - a no-op if there's nothing to redo. */
export function redo(): void {
  if (future.value.length === 0) return;
  const next = future.value[0];
  future.value = future.value.slice(1);
  past.value = [...past.value, document.value];
  lastPushWasCoalesce = false;
  restoreDocument(next);
}

/**
 * Replaces the entire document - the Import flow (task 19). Unlike
 * `setSteps` (which only ever replaces `steps` on the existing document),
 * this swaps `meta`/`schemaVersion` too, since an imported file brings its
 * own. Still goes through `recordHistory` like every other mutation, so an
 * accidental import is one `undo()` away from being reverted.
 */
export function replaceDocument(doc: InstructionDocument): void {
  recordHistory(false);
  document.value = { ...doc, meta: { ...doc.meta, updatedAt: new Date().toISOString() } };
  selectStep(doc.steps[0]?.id ?? null);
}

export const selectedStep = computed(
  () => document.value.steps.find((s) => s.id === selectedStepId.value) ?? null,
);

export const selectedToken = computed(
  () => selectedStep.value?.tokens.find((t) => t.id === selectedTokenId.value) ?? null,
);

export function selectStep(stepId: string | null): void {
  selectedStepId.value = stepId;
  selectedTokenId.value = null;
}

export function selectToken(stepId: string, tokenId: string): void {
  selectedStepId.value = stepId;
  selectedTokenId.value = tokenId;
}

/**
 * Applies a steps update to the document and refreshes `meta.updatedAt`.
 * Every mutator below goes through this so "last edited" stays accurate
 * once Phase 2 persistence/export starts reading it, and so undo/redo
 * history (see `recordHistory` above) only needs one funnel point to watch.
 * `coalesce: true` marks the change as part of a continuous edit (free-text
 * typing) that should merge into the last history entry instead of pushing
 * its own - see the comment on `COALESCE_WINDOW_MS`.
 */
function setSteps(steps: InstructionDocument["steps"], options?: { coalesce?: boolean }): void {
  recordHistory(options?.coalesce ?? false);
  document.value = {
    ...document.value,
    steps,
    meta: { ...document.value.meta, updatedAt: new Date().toISOString() },
  };
}

export function addStep(): void {
  const step = createEmptyStep();
  setSteps([...document.value.steps, step]);
  selectStep(step.id);
}

export function removeStep(stepId: string): void {
  const steps = document.value.steps.filter((s) => s.id !== stepId);
  setSteps(steps);
  if (selectedStepId.value === stepId) {
    selectStep(steps[0]?.id ?? null);
  }
}

/** Inserts `token` at `index` (clamped), or appends it when `index` is omitted. */
function insertToken(
  tokens: InstructionToken[],
  token: InstructionToken,
  index?: number,
): InstructionToken[] {
  if (index === undefined) return [...tokens, token];
  const clamped = Math.max(0, Math.min(index, tokens.length));
  return [...tokens.slice(0, clamped), token, ...tokens.slice(clamped)];
}

/** Adds a token to a specific step - the drag-and-drop drop target (task 9). */
export function addTokenToStep(stepId: string, token: InstructionToken, index?: number): void {
  setSteps(
    document.value.steps.map((step) =>
      step.id === stepId ? { ...step, tokens: insertToken(step.tokens, token, index) } : step,
    ),
  );
}

/** Adds a token to whichever step is selected - the tap-to-insert path (task 11). */
export function addTokenToSelectedStep(token: InstructionToken): void {
  const stepId = selectedStepId.value;
  if (!stepId) return;
  addTokenToStep(stepId, token);
}

/**
 * Moves an existing token to `index` within `toStepId`, removing it from
 * `fromStepId` first - covers both reordering within a step (fromStepId ===
 * toStepId) and moving between steps, via a drag on the canvas (task 9).
 */
export function moveToken(
  fromStepId: string,
  tokenId: string,
  toStepId: string,
  index: number,
): void {
  const fromStep = document.value.steps.find((s) => s.id === fromStepId);
  const token = fromStep?.tokens.find((t) => t.id === tokenId);
  if (!token) return;

  setSteps(
    document.value.steps.map((step) => {
      if (step.id === fromStepId && step.id === toStepId) {
        const fromIndex = step.tokens.findIndex((t) => t.id === tokenId);
        const withoutToken = step.tokens.filter((t) => t.id !== tokenId);
        // `index` is a drop-before position in the pre-removal array (see
        // resolveTokenDropTarget); removing the dragged token first shifts
        // everything after it back by one, so a forward move must adjust
        // the target index down by one to land where the user dropped it.
        const adjustedIndex = fromIndex !== -1 && fromIndex < index ? index - 1 : index;
        return { ...step, tokens: insertToken(withoutToken, token, adjustedIndex) };
      }
      if (step.id === fromStepId) {
        return { ...step, tokens: step.tokens.filter((t) => t.id !== tokenId) };
      }
      if (step.id === toStepId) {
        return { ...step, tokens: insertToken(step.tokens, token, index) };
      }
      return step;
    }),
  );
}

/** Moves a step from `fromIndex` to `toIndex` - dragging a step in StepList (task 9). */
export function reorderSteps(fromIndex: number, toIndex: number): void {
  const steps = [...document.value.steps];
  if (fromIndex < 0 || fromIndex >= steps.length) return;
  const [moved] = steps.splice(fromIndex, 1);
  // `toIndex` is a drop-before position in the pre-removal array (see
  // resolveDropIndex); adjust down by one for a forward move since removing
  // `moved` already shifted everything after it back by one.
  const adjustedToIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
  const clamped = Math.max(0, Math.min(adjustedToIndex, steps.length));
  steps.splice(clamped, 0, moved);
  setSteps(steps);
}

export function removeTokenFromStep(stepId: string, tokenId: string): void {
  setSteps(
    document.value.steps.map((step) =>
      step.id === stepId
        ? { ...step, tokens: step.tokens.filter((t) => t.id !== tokenId) }
        : step,
    ),
  );
  if (selectedTokenId.value === tokenId) {
    selectedTokenId.value = null;
  }
}

export function updateStepTitle(stepId: string, title: string): void {
  setSteps(
    document.value.steps.map((step) => (step.id === stepId ? { ...step, title } : step)),
    { coalesce: true },
  );
}

export function updateStepDescription(stepId: string, description: string): void {
  setSteps(
    document.value.steps.map((step) =>
      step.id === stepId ? { ...step, description } : step,
    ),
    { coalesce: true },
  );
}

export function updateTokenLabel(stepId: string, tokenId: string, label: string): void {
  setSteps(
    document.value.steps.map((step) =>
      step.id === stepId
        ? { ...step, tokens: step.tokens.map((t) => (t.id === tokenId ? { ...t, label } : t)) }
        : step,
    ),
    { coalesce: true },
  );
}

export function updateTokenNote(stepId: string, tokenId: string, note: string): void {
  setSteps(
    document.value.steps.map((step) =>
      step.id === stepId
        ? { ...step, tokens: step.tokens.map((t) => (t.id === tokenId ? { ...t, note } : t)) }
        : step,
    ),
    { coalesce: true },
  );
}

/**
 * Sets or clears one attachment kind on a token - at most one of each kind
 * at a time, so setting one where a value already exists replaces it,
 * rather than the token accumulating several of the same kind.
 */
function setTokenAttachment(
  stepId: string,
  tokenId: string,
  kind: AttachmentKind,
  attachment: TokenAttachment | undefined,
): void {
  setSteps(
    document.value.steps.map((step) =>
      step.id === stepId
        ? {
            ...step,
            tokens: step.tokens.map((t) => (t.id === tokenId ? { ...t, [kind]: attachment } : t)),
          }
        : step,
    ),
  );
}

/** Attaches `attachment` to a specific token - TokenAttachmentPicker's click-to-attach path. */
export function attachToToken(
  stepId: string,
  tokenId: string,
  kind: AttachmentKind,
  attachment: TokenAttachment,
): void {
  setTokenAttachment(stepId, tokenId, kind, attachment);
}

/** Attaches to whichever token is currently selected; a no-op if none is. */
export function attachToSelectedToken(kind: AttachmentKind, attachment: TokenAttachment): void {
  const stepId = selectedStepId.value;
  const tokenId = selectedTokenId.value;
  if (!stepId || !tokenId) return;
  attachToToken(stepId, tokenId, kind, attachment);
}

export function removeTokenAttachment(stepId: string, tokenId: string, kind: AttachmentKind): void {
  setTokenAttachment(stepId, tokenId, kind, undefined);
}

/** Sets or clears a specific token's own duration - see InstructionToken.time. */
export function setTokenTime(
  stepId: string,
  tokenId: string,
  time: DurationAttachment | undefined,
): void {
  setSteps(
    document.value.steps.map((step) =>
      step.id === stepId
        ? { ...step, tokens: step.tokens.map((t) => (t.id === tokenId ? { ...t, time } : t)) }
        : step,
    ),
  );
}

/** Sets or clears a step's own duration estimate - see InstructionStep.time. */
export function setStepTime(stepId: string, time: DurationAttachment | undefined): void {
  setSteps(document.value.steps.map((step) => (step.id === stepId ? { ...step, time } : step)));
}
