import { migrate } from "../model/migrate";
import type { InstructionDocument } from "../model/instruction";
import { downloadBlob, slugify } from "./download";

/**
 * Triggers a browser download of `doc` as a pretty-printed JSON file (task
 * 18) - the exact `InstructionDocument` shape, no wrapper, so re-importing
 * the same file round-trips to an identical document (see
 * docs/phase-1/architecture.md 2.5: "no transformation needed since the
 * model is already plain data").
 */
export function exportDocumentAsJson(doc: InstructionDocument): void {
  const json = JSON.stringify(doc, null, 2);
  downloadBlob(new Blob([json], { type: "application/json" }), `${slugify(doc.meta.title)}.json`);
}

/**
 * Parses and validates an imported file's raw text (task 19). `JSON.parse`
 * failures and `migrate`'s shape-validation failures both surface as one
 * plain `Error` with a message that's safe to show directly to the user.
 */
export function parseImportedDocument(text: string): InstructionDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  return migrate(parsed);
}
