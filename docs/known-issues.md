# Known Issues

> 📌 **Doc status: CURRENT** — living doc, evergreen across phases. Update
> it directly whenever an issue is found, fixed, or newly deferred; see
> [milestones.md](./milestones.md#documentation-status-conventions) for
> what CURRENT/HISTORICAL mean project-wide.

Tracked, intentionally-deferred issues that `npm run lint`/`typecheck`/`build`
don't surface. Not a replacement for fixing bugs promptly - only for things
noted and deliberately left alone.

## `vite`/`esbuild`/`vitest` dev-only vulnerabilities (3 moderate, 1 high, 1 critical; not fixed)

- **What it is:** `npm audit` reports a cluster of advisories against the
  existing `vite@^5.4.11` dependency (not introduced by any Phase 2
  addition - first surfaced 2026-09-13 by `npm audit` after adding
  `playwright`, and still the same underlying dependency after later adding
  `lucide-static` and `idb-keyval`):
  - [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99) (moderate, CVSS 5.3) - the bundled `esbuild` (`<=0.24.2`) dev server doesn't validate request origin, so any website a developer visits can send it requests and read the response.
  - A `vite` advisory group (rolled up by `npm audit` as "high") covering: path traversal in optimized-deps `.map` handling, an `server.fs.deny` bypass via Windows alternate data streams, and an NTLMv2 hash disclosure in `launch-editor` via UNC path handling on Windows.
- **Where it applies:** `npm run dev` (the local dev server) and, for the
  Windows-specific ones, only while running that dev server on Windows -
  plus, as of Task 20, `npm test`/`vitest run` (the critical `vitest`
  advisory below is a devDependency-only, UI-server-only risk, not present
  in the dev server itself). None of these affect `npm run build`'s output -
  the production static bundle never runs `esbuild`'s or Vite's dev server,
  nor any part of `vitest`.
- **Why it's not fixed:** `npm audit fix --force` would upgrade `vite` to
  `8.3.0`, a major-version jump (current: `^5.4.11`) with breaking changes,
  for vulnerabilities that only matter while actively running the dev
  server locally (this machine is Windows, so the Windows-specific ones are
  worth noting, but still dev-only). Deferred deliberately rather than
  accepted as safe indefinitely - revisit alongside a real reason to touch
  the Vite version (e.g. a Phase 2 task that needs a newer Vite feature),
  rather than as an isolated upgrade.
- **This also affects `vitest`, now a real `devDependency` as of Task 20.**
  Confirmed 2026-09-13 while prepping Task 20 (Automated Testing): the only
  `vitest` versions compatible with the pinned `vite@^5.4.11` are the 2.x-4.x
  line, every one of which depends on a version of `@vitest/mocker` with a
  **critical** advisory ([GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9)),
  arbitrary file read when Vitest's own UI server (`vitest --ui`) is
  listening - a mode this project never invokes (`npm test` runs `vitest
  run`, a one-shot CLI pass with no server). The fix is `vitest@5.0.0`,
  which requires `vite@^6.4.0 || ^7 || ^8` - the same major jump this entry
  already defers. Decided 2026-09-13 (with explicit sign-off, after the
  option was first tried, rolled back, and re-confirmed unavoidable at any
  compatible version) to accept this one exactly like the two above: `vitest@2.1.9`
  is installed, and this is now the accepted, understood state rather than a
  gap - revisit alongside the same eventual Vite major upgrade, not in
  isolation.
- **First noted:** 2026-09-13.

## Design debt flagged by an external architecture audit, one item still deferred

An external architecture-review report (a third-party HTML document, not the
`code-reviewer` subagent) was checked line-by-line against the actual source
on 2026-09-13 and found to be fully accurate. Archived as-received at
[phase-2/audits/2026-09-13-external-architecture-audit.html](./phase-2/audits/2026-09-13-external-architecture-audit.html). One finding from it (a live
data-loss bug on a document schema-version mismatch) was fixed immediately -
see [fixed-issues/schema-version-mismatch-data-loss.md](./fixed-issues/schema-version-mismatch-data-loss.md). A second (lifting the canvas's pure
layout geometry out of `InstructionCanvas` into its own module,
`lib/canvas-layout.ts`) was folded into Task 15 (SVG Export) as planned and
is done - see [planned-additions.md](./planned-additions.md) item 2 and
[phase-2/progress/task-15-svg-export.md](./phase-2/progress/task-15-svg-export.md). A third - "document
session tied to module-level singletons" - was resolved 2026-09-13 via a
`/improve-codebase-architecture` pass: `state/document.ts`'s undo/redo
history, coalescing clock, and selection-repair logic are now constructed by
`createDocumentSession()` rather than living only as module-level signals
and `let`s, so a second, fully independent session (for a test, or a future
embedded instance of the app) can exist alongside the app's own without
sharing state - see [CONTEXT.md](../CONTEXT.md)'s "Document session" entry
and [phase-2/progress/architecture-document-session-refactor.md](./phase-2/progress/architecture-document-session-refactor.md) for the shape of
the change. Every existing consumer of `state/document.ts` kept importing
the same names unchanged, verified by a full clean run of
`.claude/skills/run-instruction-builder`'s driver (35/35 checks,
`CONSOLE_ERRORS_COUNT=0`) after the refactor. This was prep work, not Task
20 itself - no test runner was added (see that task's own note below on
why) and no unit tests exist yet; it only makes writing them possible.
A fourth - "drag-and-drop protocol duplicated across four modules" - was
also resolved 2026-09-13, in the same `/improve-codebase-architecture`
session, as three surgical fixes rather than a full redesign:
`lib/pointer-drag.ts`'s `TokenDropTarget` and `state/drag.ts`'s `DropTarget`
(structurally identical, same comment copied verbatim) are now one type -
`state/drag.ts` imports `TokenDropTarget` instead of declaring its own copy,
since nothing outside that file ever referenced `DropTarget` by name
(confirmed by grep before merging); the module-level `justDragged` flag
independently declared in both `StepList.tsx` and `TokenPicker.tsx` is now
one shared `createClickAfterDragGuard()` factory in `lib/pointer-drag.ts`,
a plain function (not a hook) to match that file's existing style; and the
"drop-before index in the pre-removal array" adjustment, previously
hand-written once each in `moveTokenCore`/`reorderStepsCore`
(`state/document.ts`), is now one unexported `adjustIndexForRemoval` helper
in that file. `InstructionCanvas.tsx`'s own inline drag-orchestration block
was deliberately left alone - its click-vs-drag handling is genuinely
different (no `onClick`/`justDragged` at all; the decision is folded
directly into `onDrop`'s `wasDrag` check), so folding it into the same
shared helper as `StepList`/`TokenPicker` would have meant adding a branch
for a case that doesn't need one. Verified the same way as the document-
session fix: a full clean driver run (35/35 checks, `CONSOLE_ERRORS_COUNT=0`)
after the change, with no call-site changes needed anywhere outside the
five files actually touched. See
[phase-2/progress/architecture-drag-drop-protocol-collapse.md](./phase-2/progress/architecture-drag-drop-protocol-collapse.md) for the full file list.
The remaining item is still deliberately deferred:

- **Token/attachment vocabulary enumerated in seven places, two of them
  already disagreeing** - `TokenCategory` (`model/instruction.ts`) is
  hand-copied into `TOKEN_CATEGORIES` (`model/migrate.ts`), and
  `ATTACHMENT_CATEGORIES` (`TokenAttachmentPicker.tsx`, `["quantity",
  "warning"]`) and `ATTACHMENT_KINDS` (`TokenDetails.tsx`, `["warning",
  "quantity"]`) already list the same two values in reversed order - not yet
  user-visible since both drive tab-set membership, not tab order, but a
  live drift, not a hypothetical one. Separately, a Quantity's amount and
  unit are fused into one display string at attach time
  (`` `${amount} ${unit}` `` in `TokenAttachmentPicker.tsx`) with nothing
  that decomposes it back apart, so a quantity can never be re-edited as a
  number+unit once attached. Deferred - the audit's own assessment is that
  this is weaker than the other candidates (deleting it moves the complexity
  back into three render sites rather than removing it) and it earns its
  keep more clearly once a real content-pack system needs one place to
  extend the vocabulary - now Phase 4 task 32 (Formalize the Content-Pack
  Shape), per the 2026-09-14 Phase 3/4 reprioritization (see
  [project-plan.md](./project-plan.md#implementation-plan)), not Phase 3.
  A 2026-09-14 internal architecture review (see
  [phase-3/audits/2026-09-14-architecture-review.html](./phase-3/audits/2026-09-14-architecture-review.html))
  sharpened this further: `units.ts`'s and `instruction.ts`'s own comments
  ("a non-food domain can offer a different unit list without this file's
  shape needing to change," "kept generic so Phase 4 content packs can
  extend it without changing this interface") are each accurate about
  their own narrow scope, but neither warns that `TokenCategory` itself,
  or any of its four hand-copied arrays above, are *not* part of that
  swappable surface - a real domain swap touches code in at least four
  places, not just a data file. Worth keeping in mind when task 32 is
  scoped, so it doesn't start from a rosier picture than what's actually
  there.
- **First noted:** 2026-09-13.

## Category tab-strip duplicated between `TokenPicker` and `TokenAttachmentPicker`

- **What it is:** the `role="tablist"` block - markup, classes
  (`token-picker__tab`/`token-picker__grid`), `aria-selected`/
  `aria-controls` wiring, and active-class toggling - is hand-copied
  between `TokenPicker.tsx` (lines ~46-60) and `TokenAttachmentPicker.tsx`
  (lines ~89-103), differing only in the category array, the active-
  category signal, and the tab list's `aria-label`. Two real adapters of
  the same shape, not sharing a seam. Flagged as the "Strong" candidate in
  the 2026-09-14 internal architecture review (see
  [phase-3/audits/2026-09-14-architecture-review.html](./phase-3/audits/2026-09-14-architecture-review.html)) -
  it directly increases the cost of the roving-tabindex/arrow-key fix
  already deferred above ("Two accessibility gaps"), since that fix would
  currently need to be hand-applied twice, in sync.
- **Why it's not fixed now:** purely an internal-cohesion issue with zero
  user-facing effect - real users in task 30 (Test Real Users) can't
  perceive whether these two pickers share a module. Deferring costs
  nothing extra (the duplication is stable and well-understood, not
  actively drifting further), while fixing it now would mean touching two
  components right before publish for no product benefit, and its main
  payoff (cheaper roving-tabindex fix) is itself prep for another deferred
  item with no scheduled date.
- **Revisit when:** Phase 4 task 32 (Formalize the Content-Pack Shape)
  actually starts - that work will very plausibly touch both components
  anyway when generalizing the category vocabulary, so the tab-strip
  extraction should be shaped by real content-pack requirements at that
  point rather than guessed now and possibly redesigned later.
- **First noted:** 2026-09-14.

## Two accessibility gaps deliberately left for a later pass

Raised and scoped with the user before task 22 (Add Accessibility
Features) started; both were explicitly out of scope for that task, which
shipped keyboard alternatives for step reordering and token *selection*
only - see
[phase-2/progress/task-22-accessibility-features.md](./phase-2/progress/task-22-accessibility-features.md).

- **No keyboard way to reorder a token within a step, or move it to a
  different step.** Both are drag-and-drop only (task 9). Step reordering
  got Move up/down buttons this task specifically because the project plan
  called it out by name; token movement didn't, and doing it well (moving
  *to* a specific step, not just up/down within one) needs its own small
  design pass rather than reusing the step pattern as-is.
- **`TokenPicker`/`TokenAttachmentPicker`'s category tabs (`role="tablist"`/
  `role="tab"`) don't implement the WAI-ARIA APG Tabs pattern's roving
  tabindex + arrow-key navigation** - every tab sits in the normal Tab
  order and activates on Enter/Space like a plain button, so they're fully
  keyboard-operable, just not via the idiomatic Left/Right-arrow-to-switch,
  Tab-to-leave convention some screen reader users expect once they hear
  `role="tab"` announced. Deferred as lower-impact than the two functional
  gaps task 22 did fix (color contrast, the token/import-input keyboard
  paths); worth revisiting if a real screen-reader user reports friction
  with it.
- **First noted:** 2026-09-14.

## Full canvas/step list re-render on any edit anywhere in the document

- **What it is:** `InstructionCanvas.tsx` and `StepList.tsx` both read
  `document.value.steps` directly in their component body, so editing one
  step (typing a title, attaching a warning, moving a token) re-renders
  the *entire* canvas/step list - every step, not just the one that
  changed. This is the one place this app's `@preact/signals`-based
  "fine-grained reactivity" (see
  [project-plan.md](./project-plan.md#technology-stack)) isn't actually
  exercised; `selectedStep`/`selectedToken` (`state/document.ts`) get this
  right via `computed()` + referential stability, these two components
  don't.
- **Why it's not fixed:** raised and investigated during task 24
  (Optimize Performance) - see
  [phase-2/progress/task-24-performance.md](./phase-2/progress/task-24-performance.md#investigated-not-fixed-whole-document-signal-subscription).
  The seemingly-obvious fix (split each component into a per-step child
  that reads the relevant signals directly) doesn't actually work today:
  `lib/canvas-layout.ts`'s `computeCanvasLayout` recomputes every step's
  `cardY` from scratch on every edit (each step's vertical position
  depends on every step above it), so per-step layout objects have no
  referential stability to split components around - a per-step split
  would still re-render every step after the edited one, just via a
  different mechanism. A real fix needs `computeCanvasLayout` reworked for
  incremental per-step stability first - a real change to an
  already-tested layout module, deferred because the re-render cost it
  would save is small at this app's actual scale (dozens of DOM nodes,
  where Preact's diffing is already cheap without memoization).
- **Revisit if:** a real document grows far beyond "a handful of steps,
  each with a handful of tokens" (the scale this app and its testing are
  built around), or if `computeCanvasLayout` ever needs reworking for
  another reason (e.g. the radial-layout idea in
  [planned-additions.md](./planned-additions.md#2-radial-steps-point-to-a-center-goal-canvas))
  and per-step stability could be picked up as a side effect of that work
  rather than its own isolated cost.
- **First noted:** 2026-09-14.

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
