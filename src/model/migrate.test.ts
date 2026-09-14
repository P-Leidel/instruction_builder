import { describe, it, expect } from "vitest";
import { migrate } from "./migrate";
import {
  CURRENT_SCHEMA_VERSION,
  createEmptyDocument,
  type TokenCategory,
} from "./instruction";

function validDoc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const doc = createEmptyDocument();
  return { ...doc, ...overrides };
}

describe("migrate", () => {
  it("accepts a current-schema document unchanged", () => {
    const doc = createEmptyDocument();
    expect(migrate(doc)).toEqual(doc);
  });

  it("rejects a schemaVersion newer than this app supports", () => {
    expect(() => migrate(validDoc({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 }))).toThrow(
      /newer than this app supports/,
    );
  });

  it.each([
    ["not an object", "just a string"],
    ["an array", ["not", "a", "document"]],
    ["null", null],
  ])("rejects %s", (_label, input) => {
    expect(() => migrate(input)).toThrow(/Not a valid instruction file/);
  });

  it("rejects a missing schemaVersion", () => {
    const doc = validDoc();
    delete doc.schemaVersion;
    expect(() => migrate(doc)).toThrow(/missing a schemaVersion/);
  });

  it.each(["title", "domain", "createdAt", "updatedAt"])(
    "rejects meta missing %s",
    (field) => {
      const doc = validDoc();
      const meta = { ...(doc.meta as Record<string, unknown>) };
      delete meta[field];
      expect(() => migrate({ ...doc, meta })).toThrow(/missing or invalid meta/);
    },
  );

  it("rejects steps that isn't an array", () => {
    expect(() => migrate(validDoc({ steps: "not-an-array" }))).toThrow(/missing or invalid steps/);
  });

  it("rejects a step missing an id", () => {
    expect(() => migrate(validDoc({ steps: [{ tokens: [] }] }))).toThrow(
      /missing or invalid steps/,
    );
  });

  it("rejects a step whose tokens isn't an array", () => {
    expect(() => migrate(validDoc({ steps: [{ id: "s1", tokens: "nope" }] }))).toThrow(
      /missing or invalid steps/,
    );
  });

  it("rejects a token missing an id", () => {
    const doc = validDoc({
      steps: [{ id: "s1", tokens: [{ iconId: "knife", category: "action" }] }],
    });
    expect(() => migrate(doc)).toThrow(/missing or invalid steps/);
  });

  it("rejects a token missing an iconId", () => {
    const doc = validDoc({
      steps: [{ id: "s1", tokens: [{ id: "t1", category: "action" }] }],
    });
    expect(() => migrate(doc)).toThrow(/missing or invalid steps/);
  });

  it("rejects a token with an invalid category", () => {
    const doc = validDoc({
      steps: [{ id: "s1", tokens: [{ id: "t1", iconId: "knife", category: "not-a-category" }] }],
    });
    expect(() => migrate(doc)).toThrow(/missing or invalid steps/);
  });

  // Every `TokenCategory` member listed here explicitly - if `TokenCategory`
  // (model/instruction.ts) gains or loses a member without this object being
  // updated to match, TypeScript itself fails the build (a `Record` literal
  // requires exactly the union's keys, no more, no less). That makes this
  // list a compiler-enforced mirror of the type, independent of - and not
  // copied from - migrate.ts's own internal `TOKEN_CATEGORIES` array.
  const allTokenCategories: Record<TokenCategory, true> = {
    action: true,
    object: true,
    tool: true,
    quantity: true,
    warning: true,
    time: true,
  };

  it.each(Object.keys(allTokenCategories) as TokenCategory[])(
    // Regression test for the still-open known-issues.md item ("token/
    // attachment vocabulary enumerated in seven places, two of them already
    // disagreeing"): migrate.ts's own `TOKEN_CATEGORIES` array is hand-copied
    // from the `TokenCategory` type, so it can silently fall out of sync. If
    // it ever drops a category `TokenCategory` still declares, this is the
    // test that catches it - independently of the array above.
    "accepts a token in category %s",
    (category) => {
      const doc = validDoc({
        steps: [{ id: "s1", tokens: [{ id: "t1", iconId: "some-icon", category }] }],
      });
      expect(() => migrate(doc)).not.toThrow();
    },
  );
});
