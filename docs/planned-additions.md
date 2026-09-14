# Planned Additions (Discussed, Not Implemented)

> 📌 **Doc status: CURRENT** — living doc, evergreen across phases. Update
> it directly whenever an idea here is built, dropped, or a new one is
> raised; see [milestones.md](./milestones.md#documentation-status-conventions)
> for what CURRENT/HISTORICAL mean project-wide.

Recorded 2026-09-13, after discussing three possible future features before
implementing the token-connector-lines feature (see
[phase-2/progress/tasks-05-12-early-build.md](./phase-2/progress/tasks-05-12-early-build.md)). None of these are
built. This doc exists so a later decision can be checked against them -
**if a future change would conflict with or foreclose one of these, say so
before making it**, rather than silently making it harder to build later.

## 1. Warnings rendered inside their related token — ✅ Implemented 2026-09-13

Built, generalized beyond the original idea: Quantity and Warning (and a
new Time category) all moved out of "Add to step" into a separate "Add to
token" menu, and render as small corner badges on the token they're
attached to rather than as their own chip. See
[phase-2/progress/tasks-05-12-early-build.md](./phase-2/progress/tasks-05-12-early-build.md) for what shipped -
`InstructionToken.quantity`/`warning`/`time` (`TokenAttachment`, at most
one of each per token) is the "attached-to" relationship this item said
would be needed, and it turned out not to require any special-casing in
drag hit-testing or the connector lines, since an attachment was never a
chip, drop zone, or line endpoint to begin with - only ever a badge drawn
inside its parent token's existing chip.

## 2. Radial "steps point to a center goal" canvas

An alternative layout where every step arranges around a central goal node
instead of stacking vertically.

- **Why not now:** no concrete need yet, just a possibility raised.
- **What it needs:** a new/parallel canvas renderer (different geometry,
  hit-testing, and line-routing) reusing the existing document/selection/
  drag state. The document model itself needs no changes - it stores no
  position/layout data, only an ordered step/token list - so this is a
  rendering-layer addition, not a data migration.
- **Watch for:** any future code outside `InstructionCanvas` (e.g. the
  export pipeline, tasks 15-17) that assumes there is exactly one canvas
  layout shape, rather than treating layout as a pluggable renderer over
  the same document.
- **Update 2026-09-13 (raised):** exactly this was confirmed by an external
  architecture audit - about 250 of `InstructionCanvas.tsx`'s 591 lines were
  pure, unexported geometry functions (`chipPosition`, `stepHeight`,
  `widestRowWidth`, `buildConnectors`, `insertionMarkerPosition`), and the
  drag hit-test already recovers that same geometry back out of the DOM via
  `elementFromPoint` + `data-step-id`/`data-token-index`
  (`lib/pointer-drag.ts`) instead of querying it directly. See
  [known-issues.md](./known-issues.md) for the fuller audit context.
- **Update 2026-09-13 (done, as part of Task 15):** the geometry now lives
  in `lib/canvas-layout.ts` - `computeCanvasLayout(steps, isDesktop)` is the
  one entry point, document + a desktop/mobile flag in, positioned layout
  out - and `InstructionCanvas` only renders what it returns. This is a real
  step toward "layout as a pluggable renderer": a radial layout could now be
  a second module with the same `computeCanvasLayout` shape, without
  touching `InstructionCanvas`'s render logic. Two things from the "after"
  picture are **not** done, on purpose (scope boundary agreed before
  starting Task 15): the drag hit-test still queries the DOM
  (`elementFromPoint` + `data-*`) rather than the layout module directly,
  and SVG export (`lib/svg-export.ts`) works by serializing the real
  rendered DOM of a hidden read-only canvas (with computed styles baked in -
  see [fixed-issues/svg-export-unstyled-shapes.md](./fixed-issues/svg-export-unstyled-shapes.md)) rather than an independent
  renderer reading `CanvasLayout` data directly - so a genuinely different
  layout (like this radial idea) would still need its own rendering path,
  just not its own geometry math. Revisit both if a second layout or a
  hit-test bug ever makes the DOM round-trip actually cost something.

## 3. Per-connection line style, or labeling a line as an action

Letting the user pick a line's style (solid/dashed/arrow) per connection,
or attach a text label to one specific line.

- **Why not now:** the connector-lines feature being built now derives
  every line purely from token array order - no connection has its own
  identity or stored data.
- **What it needs:** a schema-additive field holding per-connection
  metadata (e.g. keyed by the pair of token ids it connects), plus UI to
  select/edit it. Low-risk to add later - the model's schema-versioning
  strategy (docs/phase-1/architecture.md section 2.3) is built for exactly
  this: an old saved document simply won't have the field, and gets
  default behavior.
- **Watch for:** the connector-line rendering code drifting somewhere that
  has no natural per-pair lookup point (e.g. a single hardcoded style
  constant with no per-index branch) - keep it simple, but keep it a loop
  over pairs, not a single flat style applied all at once.

## Assessment as of this writing

None of the three require a change before implementing the connector-lines
feature described in phase-2/progress/tasks-05-12-early-build.md - it's scoped in a way that
doesn't foreclose any of them (see "Watch for" above per item). No action
suggested right now.
