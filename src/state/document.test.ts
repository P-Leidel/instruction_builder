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

    sessionActions.attachToToken(session, stepId, token.id, "warning", { iconId: "warn" });
    let attached = session.document.value.steps[0].tokens[0];
    expect(attached.warning).toEqual({ iconId: "warn" });

    sessionActions.attachToToken(session, stepId, token.id, "warning", { iconId: "warn-2" });
    attached = session.document.value.steps[0].tokens[0];
    expect(attached.warning).toEqual({ iconId: "warn-2" });

    sessionActions.removeTokenAttachment(session, stepId, token.id, "warning");
    attached = session.document.value.steps[0].tokens[0];
    expect(attached.warning).toBeUndefined();
  });

  it("attachToSelectedToken is a no-op when nothing is selected", () => {
    const session = createDocumentSession();
    const before = session.document.value;

    sessionActions.attachToSelectedToken(session, "warning", { iconId: "warn" });

    expect(session.document.value).toBe(before);
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
      // removeTokenFromStep already clears selectedTokenId directly; redo
      // restoring the removal (with the token now selected again first)
      // exercises restoreDocument's own repair path instead.
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
