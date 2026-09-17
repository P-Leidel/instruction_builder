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
 * mechanic every export format (JSON, SVG, PNG, PDF) shares. Originally
 * lived in `document-file.ts` (the JSON-specific module) back when JSON was
 * the only format that existed; moved here once every other format module
 * ended up importing a JSON-named file just for this and `slugify` (2026-09-17
 * remediation - see
 * docs/phase-3/reviews/2026-09-17-whole-codebase-audit-evaluation.md item 7).
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
