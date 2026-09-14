import { migrate } from "../model/migrate";
import type { InstructionDocument } from "../model/instruction";

/** Slugifies a title into a safe filename stem, falling back when nothing usable remains. */
export function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "untitled-instructions";
}

/**
 * Triggers a browser download of `blob` under `filename` via a `Blob`
 * object URL and a synthetic `<a download>` click - the one download
 * mechanic every export format (JSON now; SVG/PNG, tasks 15-16) shares, so
 * it's factored out here (and exported for `lib/svg-export.ts`) rather than
 * repeated per format.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

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
