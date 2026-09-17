import { describe, it, expect } from "vitest";
import { parseImportedDocument } from "./document-file";
import { createEmptyDocument } from "../model/instruction";

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
