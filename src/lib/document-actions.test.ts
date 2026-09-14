import { describe, it, expect } from "vitest";
import { readImportFile } from "./document-actions";
import { createEmptyDocument } from "../model/instruction";

// Only `readImportFile` is covered here - every other export in
// document-actions.ts drives a real SVG/canvas/`window.print()`, which
// this app's Vitest scope deliberately leaves to the Playwright driver
// (see docs/phase-2/plans/task-20-automated-testing-plan.md). `readImportFile`
// has no DOM/download side effect of its own - it's a thin, pure-ish
// wrapper around `parseImportedDocument` (already covered in
// document-file.test.ts) and `validateDocument`, which is exactly what
// this extraction (2026-09-14 architecture review remediation) was for.
describe("readImportFile", () => {
  it("returns the parsed document and its incomplete-step count on success", async () => {
    const doc = createEmptyDocument(); // one step, no tokens - incomplete
    const file = new File([JSON.stringify(doc)], "recipe.json", { type: "application/json" });

    const result = await readImportFile(file);

    expect(result).toEqual({ ok: true, document: doc, incompleteCount: 1 });
  });

  it("returns a user-safe error and no document for unparseable JSON", async () => {
    const file = new File(["{not json"], "recipe.json", { type: "application/json" });

    const result = await readImportFile(file);

    expect(result).toEqual({ ok: false, error: "That file isn't valid JSON." });
  });

  it("returns a user-safe error for valid JSON that isn't a valid document", async () => {
    const file = new File([JSON.stringify({ hello: "world" })], "recipe.json", {
      type: "application/json",
    });

    const result = await readImportFile(file);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/Not a valid instruction file/);
  });
});
