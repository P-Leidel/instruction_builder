# Task 20 — Add Automated Testing: Implementation Plan

> 🗄️ **Doc status: HISTORICAL — superseded (2026-09-13).** Task 20 shipped
> the same day this was written, following the plan below essentially as-is
> (Decision: option A). See
> [../progress/task-20-automated-testing.md](../progress/task-20-automated-testing.md) for
> what actually shipped, including the two things that changed from this
> plan during implementation: the drift-regression test in
> `model/migrate.test.ts` ended up using a compiler-enforced
> `Record<TokenCategory, true>` rather than directly comparing two arrays
> (since `migrate.ts`'s `TOKEN_CATEGORIES` was deliberately not exported just
> for a test), and the connector-line tests in `lib/canvas-layout.test.ts`
> assert path start/end coordinates and curve-vs-straight shape rather than
> a full exact path string, so they survive future tuning of the drawing
> constants. Kept as-is (not edited) as the planning record; per
> [../../milestones.md](../../milestones.md#documentation-status-conventions),
> this is the point where a task's planning discussion moves into
> the Progress Log rather than staying live in its own file.

Date: 2026-09-13. Written before any Task 20 code exists, informed by
[../../known-issues.md](../../known-issues.md) and [../../planned-additions.md](../../planned-additions.md)
so the first test suite doesn't fight either doc's already-recorded
decisions. Task 20's own scope, per
[../../project-plan.md](../../project-plan.md):
"Cover the instruction model, undo/redo, and export pipeline with unit tests
using Vitest (native to the Vite toolchain, no separate test runner needed),
run in CI."

## Decision needed before starting: Vitest vs. the pinned Vite version

Confirmed while prepping this plan (see `Known-Issues.md`'s vite/esbuild
entry, extended 2026-09-13): the only `vitest` versions compatible with this
project's pinned `vite@^5.4.11` are the 2.x-4.x line, and every one of them
depends on a version of `@vitest/mocker` carrying a **critical** advisory
([GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9)) -
arbitrary file read, but only exploitable while Vitest's own UI server
(`vitest --ui`) is running, which nothing in this plan uses. The only fix is
`vitest@5.0.0`, which requires `vite@^6.4.0 || ^7 || ^8` - the same major
Vite jump the vite/esbuild entry already defers for unrelated reasons.

Two ways forward - **pick one before step 1 below**:

- **A. Accept it, same as the existing vite/esbuild entries (recommended).**
  Install `vitest@2.1.9`, document the advisory in `Known-Issues.md` exactly
  like the dev-server ones (already drafted there), and revisit alongside a
  real reason to bump Vite - not as an isolated upgrade forced by a test
  runner. Consistent with how this project has already decided to handle
  every other dev-only advisory against this same pinned Vite version.
- **B. Do the Vite major upgrade first.** Bumps `vite@^5.4.11` to `^8`,
  fixing all of `Known-Issues.md`'s open vite/esbuild/vitest advisories at
  once, but is a breaking-change upgrade explicitly out of scope for every
  prior task, unrelated to "add automated testing" on its own merits, and
  risks destabilizing a project that otherwise builds cleanly today.

This plan assumes **A** everywhere below; if the answer is **B**, do the
Vite upgrade (and a full regression run of `run-instruction-builder`'s
driver afterward) as its own step 0 first.

## What's already done (prerequisite architecture work)

Two `/improve-codebase-architecture` passes were done specifically because
this task's own plan text names them as needed - see `Known-Issues.md` and
`Progress-Log.md`'s "Architecture" sections for the full detail:

- **`state/document.ts` is now constructable.** `createDocumentSession()`
  builds an independent document/selection/undo-redo-history/coalescing-clock
  bundle; every mutator's real logic (`undoCore`, `addStepCore`, ...) takes a
  `DocumentSession` explicitly, grouped as the exported `sessionActions`. The
  running app still uses one `defaultSession` (every existing import from
  `state/document.ts` is unchanged), but a test can now construct its own
  session with `createDocumentSession()` and call `sessionActions.xxx(session, ...)`
  directly - no browser, no shared state with any other test. This was
  the actual blocker: before this, "undo/redo" (this task's own named
  target) had no seam to test through at all.
- **The drag-and-drop protocol lost its duplication**, incidentally also
  producing two small, newly-pure, easily unit-testable helpers:
  `lib/pointer-drag.ts`'s `createClickAfterDragGuard()` and
  `state/document.ts`'s (unexported) `adjustIndexForRemoval()`.

## Unit tests complement the Playwright driver - they don't replace it

Before picking what to write tests for, it's worth being explicit about
something the plan's wording doesn't spell out: **almost everything in this
app already has automated coverage**, via
`.claude/skills/run-instruction-builder`'s Playwright driver - drag-and-drop,
undo/redo, all four export formats, import, persistence, and every
interactive flow are already exercised end-to-end in a real browser, with 35
passing checks as of this writing. Task 20 doesn't need to re-cover any of
that at the unit level to satisfy its own goal.

What the driver *can't* practically cover is fast, fine-grained,
edge-case-level correctness of pure logic - the coalescing window's exact
700ms boundary, `migrate`'s rejection of a dozen different malformed shapes,
`adjustIndexForRemoval`'s off-by-one math at every boundary index, whether
`canvas-layout.ts`'s connector math is right for 1/2/3/7 tokens - each of
which would mean scripting a full browser interaction (or several) just to
exercise one `if` branch. **That's what Vitest is for here**: fast,
in-process, edge-case coverage of pure functions - not a second, slower copy
of what the driver already does well. Anything that needs a real browser to
mean anything (computed-style baking, actual PNG rasterization, real
`window.print()`, real IndexedDB timing) stays the driver's job.

## Scope: what to unit-test, and what to leave to the driver

### In scope - pure logic, no DOM, `vitest run` in plain Node (confirmed: `@preact/signals`'s `signal`/`computed` work with no DOM present - checked directly in a plain `node -e` before writing this plan)

- **`model/instruction.ts`** - `createEmptyDocument`, `createEmptyStep`,
  `createToken`: shape and default-value correctness.
- **`model/migrate.ts`** - `migrate`: accepts a current-schema document
  unchanged, rejects each malformed shape `isValidStep`/`isValidToken` guard
  against (missing/wrong-typed fields, an invalid `category`, a non-array
  `steps`/`tokens`) with a message-bearing `Error`, per file/hunk covered by
  the Import flow already but never at the level of "every individual
  rejection reason." **Also add one regression test the driver structurally
  can't express**: assert `TOKEN_CATEGORIES` (the module-level array here)
  contains exactly the same values as the `TokenCategory` union in
  `model/instruction.ts` - directly targeting the still-open
  `Known-Issues.md` item ("token/attachment vocabulary enumerated in seven
  places, two of them already disagreeing") without doing that item's full
  refactor. This is cheap insurance against a category being added to one
  and not the other.
- **`model/validate.ts`** - `validateStep`/`validateDocument`: exactly which
  input shapes are "complete" vs. flagged, and what `issues` text they
  produce.
- **`state/document.ts`'s `sessionActions`**, via `createDocumentSession()`
  - the centerpiece, and the reason the document-session refactor above
  happened first:
  - `undo`/`redo`: past/future array bookkeeping, the `MAX_HISTORY` cap,
    and `restoreDocument`'s selection-repair (keeping a selection alive
    across an unrelated change, clearing a token selection whose step or
    token no longer exists in the restored snapshot).
  - Coalescing: two `updateStepTitle` calls inside `COALESCE_WINDOW_MS`
    merge into one history entry; two calls further apart than that (or a
    non-coalescing mutator in between) don't. This needs a fake/controlled
    clock (`vi.useFakeTimers()`) rather than a real 700ms sleep per test.
  - `addStep`/`removeStep`/`addTokenToStep`/`moveToken`/`reorderSteps`/
    `removeTokenFromStep`: array mutation correctness, including
    `adjustIndexForRemoval`'s boundary cases (moving to the position
    immediately after/before the dragged item, moving to index 0, moving to
    the end) - exactly the class of case the driver's own Gotchas note it
    only caught by chance once (see "Testing drag-and-drop... needs a real
    drop point, not a boundary tie" in the driver's `SKILL.md`).
  - `attachToToken`/`removeTokenAttachment`/`setTokenTime`/`setStepTime`:
    at-most-one-per-kind replacement behavior.
  - Two independent `createDocumentSession()` instances never share state -
    the actual proof the seam works, not just that the old module-level
    behavior still passes.
- **`lib/canvas-layout.ts`** - `computeCanvasLayout`, `chipPosition`,
  `buildConnectors`, `insertionMarkerPosition`, `widestRowWidth`: pure
  geometry, already the codebase's best example of a deep module (see the
  2026-09-13 architecture review) - straightforward table-driven tests for
  a handful of token counts (0, 1, a full row, a row-wrap case). Write these
  against the general `computeCanvasLayout(steps, isDesktop)` contract, not
  against incidental current constants, so they don't quietly foreclose
  `Planned-Additions.md` item 2 (a second, radial layout module with the
  same shape).
- **`lib/duration.ts`** - `formatDuration`, `splitDuration`, `buildDuration`,
  `sumDurations`: bounds (`MAX_DURATION_DAYS`, `MIN_DURATION_SECONDS`) and
  round-trip correctness (`buildDuration` composed with `splitDuration`).
- **`lib/document-file.ts`'s `slugify` and `parseImportedDocument`** - both
  pure (no `Blob`/`URL`/DOM), unlike `downloadBlob`/`exportDocumentAsJson` in
  the same file (see "out of scope" below). `slugify`'s current
  `"untitled-instructions"` default (from `Known-Issues.md`'s still-open
  filename item) should be asserted as today's actual behavior, not treated
  as a bug to route around in the test.
- **`lib/pointer-drag.ts`'s `createClickAfterDragGuard`** - the small pure
  factory extracted during the drag-and-drop collapse: starts "not dragged,"
  `markDragged()` then `wasJustDragged()` reports true once and resets.

### Out of scope for this pass - already covered end-to-end by the driver, or not meaningfully testable without a real browser

- **`lib/svg-export.ts`/`png-export.ts`/`pdf-export.ts`** - export's value in
  this app is specifically *real* computed-style baking, *real* canvas
  rasterization, and a *real* `window.print()`/`@media print` cascade (see
  `Fixed-Issues.md`'s "naive `XMLSerializer`-only" bug, caught only by
  inspecting an actual downloaded file). jsdom/happy-dom's CSS support is
  known-incomplete for exactly this kind of thing, so a Vitest+jsdom test
  here risks either false confidence (jsdom silently no-ops something a real
  browser wouldn't) or a false failure (jsdom disagrees with Chromium on a
  resolved value that's actually fine) - and the driver already checks the
  real thing (`SVG_EXPORT_IS_SELF_CONTAINED_AND_STYLED`,
  `PNG_EXPORT_IS_RASTERIZED_AT_PIXEL_DENSITY`, `PRINT_STYLESHEET_ISOLATES_READONLY_CANVAS`)
  against real Chromium. Revisit only if a real bug slips through that a
  unit test would have caught more cheaply than the driver did.
- **`state/persistence.ts`** - real IndexedDB timing, including the
  documented, accepted 200ms-window edge case in `Known-Issues.md`
  ("Persistence: an edit within ~200ms of closing/reloading the tab can be
  lost"). Don't write a test that asserts this window doesn't exist - it
  does, it's accepted, and a test enforcing otherwise would just be wrong.
  The driver's `VERSION_MISMATCH_HANDLED_SAFELY`/`PERSISTED_ACROSS_RELOAD`
  checks already cover this module's actual behavior against a real
  IndexedDB.
- **`lib/pointer-drag.ts`'s `beginPointerDrag`/`resolveTokenDropTarget`** -
  real Pointer Events and `elementFromPoint` hit-testing against real
  layout; the driver's real `page.mouse` drag tests already cover this more
  faithfully than a simulated DOM could.
- **Every Preact component** (`InstructionCanvas`, `StepList`,
  `TokenPicker`, ...) - rendering/interaction tests would need
  `@testing-library/preact` plus a DOM environment, a meaningfully bigger
  step the plan's "instruction model, undo/redo, and export pipeline"
  wording doesn't ask for, and the driver already exercises every one of
  them end-to-end. Worth reconsidering only if a future task's plan
  explicitly calls for component-level tests.

## Mechanics

- **Package**: `vitest@2.1.9` (per the Decision above), as a devDependency.
  No `jsdom`/`happy-dom` needed for this pass's scope - everything in scope
  runs in Vitest's default Node environment (confirmed above).
- **Config**: a standalone `vitest.config.ts` (not merged into
  `vite.config.ts`, which only configures the app's own build/dev-server and
  the Preact plugin - nothing in this pass's scope needs JSX or the Preact
  plugin, since it's all plain `.ts`, not `.tsx`). `test.environment: "node"`
  (the default, but explicit), `test.include` matching colocated
  `src/**/*.test.ts` files.
- **Style**: explicit `import { describe, it, expect, vi } from "vitest"` in
  each test file rather than enabling `globals: true` - matches this
  codebase's existing explicit-import style everywhere else (no ambient
  globals convention exists today).
- **Script**: `"test": "vitest run"` in `package.json` - a one-shot run
  (not watch mode), matching how `lint`/`typecheck`/`build` already run
  once and exit, suitable for both CI and an agent driving it directly.
- **CI**: add `- run: npm test` to `.github/workflows/ci.yml`, after
  `npm run typecheck` and before `npm run build` (fail fast on logic errors
  before spending time on a production bundle) - the one line this repo's CI
  is currently missing to satisfy this task's explicit "run in CI"
  requirement.
- **File placement**: colocated next to the module under test (e.g.
  `src/model/migrate.test.ts`), matching where `document.ts`'s own planned
  test file was already anticipated in the Candidate 1 architecture review
  (`src/state/document.test.ts`).

## Skills: nothing to add yet, one thing to extend once tests exist

No new skill is warranted *before* Task 20 starts - there's no command to
document yet, and writing one now would mean paraphrasing this plan instead
of recording something actually run (the exact anti-pattern
`run-skill-generator` warns against). Once `npm test` exists and has
actually been run successfully, the right move is to **extend the existing
`run-instruction-builder` skill**, not create a separate one: add `npm test`
to its "Build" section alongside `lint`/`typecheck`/`build` (all four are
one-shot, exit-code-driven checks with no browser involved), and update its
frontmatter `description:` to mention unit tests. A separate skill would
duplicate this one's existing Prerequisites/Gotchas sections for no benefit,
since both ultimately answer "how do I verify a change to this app."

## Step-by-step

1. Resolve the Vitest/Vite decision above (A or B).
2. Add `vitest` + `vitest.config.ts` + the `test` script.
3. Write tests for `model/instruction.ts`, `model/migrate.ts` (including the
   `TOKEN_CATEGORIES`-vs-`TokenCategory` regression test),
   `model/validate.ts`.
4. Write tests for `state/document.ts`'s `sessionActions` via
   `createDocumentSession()` - undo/redo, coalescing (fake timers),
   selection-repair, every mutator, `adjustIndexForRemoval` boundary cases,
   and session independence.
5. Write tests for `lib/canvas-layout.ts`, `lib/duration.ts`,
   `lib/document-file.ts`'s `slugify`/`parseImportedDocument`, and
   `lib/pointer-drag.ts`'s `createClickAfterDragGuard`.
6. Add `npm test` to `.github/workflows/ci.yml`.
7. Extend `run-instruction-builder`'s `SKILL.md` to mention `npm test`.
8. Update `Milestones.md` (Task 20 ✅), `Progress-Log.md` (new "What
   shipped" section, Verification bullet, Files-touched section), and
   `Known-Issues.md` (fold this plan's "Decision needed" section into
   whichever option was actually taken, replacing the "Task 20 will need to
   either accept this... or do the Vite major upgrade first" line with what
   happened) - same pattern every prior task followed.
