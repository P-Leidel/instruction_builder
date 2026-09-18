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
 * How long an export's object URL is left alive after its download click.
 * Long enough that even a slow device finishing a multi-page PDF has
 * unambiguously taken the blob off our hands, short enough that the blob
 * isn't pinned in memory for the rest of the session. The exact number
 * doesn't matter - what matters is that it isn't the same task as the
 * click; see `downloadBlob`.
 */
const REVOKE_DELAY_MS = 60_000;

/**
 * Triggers a browser download of `blob` under `filename` via a `Blob`
 * object URL and a synthetic `<a download>` click - the one download
 * mechanic every export format (JSON, SVG, PNG, PDF) shares. Originally
 * lived in `document-file.ts` (the JSON-specific module) back when JSON was
 * the only format that existed; moved here once every other format module
 * ended up importing a JSON-named file just for this and `slugify` (2026-09-17
 * remediation - see
 * docs/phase-3/reviews/2026-09-17-whole-codebase-audit-evaluation.md item 7).
 *
 * The anchor is put in the document before it's clicked, and the revoke is
 * deferred rather than run on the next line (2026-09-18 architecture
 * review, finding 9). Chromium tolerates a detached anchor and a
 * same-task revoke; Safari - iOS Safari especially, and especially for a
 * blob as large as a multi-page PDF - has a long history of cancelling the
 * transfer when the URL dies before it has been handed off, which surfaces
 * to the user as "I pressed Export and nothing happened". This path had
 * only ever been exercised on desktop Chromium when tablet and phone
 * testing started, and it sits behind all four export formats, so the one
 * failure it can produce is both invisible and total. Three lines, no
 * behavior change where it already worked.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}
