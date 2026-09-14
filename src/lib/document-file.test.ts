import { describe, it, expect } from "vitest";
import { slugify, parseImportedDocument } from "./document-file";
import { createEmptyDocument } from "../model/instruction";

describe("slugify", () => {
  it("lowercases and hyphenates a title", () => {
    expect(slugify("My Grandma's Recipe")).toBe("my-grandma-s-recipe");
  });

  it("trims leading/trailing hyphens left over from stripped punctuation", () => {
    expect(slugify("  -- Weird Title! --  ")).toBe("weird-title");
  });

  it("falls back to 'untitled-instructions' when nothing usable remains", () => {
    // Matches today's actual default document title (docs/known-issues.md's
    // still-open filename item) - this is current behavior, not a bug to
    // route around here.
    expect(slugify("Untitled instructions")).toBe("untitled-instructions");
    expect(slugify("!!!")).toBe("untitled-instructions");
    expect(slugify("")).toBe("untitled-instructions");
  });
});

describe("parseImportedDocument", () => {
  it("parses and validates a well-formed document", () => {
    const doc = createEmptyDocument();
    const result = parseImportedDocument(JSON.stringify(doc));
    expect(result).toEqual(doc);
  });

  it("rejects unparseable text with a user-safe message", () => {
    expect(() => parseImportedDocument("{not json")).toThrow("That file isn't valid JSON.");
  });

  it("rejects valid JSON that isn't a valid document, via migrate", () => {
    expect(() => parseImportedDocument(JSON.stringify({ hello: "world" }))).toThrow(
      /Not a valid instruction file/,
    );
  });
});
