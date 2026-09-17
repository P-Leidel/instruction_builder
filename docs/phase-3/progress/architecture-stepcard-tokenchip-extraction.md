# Architecture: extract `StepCard` and `TokenChip`

> 📌 **Doc status: CURRENT** — one file in the
> [Phase 3 Progress Log](./README.md).

Date: 2026-09-17

Candidate #1 ("Decompose the canvas's per-step render into StepCard and
TokenChip modules") from the 2026-09-17 copy-paste-and-PDF follow-up
architecture review (see
[phase-3/audits/2026-09-17-copy-paste-and-pdf-followup-review.html](../audits/2026-09-17-copy-paste-and-pdf-followup-review.html)),
itself carrying forward the same candidate from the 2026-09-15
canvas-followup review and the 2026-09-16 review before that -
`InstructionCanvas.tsx` had sat at 602 lines, untouched, through three
straight reviews naming this the top recommendation. A
`/mattpocock-skills:grilling` session settled the shape first: nesting
(`StepCard` owns the tokens-area and renders `TokenChip` inside it, matching
the DOM's actual structure rather than flattening it), interface shape
(each takes a small prop set built around the layout data it already needs,
not a destructured pile of scalars), action/drag-signal access (direct
import from `state/document`/`state/drag`, matching every other component
in this codebase - no component here has ever taken those as props, and
nothing needed to change that), where `canMoveUp`/`canMoveDown`/
`canReorder`/`canRemove` get computed (kept in `StepCard`, not pushed into
`computeCanvasLayout`, since that module's own comment declares it
deliberately read-only-agnostic), file placement (nested under a
single-consumer's folder rather than getting a top-level folder of its own -
the same convention `SvgButton.tsx` already established, as opposed to
`CollapsedField`'s top-level-folder convention for a component with two
consumers), and sequencing (two separately verified extractions, leaf
first).

A same-day `/mattpocock-skills:code-review` (Standards axis) caught one
follow-up: the first pass had read "nested under a single-consumer's
folder" too literally and put `TokenChip.tsx` in a new
`src/components/StepCard/` folder (since `StepCard` is its sole consumer) -
which meant that folder held `TokenChip.tsx` but no `StepCard.tsx`, and both
files' imports read backwards (`StepCard.tsx` reaching into `../StepCard/
TokenChip`). Fixed by flattening: the single-consumer rule keys off
*consumer count*, not render-tree depth, and `StepCard` itself still only
has one consumer (`InstructionCanvas`) - so `TokenChip.tsx` moved up beside
`StepCard.tsx` and `SvgButton.tsx` in `src/components/InstructionCanvas/`,
which now reads as the whole step/token rendering cluster's implementation
in one flat, unambiguous folder.

## What shipped

`TokenChip` (`src/components/InstructionCanvas/TokenChip.tsx`) was extracted first:
chip markup, the `WarningBadge`/`QuantityBadge` sub-components (moved in
with it - neither had a second consumer), and the pointerdown →
`beginPointerDrag` → `resolveTokenPointerOutcome` switch that drives both
in-step reordering and cross-step moves. Its interface is `token`,
`position` (`ChipPosition`), `tokenIndex`, `stepId`, `isStepSelected`,
`isTokenSelected`, `readOnly` - six small values, no action/signal props.
Verified alone (lint/typecheck/test/build + a full Playwright driver run),
then `StepCard` (`src/components/InstructionCanvas/StepCard.tsx`) was
extracted second, now wrapping the already-separate `TokenChip`: step
chrome (select badge, title, incomplete flag, remove, reorder-drag-handle,
move up/down) plus the tokens-area wrapper (connectors, the live insertion
marker, the `tokensOffsetX` transform). Its interface is the whole per-step
`StepLayout` object `computeCanvasLayout` already produces, plus `index`,
`stepCount` (total step count - distinct from `index`, needed for
`canMoveDown`/`canReorder`/`canRemove`), `canvasWidth`, `readOnly`, and the
canvas's own `svgRef` (needed only to resolve a reorder drag's drop index).

`InstructionCanvas.tsx` dropped from 602 lines to 198: its whole per-step
render is now `{layouts.map((layout, index) => <StepCard key={layout.step.id} .../>)}`,
and it no longer imports anything from `lib/pointer-drag.ts`,
`data/icon-library.ts`, or most of `lib/canvas-layout.ts`'s constants -
those moved to whichever new module actually uses them.

## Tests

No new test file - matching the `SvgButton` extraction before it, this
codebase has zero component-level render tests; UI behavior is verified
through the Playwright driver against the real dev server, and both new
components' entire behavior (select, remove, reorder/move, drag, badges)
was already covered by existing driver checks that exercise
`InstructionCanvas`'s rendered output, not its internal structure - moving
that output's implementation into two child components changes nothing the
driver observes.

## Verification

- `npm run lint` / `npm run typecheck` / `npm test` (141 tests, unchanged -
  a component-only decomposition with no `lib`/`state` logic touched) /
  `npm run build` all clean, run separately after each of the two
  extractions.
- Full Playwright driver run against the dev server after each extraction:
  all checks `true`/`0`/`0` both times, identical to the pre-refactor
  baseline - including token select/remove/drag (both within-step reorder
  and cross-step move, with the insertion marker visible mid-drag), step
  select/remove/reorder/move-up/move-down (including the keyboard path and
  disabled-at-boundaries check), Warning/Quantity badges, and every export
  format.
- Screenshots read directly after each run to confirm no visual
  regression - chip badges, connector lines, the incomplete-step flag, and
  step chrome all render identically to before.

## What's next

All four candidates from the 2026-09-15 canvas-followup review and its
2026-09-16/2026-09-17 follow-ups are now closed. Two smaller candidates
from the 2026-09-17 copy-paste-and-PDF review remain open: collapsing
`state/document.ts`'s four free-text mutators
(`updateStepTitleCore`/`updateStepDescriptionCore`/`updateTokenLabelCore`/
`updateTokenNoteCore`) into one `updateStepField`/`updateTokenField`, and
two small duplications introduced by the copy/paste and PDF-pagination
commits (the document-total-time expression repeated between
`InstructionCanvas.tsx` and `document-actions.ts`; the "copy token, show
toast" logic repeated between `TokenDetails.tsx` and `app.tsx`'s `Ctrl+C`
handler). See [README.md](./README.md) for Phase 3's overall status.
