# Architecture: closing out the 2026-09-14 review's four candidates

> 📌 **Doc status: CURRENT** — one file in the
> [Phase 2 Progress Log](./README.md).

All four candidates from a 2026-09-14 `/improve-codebase-architecture`
review, archived as-generated at
[../audits/2026-09-14-internal-architecture-review.html](../audits/2026-09-14-internal-architecture-review.html).
The report's own claims (file/line references, "zero coverage" assertions)
were checked against the actual source first and found fully accurate
before anything below was built - none contradicted an existing ADR (none
exist yet in this project). Three were implemented the same day; the
fourth (`InstructionCanvas.tsx`) needed no remediation - the deletion test
didn't support splitting it further, so the review closed it out rather
than leaving it open.

## `moveStepUp`/`moveStepDown`: an intent-level seam over `reorderSteps`

`reorderStepsCore`'s `toIndex` parameter means "a splice target computed
against the array *before* the moved item is removed" - not "where it
should end up." Two real callers had to reason about that convention
themselves: `StepList.tsx`'s drag handler (which happens to naturally
produce the right value via `resolveDropIndex`) and task 22's Move up/down
buttons (which had to hand-derive `index - 1`/`index + 2`, justified by an
8-line comment explaining why `+ 2`, not the more obvious `+ 1`).

Added `moveStepUp(stepId)`/`moveStepDown(stepId)` to `sessionActions`
(`state/document.ts`) - each resolves the step's current index from its id,
guards the boundary case (a no-op moving the first step up or the last
step down, independent of `StepList.tsx` already disabling those buttons),
and calls the existing `reorderStepsCore` with the correct pre-removal
index internally. `StepList.tsx`'s buttons now call these directly; the
justification comment for `+ 2` moved to `moveStepDownCore` itself, where
the fact it explains actually lives now. `reorderSteps` (the raw primitive)
stays exported - the drag handler still needs it, since its drop index is
already computed in the right convention by `resolveDropIndex`.

5 new Vitest tests (`document.test.ts`): moving up swaps with the
predecessor, moving down swaps with the successor, moving up on the first
step is a no-op, moving down on the last step is a no-op, and both are a
no-op for an unknown `stepId`.

## A guardrail for the exported chip's style-baking allowlist

`svg-export.ts`'s `BAKED_STYLE_PROPS` is a hand-maintained list of exactly
which CSS properties get inlined onto an exported SVG/PNG - correct today,
but with no seam back to the `global.css` rules it's implicitly describing.
A future visual property added to `.instruction-canvas__chip*` that isn't
already on the list would silently vanish from every export, the same
silent-drift shape as the two real `public/sw.js` bugs task 23 found, just
not yet shipped.

`BAKED_STYLE_PROPS` is now exported (previously module-private), and a new
`src/lib/svg-export.test.ts` parses `global.css` itself (a small
brace-matching extractor, not a real CSS parser - this stylesheet is flat
enough that one isn't needed), collects every property set on any
`.instruction-canvas__*` rule, and asserts each one is either on the
allowlist or in a short, explicit "known non-visual" set (`display`,
`width`, `height`, `cursor`, `outline`, `outline-offset`, `touch-action`,
`margin` - properties that are layout/interaction-only, or (width/height)
already handled a different way, by `cloneCanvasForExport`'s explicit
attributes). Confirmed to actually catch drift, not just pass by
construction: temporarily adding `opacity: 0.9` to `.instruction-canvas__chip`
failed the test as expected, before being reverted.

This is a deliberate, narrow exception to task 20's rule that the export
pipeline stays covered by the Playwright driver, not Vitest - unlike the
rest of `svg-export.ts`, this one check never touches the DOM, it's pure
text parsing of a static file.

Reading `global.css` for the test needed `node:fs`/`node:path`/`node:url`,
which needed `@types/node` (new devDependency, types-only, no runtime
footprint) - a Vite `?raw` import was tried first to avoid adding it, but
Vitest mocks any `.css`-extensioned import to an empty string by default
regardless of query suffix (confirmed directly: `globalCss.length` was
`0`), so reading the file straight off disk was simpler than carving out a
`test.css` config exception for one file.

## Splitting `public/sw.js`'s routing policy from its execution glue

The `fetch` handler fused two different kinds of decision in one ~35-line
function: pure routing policy (the same-origin/GET filter, the
`only-if-cached`+`navigate` passthrough guard, network-first-vs-cache-first)
and execution glue (`.clone()` timing, `event.waitUntil` wrapping,
`caches.match`/`caches.put` sequencing) - exactly why both real bugs task
23 found could only be caught by manually driving a real browser against a
production build, not by any automated check.

Two remediation options were on the table, with a real tradeoff between
them - a *thorough* one (author the worker as `src/sw.ts` via a new Vite
build entry, so the routing logic could live in `src/lib/sw-strategy.ts`
with a real colocated Vitest test) and a *pragmatic* one (extract the
decision as its own named function inside `sw.js` for locality only, no
build change, accepting that `pwa-check.mjs`'s existing integration-level
checks stay the regression surface for this module). **The pragmatic
option was chosen** - this project has deliberately kept `public/sw.js` as
a zero-build static file since task 23, and a build-pipeline change wasn't
judged worth it for one file's internal locality.

`chooseStrategy(request)` is now a standalone function taking only a
`Request` - no `self`/`caches`/`event` access - and returning one of
`"passthrough"`/`"network-first"`/`"cache-first"`. The `fetch` listener
just calls it and switches on the result; `cachePut` (the clone/waitUntil
mechanics) is unchanged. The interface is smaller (one function, three
possible return values, easy to reason about or hand-check against a
plain `Request` object) even though nothing about *what* the module does
changed - a pure locality/readability cut, not a new capability.

Verified behavior-preserving, not by a new unit test (there still isn't
a build step that would let one import `chooseStrategy` from a test - see
above), but by `pwa-check.mjs` against a fresh production build: manifest/
icons reachable, service worker takes control, the runtime cache
populates on a second visit, and the app still loads fully offline - all
passing identically before and after the split.

## Verification

`npm run lint`, `npm run typecheck`, `npm test` (113 tests, up from 107),
and `npm run build` all pass. A full Playwright driver run against the dev
server passed all 39 checks with `CONSOLE_ERRORS_COUNT=0`, including
`STEP_REORDERED_VIA_KEYBOARD` and `STEP_MOVE_BUTTONS_DISABLED_AT_BOUNDARIES`
(task 22's own driver checks, now exercising `moveStepUp`/`moveStepDown`
instead of raw `reorderSteps` calls, since `StepList.tsx`'s buttons
changed underneath them without changing their own behavior). `pwa-check.mjs`
against a fresh production build passed all its checks after the `sw.js`
split, identical to before it.

## Files touched

- `src/state/document.ts` - `moveStepUpCore`/`moveStepDownCore`, wired into
  `sessionActions` and the bound exports.
- `src/components/StepList/StepList.tsx` - Move up/down buttons call the
  new verbs instead of computing `reorderSteps`' pre-removal index
  themselves.
- `src/state/document.test.ts` - 5 new tests.
- `src/lib/svg-export.ts` - `BAKED_STYLE_PROPS` exported.
- `src/lib/svg-export.test.ts` (new).
- `public/sw.js` - `chooseStrategy` extracted from the `fetch` listener.
- `package.json` - `@types/node` added as a devDependency.
