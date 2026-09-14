import { describe, it, expect } from "vitest";
import { validateStep, validateDocument } from "./validate";
import { createEmptyDocument, createEmptyStep, createToken } from "./instruction";

describe("validateStep", () => {
  it("flags an empty step as incomplete", () => {
    const step = createEmptyStep();
    const result = validateStep(step);
    expect(result).toEqual({ stepId: step.id, isComplete: false, issues: ["Step is empty"] });
  });

  it("flags a step with tokens but no action as incomplete", () => {
    const step = { ...createEmptyStep(), tokens: [createToken("object", "onion")] };
    const result = validateStep(step);
    expect(result.isComplete).toBe(false);
    expect(result.issues).toEqual(["Missing an action token"]);
  });

  it("considers a step with an action token complete", () => {
    const step = {
      ...createEmptyStep(),
      tokens: [createToken("action", "knife"), createToken("object", "onion")],
    };
    const result = validateStep(step);
    expect(result).toEqual({ stepId: step.id, isComplete: true, issues: [] });
  });
});

describe("validateDocument", () => {
  it("validates every step and preserves order", () => {
    const doc = createEmptyDocument();
    doc.steps.push({ ...createEmptyStep(), tokens: [createToken("action", "knife")] });

    const results = validateDocument(doc);

    expect(results).toHaveLength(2);
    expect(results[0].stepId).toBe(doc.steps[0].id);
    expect(results[0].isComplete).toBe(false);
    expect(results[1].stepId).toBe(doc.steps[1].id);
    expect(results[1].isComplete).toBe(true);
  });
});
