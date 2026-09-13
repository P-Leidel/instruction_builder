# Known Issues

> 📌 **Doc status: CURRENT** — living doc, evergreen across phases. Update
> it directly whenever an issue is found, fixed, or newly deferred; see
> [Milestones.md](./Milestones.md#documentation-status-conventions) for
> what CURRENT/HISTORICAL mean project-wide.

Tracked, intentionally-deferred issues that `npm run lint`/`typecheck`/`build`
don't surface. Not a replacement for fixing bugs promptly - only for things
noted and deliberately left alone.

## `vite`/`esbuild` dev-server vulnerabilities (1 moderate, 1 high; not fixed)

- **What it is:** `npm audit` reports a cluster of advisories against the
  existing `vite@^5.4.11` dependency (not introduced by any Phase 2
  addition - first surfaced 2026-09-13 by `npm audit` after adding
  `playwright`, and still the same underlying dependency after later adding
  `lucide-static` and `idb-keyval`):
  - [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99) (moderate, CVSS 5.3) - the bundled `esbuild` (`<=0.24.2`) dev server doesn't validate request origin, so any website a developer visits can send it requests and read the response.
  - A `vite` advisory group (rolled up by `npm audit` as "high") covering: path traversal in optimized-deps `.map` handling, an `server.fs.deny` bypass via Windows alternate data streams, and an NTLMv2 hash disclosure in `launch-editor` via UNC path handling on Windows.
- **Where it applies:** only `npm run dev` (the local dev server) and, for
  the Windows-specific ones, only while running that dev server on Windows.
  None of these affect `npm run build`'s output - the production static
  bundle never runs `esbuild`'s or Vite's dev server.
- **Why it's not fixed:** `npm audit fix --force` would upgrade `vite` to
  `8.3.0`, a major-version jump (current: `^5.4.11`) with breaking changes,
  for vulnerabilities that only matter while actively running the dev
  server locally (this machine is Windows, so the Windows-specific ones are
  worth noting, but still dev-only). Deferred deliberately rather than
  accepted as safe indefinitely - revisit alongside a real reason to touch
  the Vite version (e.g. a Phase 2 task that needs a newer Vite feature),
  rather than as an isolated upgrade.
- **First noted:** 2026-09-13.

## JSON export always downloads as "untitled-instructions.json"

- **What it is:** `InstructionDocument.meta.title` exists in the model and is
  what task 18's export filename is derived from (slugified), but no UI
  anywhere lets the user set it - it's created once, at document creation,
  as the literal string `"Untitled instructions"`, and nothing ever writes
  to it afterward. Every export from every document a user ever makes
  downloads as the same `untitled-instructions.json`, colliding in a
  Downloads folder the moment someone exports a second document.
- **Why it's not fixed:** raised during task 18/19 implementation and
  deliberately deferred rather than bolting on a document-title input as an
  ad hoc addition - a proper place for it (a document-settings area, likely
  alongside `meta.domain` once Phase 3's content packs make that field
  meaningful too) is a small, separate, intentional piece of UI, not a
  side effect of the export task.
- **First noted:** 2026-09-13.

## Persistence: an edit within ~200ms of closing/reloading the tab can be lost

- **What it is:** `state/persistence.ts` (task 12) debounces saves to
  IndexedDB by 200ms so a burst of keystrokes coalesces into one write. If
  the tab is reloaded or closed within that window, the pending write is
  lost - the page's JS realm is torn down before the debounce timer fires.
- **Why it's not fully fixed:** a `visibilitychange`/`pagehide` listener
  attempts to flush the pending save immediately, but this turned out not
  to reliably survive a same-tab `reload()` in Chromium either - the async
  IndexedDB write gets abandoned mid-flight once navigation commits, which
  is a browser limitation (`pagehide` guarantees synchronous cleanup can
  run, not that async work started there completes), not something fixable
  from page script. Found via an automated test that reordered a step and
  reloaded immediately with no pause - a real user closing a tab seconds
  (not milliseconds) after their last keystroke does not hit this.
- **Mitigation in place:** the debounce is kept short (200ms, down from an
  initial 500ms) specifically to shrink this window to something no
  realistic usage pattern hits, and the flush listeners still help for
  legitimate backgrounding (switching tabs, mobile app-switching), where
  the browser keeps the page process alive briefly rather than tearing it
  down instantly.
- **First noted:** 2026-09-13.
