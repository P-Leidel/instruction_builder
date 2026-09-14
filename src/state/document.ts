import { signal, computed, type Signal, type ReadonlySignal } from "@preact/signals";
import {
  createEmptyDocument,
  createEmptyStep,
  type InstructionDocument,
  type InstructionStep,
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

const MAX_HISTORY = 100;
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

/**
 * A document session is a whole editable document plus its undo/redo history
 * and selection - everything one instance of the app has open at a time.
 * `createDocumentSession` is the module's seam: the app runs on exactly one
 * session (the module-level default below, preserved for every existing
 * caller), but a test - or a future second, embedded instance of the app -
 * can construct its own, independent of the browser's single JS realm. See
 * CONTEXT.md for this term and docs/known-issues.md for the module-level-
 * singleton design debt this replaces.
 *
 * The `_lastPushWasCoalesce`/`_lastPushAt` fields are the coalescing clock
 * (see `COALESCE_WINDOW_MS` above) - mutable bookkeeping private to
 * `recordHistory`, carried on the session object itself (rather than as a
 * closure variable) so every session gets its own clock instead of sharing
 * one across instances.
 */
export interface DocumentSession {
  readonly document: Signal<InstructionDocument>;
  /**
   * A token is only ever considered "selected" alongside its (also-selected)
   * step - see InstructionCanvas's two-stage click behavior: the first click
   * on a step selects the step, and only a further click on one of its
   * tokens selects that token. Always go through selectStep/selectToken
   * rather than assigning these two signals directly, so they can't drift
   * out of sync (e.g. a token staying "selected" after its step is
   * deselected).
   */
  readonly selectedStepId: Signal<string | null>;
  readonly selectedTokenId: Signal<string | null>;
  /**
   * Task 13 (Undo/Redo): `past`/`future` hold whole prior/subsequent document
   * snapshots rather than individual diffs - the document is small enough
   * (a handful of steps/tokens) that snapshotting is simpler and safer than a
   * command/diff log, and every mutator already produces a fresh immutable
   * `InstructionDocument` via `setSteps`, so a snapshot is just "the value
   * `document` held right before this change."
   */
  readonly past: Signal<InstructionDocument[]>;
  readonly future: Signal<InstructionDocument[]>;
  readonly canUndo: ReadonlySignal<boolean>;
  readonly canRedo: ReadonlySignal<boolean>;
  readonly selectedStep: ReadonlySignal<InstructionStep | null>;
  readonly selectedToken: ReadonlySignal<InstructionToken | null>;
  /** @internal coalescing clock - only recordHistory reads/writes these. */
  _lastPushWasCoalesce: boolean;
  _lastPushAt: number;
}

/**
 * Constructs a fresh, independent document session - all mutable app state
 * lives in signals rather than component state, so the step list, step
 * builder, and canvas stay in sync without prop-drilling, but nothing here
 * is bound to a module-level global: two sessions never share a signal.
 */
export function createDocumentSession(
  initial: InstructionDocument = createEmptyDocument(),
): DocumentSession {
  const documentSignal = signal<InstructionDocument>(initial);
  const selectedStepId = signal<string | null>(initial.steps[0]?.id ?? null);
  const selectedTokenId = signal<string | null>(null);
  const past = signal<InstructionDocument[]>([]);
  const future = signal<InstructionDocument[]>([]);
  const canUndo = computed(() => past.value.length > 0);
  const canRedo = computed(() => future.value.length > 0);
  const selectedStep = computed(
    () => documentSignal.value.steps.find((s) => s.id === selectedStepId.value) ?? null,
  );
  const selectedToken = computed(
    () => selectedStep.value?.tokens.find((t) => t.id === selectedTokenId.value) ?? null,
  );

  return {
    document: documentSignal,
    selectedStepId,
    selectedTokenId,
    past,
    future,
    canUndo,
    canRedo,
    selectedStep,
    selectedToken,
    _lastPushWasCoalesce: false,
    _lastPushAt: 0,
  };
}

function recordHistory(session: DocumentSession, coalesce: boolean): void {
  const now = Date.now();
  const withinCoalesceWindow =
    coalesce && session._lastPushWasCoalesce && now - session._lastPushAt < COALESCE_WINDOW_MS;
  if (!withinCoalesceWindow) {
    const next = [...session.past.value, session.document.value];
    session.past.value = next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
    session.future.value = [];
  }
  session._lastPushWasCoalesce = coalesce;
  session._lastPushAt = now;
}

/**
 * Restores a history snapshot as the live document, re-resolving selection
 * against it rather than assigning `selectedStepId`/`selectedTokenId`
 * directly via `selectStepCore`/`selectTokenCore` (see the note on those
 * below) - this is the one place that deliberately deviates, because
 * undo/redo should keep the current selection alive across a change that
 * didn't touch it (e.g. undoing an edit to a *different* step) instead of
 * always resetting to "no token selected" the way every other mutation does.
 */
function restoreDocument(session: DocumentSession, doc: InstructionDocument): void {
  session.document.value = { ...doc, meta: { ...doc.meta, updatedAt: new Date().toISOString() } };
  const stepId = doc.steps.some((s) => s.id === session.selectedStepId.value)
    ? session.selectedStepId.value
    : doc.steps[0]?.id ?? null;
  session.selectedStepId.value = stepId;
  const step = doc.steps.find((s) => s.id === stepId);
  session.selectedTokenId.value = step?.tokens.some((t) => t.id === session.selectedTokenId.value)
    ? session.selectedTokenId.value
    : null;
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
function setSteps(
  session: DocumentSession,
  steps: InstructionDocument["steps"],
  options?: { coalesce?: boolean },
): void {
  recordHistory(session, options?.coalesce ?? false);
  session.document.value = {
    ...session.document.value,
    steps,
    meta: { ...session.document.value.meta, updatedAt: new Date().toISOString() },
  };
}

/**
 * `index`/`toIndex` in `moveTokenCore`/`reorderStepsCore` is a drop-before
 * position computed against the array *before* the dragged item is removed
 * from it (see `resolveTokenDropTarget`/`resolveDropIndex`); removing that
 * item first shifts everything after it back by one, so a forward move
 * (`fromIndex < toIndexBeforeRemoval`) must adjust the target down by one to
 * land where the user actually dropped it. Shared by both call sites below
 * rather than hand-written twice - the same correction, not a coincidence.
 */
function adjustIndexForRemoval(fromIndex: number, toIndexBeforeRemoval: number): number {
  return fromIndex !== -1 && fromIndex < toIndexBeforeRemoval
    ? toIndexBeforeRemoval - 1
    : toIndexBeforeRemoval;
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

/**
 * Sets or clears one attachment kind on a token - at most one of each kind
 * at a time, so setting one where a value already exists replaces it,
 * rather than the token accumulating several of the same kind.
 */
function setTokenAttachment(
  session: DocumentSession,
  stepId: string,
  tokenId: string,
  kind: AttachmentKind,
  attachment: TokenAttachment | undefined,
): void {
  setSteps(
    session,
    session.document.value.steps.map((step) =>
      step.id === stepId
        ? {
            ...step,
            tokens: step.tokens.map((t) => (t.id === tokenId ? { ...t, [kind]: attachment } : t)),
          }
        : step,
    ),
  );
}

/**
 * The functions below (suffixed `Core`) are every mutator/query's real
 * implementation, taking a `DocumentSession` explicitly as their first
 * argument - the module's actual, constructable interface. They're grouped
 * into `sessionActions` for callers that construct their own session
 * (chiefly tests - see document.test.ts). App code should use the
 * zero-argument exports at the bottom of this file instead, which are these
 * same functions bound to `defaultSession` - so every existing call site
 * keeps working unchanged.
 */

/** Reverts the most recent change (or coalesced run of changes) - a no-op if there's nothing to undo. */
function undoCore(session: DocumentSession): void {
  if (session.past.value.length === 0) return;
  const previous = session.past.value[session.past.value.length - 1];
  session.past.value = session.past.value.slice(0, -1);
  session.future.value = [session.document.value, ...session.future.value];
  session._lastPushWasCoalesce = false;
  restoreDocument(session, previous);
}

/** Reapplies the most recently undone change - a no-op if there's nothing to redo. */
function redoCore(session: DocumentSession): void {
  if (session.future.value.length === 0) return;
  const next = session.future.value[0];
  session.future.value = session.future.value.slice(1);
  session.past.value = [...session.past.value, session.document.value];
  session._lastPushWasCoalesce = false;
  restoreDocument(session, next);
}

/**
 * Replaces the entire document - the Import flow (task 19). Unlike
 * `setSteps` (which only ever replaces `steps` on the existing document),
 * this swaps `meta`/`schemaVersion` too, since an imported file brings its
 * own. Still goes through `recordHistory` like every other mutation, so an
 * accidental import is one `undo()` away from being reverted.
 */
function replaceDocumentCore(session: DocumentSession, doc: InstructionDocument): void {
  recordHistory(session, false);
  session.document.value = { ...doc, meta: { ...doc.meta, updatedAt: new Date().toISOString() } };
  selectStepCore(session, doc.steps[0]?.id ?? null);
}

function selectStepCore(session: DocumentSession, stepId: string | null): void {
  session.selectedStepId.value = stepId;
  session.selectedTokenId.value = null;
}

function selectTokenCore(session: DocumentSession, stepId: string, tokenId: string): void {
  session.selectedStepId.value = stepId;
  session.selectedTokenId.value = tokenId;
}

function addStepCore(session: DocumentSession): void {
  const step = createEmptyStep();
  setSteps(session, [...session.document.value.steps, step]);
  selectStepCore(session, step.id);
}

function removeStepCore(session: DocumentSession, stepId: string): void {
  const steps = session.document.value.steps.filter((s) => s.id !== stepId);
  setSteps(session, steps);
  if (session.selectedStepId.value === stepId) {
    selectStepCore(session, steps[0]?.id ?? null);
  }
}

/** Adds a token to a specific step - the drag-and-drop drop target (task 9). */
function addTokenToStepCore(
  session: DocumentSession,
  stepId: string,
  token: InstructionToken,
  index?: number,
): void {
  setSteps(
    session,
    session.document.value.steps.map((step) =>
      step.id === stepId ? { ...step, tokens: insertToken(step.tokens, token, index) } : step,
    ),
  );
}

/** Adds a token to whichever step is selected - the tap-to-insert path (task 11). */
function addTokenToSelectedStepCore(session: DocumentSession, token: InstructionToken): void {
  const stepId = session.selectedStepId.value;
  if (!stepId) return;
  addTokenToStepCore(session, stepId, token);
}

/**
 * Moves an existing token to `index` within `toStepId`, removing it from
 * `fromStepId` first - covers both reordering within a step (fromStepId ===
 * toStepId) and moving between steps, via a drag on the canvas (task 9).
 */
function moveTokenCore(
  session: DocumentSession,
  fromStepId: string,
  tokenId: string,
  toStepId: string,
  index: number,
): void {
  const fromStep = session.document.value.steps.find((s) => s.id === fromStepId);
  const token = fromStep?.tokens.find((t) => t.id === tokenId);
  if (!token) return;

  setSteps(
    session,
    session.document.value.steps.map((step) => {
      if (step.id === fromStepId && step.id === toStepId) {
        const fromIndex = step.tokens.findIndex((t) => t.id === tokenId);
        const withoutToken = step.tokens.filter((t) => t.id !== tokenId);
        const adjustedIndex = adjustIndexForRemoval(fromIndex, index);
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
function reorderStepsCore(session: DocumentSession, fromIndex: number, toIndex: number): void {
  const steps = [...session.document.value.steps];
  if (fromIndex < 0 || fromIndex >= steps.length) return;
  const [moved] = steps.splice(fromIndex, 1);
  const adjustedToIndex = adjustIndexForRemoval(fromIndex, toIndex);
  const clamped = Math.max(0, Math.min(adjustedToIndex, steps.length));
  steps.splice(clamped, 0, moved);
  setSteps(session, steps);
}

function removeTokenFromStepCore(session: DocumentSession, stepId: string, tokenId: string): void {
  setSteps(
    session,
    session.document.value.steps.map((step) =>
      step.id === stepId
        ? { ...step, tokens: step.tokens.filter((t) => t.id !== tokenId) }
        : step,
    ),
  );
  if (session.selectedTokenId.value === tokenId) {
    session.selectedTokenId.value = null;
  }
}

function updateStepTitleCore(session: DocumentSession, stepId: string, title: string): void {
  setSteps(
    session,
    session.document.value.steps.map((step) => (step.id === stepId ? { ...step, title } : step)),
    { coalesce: true },
  );
}

function updateStepDescriptionCore(
  session: DocumentSession,
  stepId: string,
  description: string,
): void {
  setSteps(
    session,
    session.document.value.steps.map((step) =>
      step.id === stepId ? { ...step, description } : step,
    ),
    { coalesce: true },
  );
}

function updateTokenLabelCore(
  session: DocumentSession,
  stepId: string,
  tokenId: string,
  label: string,
): void {
  setSteps(
    session,
    session.document.value.steps.map((step) =>
      step.id === stepId
        ? { ...step, tokens: step.tokens.map((t) => (t.id === tokenId ? { ...t, label } : t)) }
        : step,
    ),
    { coalesce: true },
  );
}

function updateTokenNoteCore(
  session: DocumentSession,
  stepId: string,
  tokenId: string,
  note: string,
): void {
  setSteps(
    session,
    session.document.value.steps.map((step) =>
      step.id === stepId
        ? { ...step, tokens: step.tokens.map((t) => (t.id === tokenId ? { ...t, note } : t)) }
        : step,
    ),
    { coalesce: true },
  );
}

/** Attaches `attachment` to a specific token - TokenAttachmentPicker's click-to-attach path. */
function attachToTokenCore(
  session: DocumentSession,
  stepId: string,
  tokenId: string,
  kind: AttachmentKind,
  attachment: TokenAttachment,
): void {
  setTokenAttachment(session, stepId, tokenId, kind, attachment);
}

/** Attaches to whichever token is currently selected; a no-op if none is. */
function attachToSelectedTokenCore(
  session: DocumentSession,
  kind: AttachmentKind,
  attachment: TokenAttachment,
): void {
  const stepId = session.selectedStepId.value;
  const tokenId = session.selectedTokenId.value;
  if (!stepId || !tokenId) return;
  attachToTokenCore(session, stepId, tokenId, kind, attachment);
}

function removeTokenAttachmentCore(
  session: DocumentSession,
  stepId: string,
  tokenId: string,
  kind: AttachmentKind,
): void {
  setTokenAttachment(session, stepId, tokenId, kind, undefined);
}

/** Sets or clears a specific token's own duration - see InstructionToken.time. */
function setTokenTimeCore(
  session: DocumentSession,
  stepId: string,
  tokenId: string,
  time: DurationAttachment | undefined,
): void {
  setSteps(
    session,
    session.document.value.steps.map((step) =>
      step.id === stepId
        ? { ...step, tokens: step.tokens.map((t) => (t.id === tokenId ? { ...t, time } : t)) }
        : step,
    ),
  );
}

/** Sets or clears a step's own duration estimate - see InstructionStep.time. */
function setStepTimeCore(
  session: DocumentSession,
  stepId: string,
  time: DurationAttachment | undefined,
): void {
  setSteps(
    session,
    session.document.value.steps.map((step) => (step.id === stepId ? { ...step, time } : step)),
  );
}

export const sessionActions = {
  undo: undoCore,
  redo: redoCore,
  replaceDocument: replaceDocumentCore,
  selectStep: selectStepCore,
  selectToken: selectTokenCore,
  addStep: addStepCore,
  removeStep: removeStepCore,
  addTokenToStep: addTokenToStepCore,
  addTokenToSelectedStep: addTokenToSelectedStepCore,
  moveToken: moveTokenCore,
  reorderSteps: reorderStepsCore,
  removeTokenFromStep: removeTokenFromStepCore,
  updateStepTitle: updateStepTitleCore,
  updateStepDescription: updateStepDescriptionCore,
  updateTokenLabel: updateTokenLabelCore,
  updateTokenNote: updateTokenNoteCore,
  attachToToken: attachToTokenCore,
  attachToSelectedToken: attachToSelectedTokenCore,
  removeTokenAttachment: removeTokenAttachmentCore,
  setTokenTime: setTokenTimeCore,
  setStepTime: setStepTimeCore,
};

type SessionAction = (session: DocumentSession, ...args: never[]) => unknown;
type BoundSessionActions<T extends Record<string, SessionAction>> = {
  [K in keyof T]: T[K] extends (session: DocumentSession, ...args: infer A) => infer R
    ? (...args: A) => R
    : never;
};

/** Binds every action in `actions` to `session` as its first argument. */
function bindActionsToSession<T extends Record<string, SessionAction>>(
  actions: T,
  session: DocumentSession,
): BoundSessionActions<T> {
  const bound = {} as BoundSessionActions<T>;
  for (const key in actions) {
    const action = actions[key];
    bound[key] = ((...args: unknown[]) =>
      action(session, ...(args as never[]))) as BoundSessionActions<T>[typeof key];
  }
  return bound;
}

/**
 * The app's one running document - see `docs/known-issues.md`'s former
 * "document session tied to module-level singletons" entry (now resolved:
 * this is the one adapter every existing caller keeps using unchanged; a
 * test constructs a second, independent one via `createDocumentSession()`
 * instead of sharing this one).
 *
 * Note: `document` below intentionally shadows the DOM's global `document`.
 * No file in src/ needs both in the same scope today, but if one ever does,
 * import this one under an alias (e.g. `import { document as doc }`).
 */
const defaultSession = createDocumentSession();

export const document = defaultSession.document;
export const selectedStepId = defaultSession.selectedStepId;
export const selectedTokenId = defaultSession.selectedTokenId;
export const past = defaultSession.past;
export const future = defaultSession.future;
export const canUndo = defaultSession.canUndo;
export const canRedo = defaultSession.canRedo;
export const selectedStep = defaultSession.selectedStep;
export const selectedToken = defaultSession.selectedToken;

export const {
  undo,
  redo,
  replaceDocument,
  selectStep,
  selectToken,
  addStep,
  removeStep,
  addTokenToStep,
  addTokenToSelectedStep,
  moveToken,
  reorderSteps,
  removeTokenFromStep,
  updateStepTitle,
  updateStepDescription,
  updateTokenLabel,
  updateTokenNote,
  attachToToken,
  attachToSelectedToken,
  removeTokenAttachment,
  setTokenTime,
  setStepTime,
} = bindActionsToSession(sessionActions, defaultSession);
