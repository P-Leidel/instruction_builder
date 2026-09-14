import { describe, it, expect } from "vitest";
import {
  CURRENT_SCHEMA_VERSION,
  createEmptyDocument,
  createEmptyStep,
  createToken,
} from "./instruction";

describe("createEmptyDocument", () => {
  it("starts at the current schema version with one empty step", () => {
    const doc = createEmptyDocument();
    expect(doc.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(doc.steps).toHaveLength(1);
    expect(doc.steps[0].tokens).toEqual([]);
  });

  it("gives every document its own step id", () => {
    const a = createEmptyDocument();
    const b = createEmptyDocument();
    expect(a.steps[0].id).not.toBe(b.steps[0].id);
  });

  it("sets createdAt and updatedAt to the same initial timestamp", () => {
    const doc = createEmptyDocument();
    expect(doc.meta.createdAt).toBe(doc.meta.updatedAt);
  });
});

describe("createEmptyStep", () => {
  it("has no tokens and a unique id", () => {
    const a = createEmptyStep();
    const b = createEmptyStep();
    expect(a.tokens).toEqual([]);
    expect(a.id).not.toBe(b.id);
  });
});

describe("createToken", () => {
  it("carries the given category/iconId/label and a unique id", () => {
    const a = createToken("action", "knife", "Chop");
    const b = createToken("action", "knife", "Chop");
    expect(a).toMatchObject({ category: "action", iconId: "knife", label: "Chop" });
    expect(a.id).not.toBe(b.id);
  });

  it("leaves label undefined when omitted", () => {
    const token = createToken("tool", "pan");
    expect(token.label).toBeUndefined();
  });
});
