import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createDocumentSession, sessionActions, type DocumentSession } from "./document";
import { createEmptyDocument, createToken } from "../model/instruction";

function stepIds(session: DocumentSession): string[] {
  return session.document.value.steps.map((s) => s.id);
}

describe("createDocumentSession", () => {
  it("starts with one empty step selected and empty history", () => {
    const session = createDocumentSession();
    expect(session.document.value.steps).toHaveLength(1);
    expect(session.selectedStepId.value).toBe(session.document.value.steps[0].id);
    expect(session.selectedTokenId.value).toBeNull();
    expect(session.past.value).toEqual([]);
    expect(session.future.value).toEqual([]);
    expect(session.canUndo.value).toBe(false);
    expect(session.canRedo.value).toBe(false);
  });

  it("two sessions never share state", () => {
    const a = createDocumentSession();
    const b = createDocumentSession();

    sessionActions.addStep(a);

    expect(a.document.value.steps).toHaveLength(2);
    expect(b.document.value.steps).toHaveLength(1);
    expect(a.past.value).toHaveLength(1);
    expect(b.past.value).toHaveLength(0);
  });

  it("accepts a pre-built initial document", () => {
    const initial = createEmptyDocument();
    initial.meta.title = "My recipe";
    const session = createDocumentSession(initial);
    expect(session.document.value.meta.title).toBe("My recipe");
  });
});

describe("addStep / removeStep", () => {
  it("addStep appends a step and selects it", () => {
    const session = createDocumentSession();
    const firstStepId = session.document.value.steps[0].id;

    sessionActions.addStep(session);

    expect(session.document.value.steps).toHaveLength(2);
    expect(session.selectedStepId.value).toBe(session.document.value.steps[1].id);
    expect(session.document.value.steps[0].id).toBe(firstStepId);
  });

  it("removeStep drops the step and, if it was selected, selects the first remaining one", () => {
    const session = createDocumentSession();
    sessionActions.addStep(session);
    const [first, second] = session.document.value.steps;
    sessionActions.selectStep(session, first.id);

    sessionActions.removeStep(session, first.id);

    expect(stepIds(session)).toEqual([second.id]);
    expect(session.selectedStepId.value).toBe(second.id);
  });

  it("removeStep leaves selection alone if a different step was removed", () => {
    const session = createDocumentSession();
    sessionActions.addStep(session);
    const [first, second] = session.document.value.steps;
    sessionActions.selectStep(session, second.id);

    sessionActions.removeStep(session, first.id);

    expect(session.selectedStepId.value).toBe(second.id);
  });
});

describe("selectStep / selectToken", () => {
  it("selecting a step clears any token selection", () => {
    const session = createDocumentSession();
    const stepId = session.document.value.steps[0].id;
    const token = createToken("action", "knife");
    sessionActions.addTokenToStep(session, stepId, token);
    sessionActions.selectToken(session, stepId, token.id);
    expect(session.selectedTokenId.value).toBe(token.id);

    sessionActions.selectStep(session, stepId);

    expect(session.selectedTokenId.value).toBeNull();
  });
});

/**
 * Selection repair is a property of `setSteps`, not of individual mutators
 * (2026-09-20 architecture review, candidate 2). These pin that at the
 * funnel: every case below goes through a mutator that contains no
 * selection code of its own.
 */
describe("selection repair through setSteps", () => {
  it("clears the token selection when the step holding it is removed", () => {
    const session = createDocumentSession();
    sessionActions.addStep(session);
    const [first, second] = session.document.value.steps;
    const token = createToken("action", "knife");
    sessionActions.addTokenToStep(session, first.id, token);
    sessionActions.selectToken(session, first.id, token.id);

    sessionActions.removeStep(session, first.id);

    expect(session.selectedStepId.value).toBe(second.id);
    expect(session.selectedTokenId.value).toBeNull();
    expect(session.selectedToken.value).toBeNull();
  });

  it("leaves a selected token alone when some other step is removed", () => {
    const session = createDocumentSession();
    sessionActions.addStep(session);
    const [first, second] = session.document.value.steps;
    const token = createToken("action", "knife");
    sessionActions.addTokenToStep(session, second.id, token);
    sessionActions.selectToken(session, second.id, token.id);

    sessionActions.removeStep(session, first.id);

    expect(session.selectedStepId.value).toBe(second.id);
    expect(session.selectedTokenId.value).toBe(token.id);
  });

  it("clears both when the last remaining step is removed", () => {
    const session = createDocumentSession();
    const stepId = session.document.value.steps[0].id;
    const token = createToken("action", "knife");
    sessionActions.addTokenToStep(session, stepId, token);
    sessionActions.selectToken(session, stepId, token.id);

    sessionActions.removeStep(session, stepId);

    expect(session.document.value.steps).toEqual([]);
    expect(session.selectedStepId.value).toBeNull();
    expect(session.selectedTokenId.value).toBeNull();
  });

  it("clears the token selection when that token is removed from its step", () => {
    const session = createDocumentSession();
    const stepId = session.document.value.steps[0].id;
    const token = createToken("action", "knife");
    sessionActions.addTokenToStep(session, stepId, token);
    sessionActions.selectToken(session, stepId, token.id);

    sessionActions.removeTokenFromStep(session, stepId, token.id);

    expect(session.selectedStepId.value).toBe(stepId);
    expect(session.selectedTokenId.value).toBeNull();
  });

  it("leaves the selection alone when a different token is removed", () => {
    const session = createDocumentSession();
    const stepId = session.document.value.steps[0].id;
    const selected = createToken("action", "knife");
    const other = createToken("action", "spoon");
    sessionActions.addTokenToStep(session, stepId, selected);
    sessionActions.addTokenToStep(session, stepId, other);
    sessionActions.selectToken(session, stepId, selected.id);

    sessionActions.removeTokenFromStep(session, stepId, other.id);

    expect(session.selectedTokenId.value).toBe(selected.id);
    expect(session.selectedToken.value?.id).toBe(selected.id);
  });

  it("leaves the selection alone on a mutation that only edits in place", () => {
    const session = createDocumentSession();
    const stepId = session.document.value.steps[0].id;
    const token = createToken("action", "knife");
    sessionActions.addTokenToStep(session, stepId, token);
    sessionActions.selectToken(session, stepId, token.id);

    sessionActions.updateStepTitle(session, stepId, "Chop");
    sessionActions.updateTokenLabel(session, stepId, token.id, "Cleaver");

    expect(session.selectedStepId.value).toBe(stepId);
    expect(session.selectedTokenId.value).toBe(token.id);
  });

  it("never leaves a selected id pointing at something the document doesn't hold", () => {
    const session = createDocumentSession();
    sessionActions.addStep(session);
    const [first, second] = session.document.value.steps;
    const token = createToken("action", "knife");
    sessionActions.addTokenToStep(session, first.id, token);
    sessionActions.selectToken(session, first.id, token.id);

    // Every mutator that can invalidate a selection, run back to back.
    sessionActions.moveToken(session, first.id, token.id, second.id, 0);
    sessionActions.selectToken(session, second.id, token.id);
    sessionActions.reorderSteps(session, 1, 0);
    sessionActions.removeTokenFromStep(session, second.id, token.id);
    sessionActions.removeStep(session, second.id);

    const steps = session.document.value.steps;
    const step = steps.find((s) => s.id === session.selectedStepId.value);
    expect(step ?? null).not.toBeNull();
    expect(session.selectedTokenId.value).toBeNull();
  });
});

describe("moveToken", () => {
  it("reorders within the same step, adjusting for the pre-removal index (forward move)", () => {
    const session = createDocumentSession();
    const stepId = session.document.value.steps[0].id;
    const a = createToken("action", "a");
    const b = createToken("action", "b");
    const c = createToken("action", "c");
    sessionActions.addTokenToStep(session, stepId, a);
    sessionActions.addTokenToStep(session, stepId, b);
    sessionActions.addTokenToStep(session, stepId, c);
    // [a, b, c] - move a (index 0) to drop-before index 2 (before c, in the
    // pre-removal array) - removing a first shifts b/c back one, so a should
    // land at index 1 (between b and c), not index 2.
    sessionActions.moveToken(session, stepId, a.id, stepId, 2);

    const tokens = session.document.value.steps[0].tokens.map((t) => t.id);
    expect(tokens).toEqual([b.id, a.id, c.id]);
  });

  it("reorders within the same step without adjustment (backward move)", () => {
    const session = createDocumentSession();
    const stepId = session.document.value.steps[0].id;
    const a = createToken("action", "a");
    const b = createToken("action", "b");
    const c = createToken("action", "c");
    sessionActions.addTokenToStep(session, stepId, a);
    sessionActions.addTokenToStep(session, stepId, b);
    sessionActions.addTokenToStep(session, stepId, c);
    // [a, b, c] - move c (index 2) to drop-before index 0 (before a) - c is
    // already after index 0, so no pre-removal-shift adjustment is needed.
    sessionActions.moveToken(session, stepId, c.id, stepId, 0);

    const tokens = session.document.value.steps[0].tokens.map((t) => t.id);
    expect(tokens).toEqual([c.id, a.id, b.id]);
  });

  it("moves a token to index 0 within the same step", () => {
    const session = createDocumentSession();
    const stepId = session.document.value.steps[0].id;
    const a = createToken("action", "a");
    const b = createToken("action", "b");
    sessionActions.addTokenToStep(session, stepId, a);
    sessionActions.addTokenToStep(session, stepId, b);

    sessionActions.moveToken(session, stepId, b.id, stepId, 0);

    const tokens = session.document.value.steps[0].tokens.map((t) => t.id);
    expect(tokens).toEqual([b.id, a.id]);
  });

  it("moves a token to the end of the same step (append)", () => {
    const session = createDocumentSession();
    const stepId = session.document.value.steps[0].id;
    const a = createToken("action", "a");
    const b = createToken("action", "b");
    const c = createToken("action", "c");
    sessionActions.addTokenToStep(session, stepId, a);
    sessionActions.addTokenToStep(session, stepId, b);
    sessionActions.addTokenToStep(session, stepId, c);
    // [a, b, c] - move a (index 0) to drop-before index 3 (one past the last
    // pre-removal index) - the append case adjustIndexForRemoval must also
    // get right, not just mid-array inserts.
    sessionActions.moveToken(session, stepId, a.id, stepId, 3);

    const tokens = session.document.value.steps[0].tokens.map((t) => t.id);
    expect(tokens).toEqual([b.id, c.id, a.id]);
  });

  it("moves a token to a different step", () => {
    const session = createDocumentSession();
    sessionActions.addStep(session);
    const [step1, step2] = session.document.value.steps;
    const token = createToken("action", "knife");
    sessionActions.addTokenToStep(session, step1.id, token);

    sessionActions.moveToken(session, step1.id, token.id, step2.id, 0);

    expect(session.document.value.steps[0].tokens).toEqual([]);
    expect(session.document.value.steps[1].tokens.map((t) => t.id)).toEqual([token.id]);
  });

  it("is a no-op when the token doesn't exist", () => {
    const session = createDocumentSession();
    const stepId = session.document.value.steps[0].id;
    const before = session.document.value;

    sessionActions.moveToken(session, stepId, "does-not-exist", stepId, 0);

    expect(session.document.value).toBe(before);
  });

  it("is a no-op when the destination step doesn't exist, rather than destroying the token", () => {
    const session = createDocumentSession();
    const stepId = session.document.value.steps[0].id;
    const token = createToken("action", "knife");
    sessionActions.addTokenToStep(session, stepId, token);
    const before = session.document.value;
    const historyLength = session.past.value.length;

    // The destination is resolved from a drop target, so an id the document
    // no longer holds is reachable if the document changes mid-drag. Without
    // a destination guard the map below removes the token from its source
    // step and never re-inserts it anywhere - the token is gone, and the
    // destruction is recorded as a legitimate undo entry.
    sessionActions.moveToken(session, stepId, token.id, "no-such-step", 0);

    expect(session.document.value).toBe(before);
    expect(session.document.value.steps[0].tokens.map((t) => t.id)).toEqual([token.id]);
    expect(session.past.value).toHaveLength(historyLength);
  });

  it("is a no-op when the source step doesn't exist", () => {
    const session = createDocumentSession();
    const stepId = session.document.value.steps[0].id;
    const token = createToken("action", "knife");
    sessionActions.addTokenToStep(session, stepId, token);
    const before = session.document.value;
    const historyLength = session.past.value.length;

    sessionActions.moveToken(session, "no-such-step", token.id, stepId, 0);

    expect(session.document.value).toBe(before);
    expect(session.past.value).toHaveLength(historyLength);
  });

  it("is a no-op when dropped back exactly where it started (2026-09-17 audit remediation, finding 2/B5)", () => {
    const session = createDocumentSession();
    const stepId = session.document.value.steps[0].id;
    const a = createToken("action", "a");
    const b = createToken("action", "b");
    sessionActions.addTokenToStep(session, stepId, a);
    sessionActions.addTokenToStep(session, stepId, b);
    const before = session.document.value;
    const historyLength = session.past.value.length;

    // [a, b] - a is already at index 0, so dropping it back at index 0
    // shouldn't record a history entry or wipe redo.
    sessionActions.moveToken(session, stepId, a.id, stepId, 0);

    expect(session.document.value).toBe(before);
    expect(session.past.value).toHaveLength(historyLength);
  });

  it("repairs selection when the currently-selected token moves to a different step (2026-09-17 audit remediation, finding 2/B5)", () => {
    const session = createDocumentSession();
    sessionActions.addStep(session);
    const [step1, step2] = session.document.value.steps;
    const token = createToken("action", "knife");
    sessionActions.addTokenToStep(session, step1.id, token);
    sessionActions.selectToken(session, step1.id, token.id);

    sessionActions.moveToken(session, step1.id, token.id, step2.id, 0);

    // Before the fix, selectedStepId kept pointing at step1 (the token's old
    // step) with no repair at all - repairSelection resolves it the same
    // way restoreDocument does: step1 still exists, so it stays selected,
    // but it no longer contains the moved token, so token selection clears.
    expect(session.selectedStepId.value).toBe(step1.id);
    expect(session.selectedTokenId.value).toBeNull();
  });
});

describe("addTokenToStep", () => {
  it("is a no-op for a step id the document doesn't hold", () => {
    const session = createDocumentSession();
    const before = session.document.value;
    const historyLength = session.past.value.length;

    // Reachable the same way moveToken's unknown destination is: the step id
    // comes from a drop target resolved during the drag, not from a read of
    // the document at commit time.
    sessionActions.addTokenToStep(session, "no-such-step", createToken("action", "knife"), 0);

    expect(session.document.value).toBe(before);
    expect(session.past.value).toHaveLength(historyLength);
  });
});

describe("reorderSteps", () => {
  it("moves a step forward, adjusting for the pre-removal index", () => {
    const session = createDocumentSession();
    sessionActions.addStep(session);
    sessionActions.addStep(session);
    const [s1, s2, s3] = session.document.value.steps;
    // [s1, s2, s3] - drag s1 (index 0) to drop-before index 2 (before s3, in
    // the pre-removal array) - should land between s2 and s3, at index 1.
    sessionActions.reorderSteps(session, 0, 2);

    expect(stepIds(session)).toEqual([s2.id, s1.id, s3.id]);
  });

  it("moves a step backward without adjustment", () => {
    const session = createDocumentSession();
    sessionActions.addStep(session);
    sessionActions.addStep(session);
    const [s1, s2, s3] = session.document.value.steps;

    sessionActions.reorderSteps(session, 2, 0);

    expect(stepIds(session)).toEqual([s3.id, s1.id, s2.id]);
  });

  it("clamps a drop past the end of the array", () => {
    const session = createDocumentSession();
    sessionActions.addStep(session);
    const [s1, s2] = session.document.value.steps;

    sessionActions.reorderSteps(session, 0, 99);

    expect(stepIds(session)).toEqual([s2.id, s1.id]);
  });

  it("is a no-op for an out-of-range fromIndex", () => {
    const session = createDocumentSession();
    const before = session.document.value;

    sessionActions.reorderSteps(session, 5, 0);

    expect(session.document.value).toBe(before);
  });

  it("is a no-op when dropped back exactly where it started (2026-09-17 audit remediation, finding 2/B5)", () => {
    const session = createDocumentSession();
    sessionActions.addStep(session);
    sessionActions.addStep(session);
    const before = session.document.value;
    const historyLength = session.past.value.length;

    // [s1, s2, s3] - drop-before index 1 (pre-removal) for s1 (index 0)
    // resolves to its own current position, so this shouldn't record a
    // history entry or wipe redo.
    sessionActions.reorderSteps(session, 0, 1);

    expect(session.document.value).toBe(before);
    expect(session.past.value).toHaveLength(historyLength);
  });
});

describe("moveStepUp / moveStepDown", () => {
  it("moveStepUp swaps a step with its predecessor", () => {
    const session = createDocumentSession();
    sessionActions.addStep(session);
    sessionActions.addStep(session);
    const [s1, s2, s3] = session.document.value.steps;

    sessionActions.moveStepUp(session, s2.id);

    expect(stepIds(session)).toEqual([s2.id, s1.id, s3.id]);
  });

  it("moveStepDown swaps a step with its successor", () => {
    const session = createDocumentSession();
    sessionActions.addStep(session);
    sessionActions.addStep(session);
    const [s1, s2, s3] = session.document.value.steps;

    sessionActions.moveStepDown(session, s2.id);

    expect(stepIds(session)).toEqual([s1.id, s3.id, s2.id]);
  });

  it("moveStepUp is a no-op on the first step", () => {
    const session = createDocumentSession();
    sessionActions.addStep(session);
    const before = session.document.value;
    const [s1] = session.document.value.steps;

    sessionActions.moveStepUp(session, s1.id);

    expect(session.document.value).toBe(before);
  });

  it("moveStepDown is a no-op on the last step", () => {
    const session = createDocumentSession();
    sessionActions.addStep(session);
    const before = session.document.value;
    const [, s2] = session.document.value.steps;

    sessionActions.moveStepDown(session, s2.id);

    expect(session.document.value).toBe(before);
  });

  it("both are a no-op for an unknown stepId", () => {
    const session = createDocumentSession();
    sessionActions.addStep(session);
    const before = session.document.value;

    sessionActions.moveStepUp(session, "does-not-exist");
    sessionActions.moveStepDown(session, "does-not-exist");

    expect(session.document.value).toBe(before);
  });
});

describe("attachments", () => {
  it("attaches, replaces, and removes at most one of each kind", () => {
    const session = createDocumentSession();
    const stepId = session.document.value.steps[0].id;
    const token = createToken("action", "knife");
    sessionActions.addTokenToStep(session, stepId, token);

    sessionActions.attachToToken(session, stepId, token.id, { kind: "warning", value: { iconId: "warn" } });
    let attached = session.document.value.steps[0].tokens[0];
    expect(attached.warning).toEqual({ iconId: "warn" });

    sessionActions.attachToToken(session, stepId, token.id, { kind: "warning", value: { iconId: "warn-2" } });
    attached = session.document.value.steps[0].tokens[0];
    expect(attached.warning).toEqual({ iconId: "warn-2" });

    sessionActions.removeTokenAttachment(session, stepId, token.id, "warning");
    attached = session.document.value.steps[0].tokens[0];
    expect(attached.warning).toBeUndefined();
  });

  it("is a no-op when re-attaching an already-attached value (2026-09-17 audit remediation, finding 2/B5)", () => {
    const session = createDocumentSession();
    const stepId = session.document.value.steps[0].id;
    const token = createToken("action", "knife");
    sessionActions.addTokenToStep(session, stepId, token);
    sessionActions.attachToToken(session, stepId, token.id, { kind: "warning", value: { iconId: "warn" } });
    const before = session.document.value;
    const historyLength = session.past.value.length;

    sessionActions.attachToToken(session, stepId, token.id, { kind: "warning", value: { iconId: "warn" } });

    expect(session.document.value).toBe(before);
    expect(session.past.value).toHaveLength(historyLength);
  });

  it("is a no-op when removing an attachment that isn't set", () => {
    const session = createDocumentSession();
    const stepId = session.document.value.steps[0].id;
    const token = createToken("action", "knife");
    sessionActions.addTokenToStep(session, stepId, token);
    const before = session.document.value;

    sessionActions.removeTokenAttachment(session, stepId, token.id, "warning");

    expect(session.document.value).toBe(before);
  });

  it("ties `kind` to its payload type at compile time (2026-09-17 audit remediation, finding 6/item 8)", () => {
    // Regression test for the type-safety gap `TokenAttachmentSpec`
    // (state/document.ts) closes: `kind: "quantity"` now requires a full
    // `QuantityAttachment` (amount/unit included), not just any
    // `TokenAttachment`-shaped object - this used to type-check silently.
    // `@ts-expect-error` makes this a compile error *if the gap ever
    // reopens* (e.g. `TokenAttachmentSpec` loosening back to a flat union) -
    // `npm run typecheck`/`build` fail if the next line stops erroring.
    const session = createDocumentSession();
    const stepId = session.document.value.steps[0].id;
    const token = createToken("action", "knife");
    sessionActions.addTokenToStep(session, stepId, token);

    // @ts-expect-error - "quantity" requires a QuantityAttachment (amount/unit), not a bare TokenAttachment
    sessionActions.attachToToken(session, stepId, token.id, { kind: "quantity", value: { iconId: "x" } });
  });
});

describe("time", () => {
  it("sets and clears a token's own time independently of the step's", () => {
    const session = createDocumentSession();
    const stepId = session.document.value.steps[0].id;
    const token = createToken("action", "knife");
    sessionActions.addTokenToStep(session, stepId, token);
    const time = { iconId: "clock", label: "1m", seconds: 60 };

    sessionActions.setTokenTime(session, stepId, token.id, time);
    expect(session.document.value.steps[0].tokens[0].time).toEqual(time);

    sessionActions.setTokenTime(session, stepId, token.id, undefined);
    expect(session.document.value.steps[0].tokens[0].time).toBeUndefined();
  });

  it("sets a step's own time", () => {
    const session = createDocumentSession();
    const stepId = session.document.value.steps[0].id;
    const time = { iconId: "clock", label: "1m", seconds: 60 };

    sessionActions.setStepTime(session, stepId, time);

    expect(session.document.value.steps[0].time).toEqual(time);
  });
});

/**
 * Every write to a single token inside a single step goes through
 * `updateTokenIn` (2026-09-20 architecture review, candidate 3). These pin
 * the two properties that live at that seam rather than in each mutator:
 * a write that changes nothing records nothing, and a write naming
 * something the document doesn't hold does nothing at all. Before the seam,
 * only the attachment mutators had either - `setTokenTime` had neither,
 * which is what made an unchanged Save on Token time push an undo entry.
 */
describe("token writes through updateTokenIn", () => {
  function sessionWithToken() {
    const session = createDocumentSession();
    const stepId = session.document.value.steps[0].id;
    const token = createToken("action", "knife", "Chop");
    sessionActions.addTokenToStep(session, stepId, token);
    return { session, stepId, tokenId: token.id };
  }

  it("re-saving an unchanged token time records no history and leaves redo alone", () => {
    const { session, stepId, tokenId } = sessionWithToken();
    sessionActions.setTokenTime(session, stepId, tokenId, { iconId: "clock", label: "1m", seconds: 60 });
    sessionActions.undo(session);
    sessionActions.redo(session);
    const before = session.document.value;
    const historyLength = session.past.value.length;
    const futureLength = session.future.value.length;

    // A new object with identical fields, which is exactly what DurationForm
    // hands over: it re-seeds its draft from `value.seconds` on every open
    // and rebuilds the attachment on Save, so an unchanged Save is never
    // identity-equal to the value already on the token.
    sessionActions.setTokenTime(session, stepId, tokenId, { iconId: "clock", label: "1m", seconds: 60 });

    expect(session.document.value).toBe(before);
    expect(session.past.value).toHaveLength(historyLength);
    expect(session.future.value).toHaveLength(futureLength);
  });

  it("re-saving an unchanged step time records no history and leaves redo alone", () => {
    const session = createDocumentSession();
    const stepId = session.document.value.steps[0].id;
    sessionActions.setStepTime(session, stepId, { iconId: "clock", label: "1m", seconds: 60 });
    sessionActions.undo(session);
    sessionActions.redo(session);
    const before = session.document.value;
    const historyLength = session.past.value.length;
    const futureLength = session.future.value.length;

    sessionActions.setStepTime(session, stepId, { iconId: "clock", label: "1m", seconds: 60 });

    expect(session.document.value).toBe(before);
    expect(session.past.value).toHaveLength(historyLength);
    expect(session.future.value).toHaveLength(futureLength);
  });

  it("clearing a time that is already unset is a no-op, at both levels", () => {
    const { session, stepId, tokenId } = sessionWithToken();
    const before = session.document.value;
    const historyLength = session.past.value.length;

    sessionActions.setTokenTime(session, stepId, tokenId, undefined);
    sessionActions.setStepTime(session, stepId, undefined);

    expect(session.document.value).toBe(before);
    expect(session.past.value).toHaveLength(historyLength);
  });

  it("re-writing an identical label or note records nothing", () => {
    const { session, stepId, tokenId } = sessionWithToken();
    sessionActions.updateTokenNote(session, stepId, tokenId, "Careful");
    const before = session.document.value;
    const historyLength = session.past.value.length;

    sessionActions.updateTokenLabel(session, stepId, tokenId, "Chop");
    sessionActions.updateTokenNote(session, stepId, tokenId, "Careful");

    expect(session.document.value).toBe(before);
    expect(session.past.value).toHaveLength(historyLength);
  });

  it("is a no-op for a token id the step doesn't hold", () => {
    const { session, stepId } = sessionWithToken();
    const before = session.document.value;
    const historyLength = session.past.value.length;

    sessionActions.updateTokenLabel(session, stepId, "no-such-token", "Chop");
    sessionActions.setTokenTime(session, stepId, "no-such-token", { iconId: "clock", label: "1m", seconds: 60 });
    sessionActions.removeTokenFromStep(session, stepId, "no-such-token");

    expect(session.document.value).toBe(before);
    expect(session.past.value).toHaveLength(historyLength);
  });

  it("is a no-op for a step id the document doesn't hold", () => {
    const { session, tokenId } = sessionWithToken();
    const before = session.document.value;
    const historyLength = session.past.value.length;

    sessionActions.updateTokenLabel(session, "no-such-step", tokenId, "Dice");
    sessionActions.attachToToken(session, "no-such-step", tokenId, { kind: "warning", value: { iconId: "warn" } });
    sessionActions.removeTokenFromStep(session, "no-such-step", tokenId);

    expect(session.document.value).toBe(before);
    expect(session.past.value).toHaveLength(historyLength);
  });

  it("patches one field without disturbing the rest of the token", () => {
    const { session, stepId, tokenId } = sessionWithToken();
    sessionActions.updateTokenNote(session, stepId, tokenId, "Careful");
    sessionActions.attachToToken(session, stepId, tokenId, { kind: "warning", value: { iconId: "warn" } });

    sessionActions.setTokenTime(session, stepId, tokenId, { iconId: "clock", label: "1m", seconds: 60 });

    expect(session.document.value.steps[0].tokens[0]).toEqual({
      id: tokenId,
      category: "action",
      iconId: "knife",
      label: "Chop",
      note: "Careful",
      warning: { iconId: "warn" },
      time: { iconId: "clock", label: "1m", seconds: 60 },
    });
  });

  it("leaves every other step untouched by identity", () => {
    const { session, stepId, tokenId } = sessionWithToken();
    sessionActions.addStep(session);
    const otherStep = session.document.value.steps[1];

    sessionActions.updateTokenLabel(session, stepId, tokenId, "Dice");

    expect(session.document.value.steps[1]).toBe(otherStep);
  });
});

describe("copyToken / pasteToken", () => {
  it("copies a token's full content into the clipboard with a fresh id", () => {
    const session = createDocumentSession();
    const stepId = session.document.value.steps[0].id;
    const token = createToken("action", "knife", "Chop");
    sessionActions.addTokenToStep(session, stepId, token);
    sessionActions.attachToToken(session, stepId, token.id, { kind: "warning", value: { iconId: "warn" } });

    sessionActions.copyToken(session, stepId, token.id);

    expect(session.copiedToken.value).toEqual({ ...token, warning: { iconId: "warn" }, id: expect.any(String) });
    expect(session.copiedToken.value?.id).not.toBe(token.id);
  });

  it("copying doesn't touch the document or push a new history entry", () => {
    const session = createDocumentSession();
    const stepId = session.document.value.steps[0].id;
    const token = createToken("action", "knife");
    sessionActions.addTokenToStep(session, stepId, token);
    const docBefore = session.document.value;
    const historyLengthBefore = session.past.value.length;

    sessionActions.copyToken(session, stepId, token.id);

    expect(session.document.value).toBe(docBefore);
    expect(session.past.value.length).toBe(historyLengthBefore);
  });

  it("pastes onto the selected step, minting yet another fresh id, and is undoable", () => {
    const session = createDocumentSession();
    const stepId = session.document.value.steps[0].id;
    const token = createToken("action", "knife", "Chop");
    sessionActions.addTokenToStep(session, stepId, token);
    sessionActions.copyToken(session, stepId, token.id);
    const copiedId = session.copiedToken.value?.id;

    sessionActions.pasteToken(session);

    const tokens = session.document.value.steps[0].tokens;
    expect(tokens).toHaveLength(2);
    expect(tokens[1]).toMatchObject({ category: "action", iconId: "knife", label: "Chop" });
    expect(tokens[1].id).not.toBe(token.id);
    expect(tokens[1].id).not.toBe(copiedId);

    sessionActions.undo(session);
    expect(session.document.value.steps[0].tokens).toHaveLength(1);
  });

  it("pasting the same clipboard twice appends two distinct tokens", () => {
    const session = createDocumentSession();
    const stepId = session.document.value.steps[0].id;
    const token = createToken("action", "knife");
    sessionActions.addTokenToStep(session, stepId, token);
    sessionActions.copyToken(session, stepId, token.id);

    sessionActions.pasteToken(session);
    sessionActions.pasteToken(session);

    const tokens = session.document.value.steps[0].tokens;
    expect(tokens).toHaveLength(3);
    expect(tokens[1].id).not.toBe(tokens[2].id);
  });

  it("pasting with nothing copied, or no step selected, is a no-op", () => {
    const session = createDocumentSession();
    const stepId = session.document.value.steps[0].id;

    sessionActions.pasteToken(session);
    expect(session.document.value.steps[0].tokens).toHaveLength(0);

    const token = createToken("action", "knife");
    sessionActions.addTokenToStep(session, stepId, token);
    sessionActions.copyToken(session, stepId, token.id);
    sessionActions.selectStep(session, null);

    sessionActions.pasteToken(session);
    expect(session.document.value.steps[0].tokens).toHaveLength(1);
  });

  it("replacing the document clears the clipboard", () => {
    const session = createDocumentSession();
    const stepId = session.document.value.steps[0].id;
    const token = createToken("action", "knife");
    sessionActions.addTokenToStep(session, stepId, token);
    sessionActions.copyToken(session, stepId, token.id);
    expect(session.copiedToken.value).not.toBeNull();

    sessionActions.replaceDocument(session, createEmptyDocument());

    expect(session.copiedToken.value).toBeNull();
  });
});

describe("updateTitle", () => {
  it("updates meta.title and is undoable", () => {
    const session = createDocumentSession();
    const originalTitle = session.document.value.meta.title;

    sessionActions.updateTitle(session, "Weeknight Pasta");
    expect(session.document.value.meta.title).toBe("Weeknight Pasta");

    sessionActions.undo(session);
    expect(session.document.value.meta.title).toBe(originalTitle);
  });

  it("doesn't touch steps", () => {
    const session = createDocumentSession();
    const stepsBefore = session.document.value.steps;

    sessionActions.updateTitle(session, "Weeknight Pasta");

    expect(session.document.value.steps).toBe(stepsBefore);
  });
});

describe("undo / redo", () => {
  it("undoes and redoes a discrete action as one step", () => {
    const session = createDocumentSession();
    expect(session.canUndo.value).toBe(false);

    sessionActions.addStep(session);
    expect(session.document.value.steps).toHaveLength(2);
    expect(session.canUndo.value).toBe(true);

    sessionActions.undo(session);
    expect(session.document.value.steps).toHaveLength(1);
    expect(session.canUndo.value).toBe(false);
    expect(session.canRedo.value).toBe(true);

    sessionActions.redo(session);
    expect(session.document.value.steps).toHaveLength(2);
    expect(session.canRedo.value).toBe(false);
  });

  it("undo is a no-op with empty history, redo is a no-op with empty future", () => {
    const session = createDocumentSession();
    const before = session.document.value;

    sessionActions.undo(session);
    expect(session.document.value).toBe(before);

    sessionActions.redo(session);
    expect(session.document.value).toBe(before);
  });

  it("a new action clears the redo stack", () => {
    const session = createDocumentSession();
    sessionActions.addStep(session);
    sessionActions.undo(session);
    expect(session.canRedo.value).toBe(true);

    sessionActions.addStep(session);

    expect(session.canRedo.value).toBe(false);
    expect(session.future.value).toEqual([]);
  });

  it("caps history at 100 entries", () => {
    const session = createDocumentSession();
    for (let i = 0; i < 105; i++) {
      sessionActions.addStep(session);
    }
    expect(session.past.value).toHaveLength(100);
  });

  describe("selection-repair on restore", () => {
    it("keeps the current selection alive across an unrelated undo", () => {
      const session = createDocumentSession();
      sessionActions.addStep(session);
      const [step1, step2] = session.document.value.steps;
      sessionActions.selectStep(session, step2.id);

      // Unrelated change to step1 while step2 stays selected.
      sessionActions.updateStepTitle(session, step1.id, "Renamed");
      sessionActions.undo(session);

      expect(session.selectedStepId.value).toBe(step2.id);
    });

    it("falls back to the first step if the selected step no longer exists in the restored snapshot", () => {
      const session = createDocumentSession();
      const step0 = session.document.value.steps[0];

      sessionActions.addStep(session); // creates and selects a second step
      const newStepId = session.selectedStepId.value;
      expect(newStepId).not.toBe(step0.id);

      sessionActions.undo(session); // back to just [step0] - the selected step no longer exists

      expect(session.selectedStepId.value).toBe(step0.id);
    });

    it("clears token selection if the token no longer exists in the restored document", () => {
      const session = createDocumentSession();
      const stepId = session.document.value.steps[0].id;
      const token = createToken("action", "knife");
      sessionActions.addTokenToStep(session, stepId, token);
      sessionActions.selectToken(session, stepId, token.id);

      sessionActions.removeTokenFromStep(session, stepId, token.id);
      // removeTokenFromStep's own clearing comes from setSteps; redo
      // restoring the removal (with the token now selected again first)
      // exercises restoreDocument's separate repair path instead, which is
      // the one path that doesn't go through setSteps.
      sessionActions.undo(session); // token is back
      sessionActions.selectToken(session, stepId, token.id);
      sessionActions.redo(session); // token is removed again

      expect(session.selectedTokenId.value).toBeNull();
    });
  });

  describe("coalescing", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("merges rapid coalescing calls into one history entry", () => {
      const session = createDocumentSession();
      const stepId = session.document.value.steps[0].id;

      sessionActions.updateStepTitle(session, stepId, "C");
      vi.advanceTimersByTime(100);
      sessionActions.updateStepTitle(session, stepId, "Ch");
      vi.advanceTimersByTime(100);
      sessionActions.updateStepTitle(session, stepId, "Cho");

      expect(session.past.value).toHaveLength(1);

      sessionActions.undo(session);
      expect(session.document.value.steps[0].title).toBeUndefined();
    });

    it("starts a new history entry once the coalesce window has passed", () => {
      const session = createDocumentSession();
      const stepId = session.document.value.steps[0].id;

      sessionActions.updateStepTitle(session, stepId, "C");
      vi.advanceTimersByTime(701); // just past COALESCE_WINDOW_MS
      sessionActions.updateStepTitle(session, stepId, "D");

      expect(session.past.value).toHaveLength(2);
    });

    it("a non-coalescing action in between starts a fresh entry", () => {
      const session = createDocumentSession();
      const stepId = session.document.value.steps[0].id;

      sessionActions.updateStepTitle(session, stepId, "C");
      sessionActions.addStep(session); // discrete action, not coalesced
      sessionActions.updateStepTitle(session, stepId, "D");

      expect(session.past.value).toHaveLength(3);
    });
  });
});
