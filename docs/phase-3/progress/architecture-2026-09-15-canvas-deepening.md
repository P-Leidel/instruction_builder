# Architecture: 2026-09-15 canvas deepening

> 📌 **Doc status: CURRENT** — one file in the
> [Phase 3 Progress Log](./README.md).

Date: 2026-09-15

A fresh, unbiased `/mattpocock-skills:improve-codebase-architecture` pass
focused specifically on the canvas
([InstructionCanvas.tsx](../../../src/components/InstructionCanvas/InstructionCanvas.tsx)
and [lib/canvas-layout.ts](../../../src/lib/canvas-layout.ts)), deliberately
not re-confirming anything already tracked in
[known-issues.md](../../known-issues.md) or
[planned-additions.md](../../planned-additions.md), and reconsidering
whether `InstructionCanvas.tsx` (cleared with no remediation in the
2026-09-14 review) still held up. It surfaced three candidates, written up
in full with before/after diagrams at
[docs/phase-3/audits/2026-09-15-canvas-architecture-review.html](../audits/2026-09-15-canvas-architecture-review.html):
deepening `canvas-layout.ts` so `computeCanvasLayout` is the module's whole
interface, extracting `<StepCard>`/`<TokenChip>` from `InstructionCanvas`'s
render tree, and naming the two-stage select/drag decision as its own
testable function. The first was picked, per the report's own top
recommendation (the other two build on it).

## What shipped

A `/mattpocock-skills:grilling` session settled the shape before any code
changed. Two design forks mattered:

- **`insertionMarkerPosition` stays a separate, exported seam.** It depends
  on live drag state (`dropTarget`, which changes on every pointer move) -
  folding it into `computeCanvasLayout` (memoized on `[steps, isDesktop]`
  only) would force either a full canvas relayout on every drag hover, or
  threading drag state into that memo's dependencies. Different volatility,
  different seam.
- **`chipPosition`, `buildConnectors`, and `widestRowWidth` become private.**
  `computeCanvasLayout` is now the module's real interface - every chip
  position, connector path, and centering offset a step needs comes back on
  its `StepLayout`, as three new fields: `chipPositions: ChipPosition[]`,
  `connectors: ConnectorSegment[]`, `tokensOffsetX: number`. `tokensOffsetX`
  (previously computed inline in `InstructionCanvas.tsx` from
  `widestRowWidth` + the shared `canvasWidth`) needed a genuine second pass
  inside `computeCanvasLayout`: it depends on `canvasWidth`, which itself
  depends on every step's widest row, so it can only be filled in once the
  first pass has seen the whole document.

`InstructionCanvas.tsx` no longer imports or calls any canvas-layout
primitive directly - it destructures `chipPositions`/`connectors`/
`tokensOffsetX` straight off each `StepLayout` in its render loop.

`canvas-layout.test.ts`'s ~11 tests that called the now-private primitives
directly were ported through `computeCanvasLayout`, keeping the same
precision (exact coordinates, exact SVG path strings) rather than
consolidating into coarser checks - one geometry case (the curved
row-wrap bend) had actually been tested with a synthetic `chipsPerRow=1`
that can't occur through real app usage (desktop's chipsPerRow is a fixed
6; mobile's always equals the step's own token count, so it never wraps at
all) - ported instead using a 7-token desktop step, the one way a wrap
genuinely happens. `insertionMarkerPosition`'s own tests, which used to
cross-check against `chipPosition` directly, now assert inline numeric
expectations instead, since that comparison function is no longer public.

## Verification

- `npm run lint` / `typecheck` / `test` (119 tests, up from 118 - one new
  case covering `chipPositions` array length) / `build` all pass cleanly.
- Full 44-check Playwright driver run against the dev server: all checks
  true/0/0, including `CONNECTOR_COUNT`, `INSERTION_MARKER_VISIBLE_MID_DRAG`,
  `FORWARD_TOKEN_DRAG_LANDS_AT_DROP_POINT`, and
  `ACCESSIBILITY_VIOLATIONS_MAIN_EDITOR=0` - the checks most likely to
  catch a geometry regression from this refactor specifically.
- Read actual screenshots from that run (chip layout, centering, badges,
  connector lines, a mid-drag insertion marker) rather than trusting the
  driver's boolean output alone.

## What's next

See [README.md](./README.md) for Phase 3's overall status. The other two
candidates from the 2026-09-15 review (`<StepCard>`/`<TokenChip>`
extraction, naming the select/drag decision) remain unexplored - the report
itself expected #1 to be tackled first since the other two build on it.
