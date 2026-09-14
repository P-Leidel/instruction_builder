# Tasks 5–12 — Early Build

> 📌 **Doc status: CURRENT** — one file in the
> [Phase 2 Progress Log](./README.md). Covers tasks 5, 6, 7, 8, 9–10, and
> 12, plus the product additions and tooling work that landed alongside
> them.

### Task 5 — UI Layout

- `App` shell split into a toolbar (`.app__toolbar`) and a main region (`.app__main`) with a mobile-first single column that becomes a CSS Grid on desktop (`min-width: 800px`).
- Region placement is driven entirely by `grid-template-areas` in `global.css`, so reordering panels later is a CSS-only change — validated in practice this session when a third and fourth panel (`step-details`, `token-details`) were added without touching any component markup.

### Task 6 — Instruction Canvas (native SVG)

- `InstructionCanvas` replaced the Phase 1 HTML prototype (`StepBuilder`, deleted). Each step renders as an SVG group: a background card, a numbered "select" badge (keyboard-focusable, `role="button"`), an incomplete-step flag, and one chip per token (glyph + label + a remove control).
- Accessibility: the outer `<svg>` uses `role="group"` (not `role="img"`, which would hide focusable children from the accessibility tree); the badge is a sibling of the token chips, not a wrapper around them, so no interactive element is nested inside another.
- **Bug found and fixed:** SVG elements need a lowercase `tabindex` attribute — writing the HTML/React-conventional `tabIndex={0}` in JSX makes Preact set a literal, unrecognized `tabIndex` attribute on SVG nodes, silently making them unreachable via Tab with no console error. Caught by a dedicated keyboard-focus check in the Playwright driver, not by code review. See the [Fixed Issues log](../../fixed-issues/svg-canvas-tabindex-casing.md).

### Step and token authoring (beyond the original task list)

The user proposed five product changes mid-session; four were approved and built (the fifth — an auto-generated `.md` export — was explicitly discarded in favor of sticking with the already-planned JSON export):

- `InstructionStep` gained a user-authored `title` (shown in `StepList` instead of a token summary) and kept its existing `description`.
- A new **Step details** panel (`StepDetails`) edits the selected step's title/description and lists its tokens with each one's description.
- `sample-tokens.ts` gained a one-line, app-authored `description` per token (e.g. "Cut into small pieces with a knife."), shown read-only in both Step details and Token details.
- **Two-stage canvas selection**, added after the above: clicking anywhere on a step that isn't already selected (background, badge, or a token) selects the step; clicking a token on an *already-selected* step selects that token instead. A new **Token details** panel (`TokenDetails`), stacked below Step details, edits the selected token's title and a new user-authored `note` field (kept distinct from the app-given description). Selection state is centralized behind `selectStep`/`selectToken` helpers in `state/document.ts` so the two signals (`selectedStepId`, `selectedTokenId`) can't drift out of sync.

### Mobile canvas sizing ("for now," easy to revisit)

- The canvas SVG's rendered width is bounded with `clamp(480px, 100%, 960px)`, keeping icons legible without shrinking illegibly small or growing oversized, regardless of container width.
- Below the desktop breakpoint, each step's tokens render in a single row instead of wrapping (a `useIsDesktop()` hook mirroring the existing `800px` CSS breakpoint), with horizontal scroll as the overflow fallback. Both the clamp bounds and the single-row choice are isolated on purpose so they're cheap to change later.

### Tooling and process

- Added Playwright (`chromium`, since the machine's Edge install is broken) and a new project skill, `.claude/skills/run-instruction-builder/` (`SKILL.md` + `driver.mjs`), so future sessions can build/launch/drive the app and take verified screenshots instead of re-deriving the setup.
- `eslint.config.js` now ignores `.claude/` (Node-targeted agent tooling, not browser app source).
- `docs/known-issues.md` documents a moderate `esbuild`/Vite dev-server CORS advisory surfaced by `npm audit` after adding Playwright — deliberately not fixed (dev-server only; the real fix is a major Vite version bump deferred until there's an independent reason to touch it).
- The "update on every keystroke" performance question was discussed and answered with options, but nothing was implemented — no regression exists today, and the user didn't ask for a change.

### Task 7 — Icon Library

- Bundled [Lucide](https://lucide.dev) icons (`lucide-static`, ISC license — permissive, same spirit as the plan's "MIT" note) replace the placeholder unicode glyphs everywhere: canvas chips, the token picker, and Step/Token details.
- Each icon is imported individually by path (`lucide-static/icons/<name>.svg?raw`), not the whole set, so Vite only bundles the ~17 the app actually uses. `data/icon-library.ts` strips each file's outer `<svg>` wrapper down to just the inner path markup and re-exports it for two different hosts: `InstructionCanvas` inlines it directly as a `<g>` (already inside an `<svg>` document), while the new `Icon` component wraps the same markup in its own `<svg>` for plain-HTML contexts.
- Inlining path markup (rather than referencing icon files with `<image href>`) is deliberate: a future SVG export (task 15) that serializes the canvas DOM needs to be self-contained, and an `<image>` reference to an app-internal file path wouldn't resolve once the exported file is opened elsewhere.
- Icon choices are approximate where Lucide has no literal match (there's no "onion" or "oven" icon) — swapping any single mapping later only touches `icon-library.ts`, never the model, since tokens only ever store a stable `iconId` string.

### Task 8 — Live Preview

- A "Preview" toggle in the toolbar swaps the whole editor for a read-only `InstructionCanvas` — the exact same SVG component with a `readOnly` prop, not a second rendering pipeline. Read-only mode drops every editing affordance (remove controls, drag, click-to-select, keyboard focus on the badge) and leaves only the numbered badges and chips, standing in for "what this looks like exported" ahead of the real export pipeline (tasks 15–17).

### Task 9 — Drag-and-Drop, and Task 10 — Touch Support

- A small shared Pointer Events tracker (`lib/pointer-drag.ts`) — not the HTML5 Drag-and-Drop API, which has unreliable touch support — powers three drag interactions: dragging a token from the picker directly onto any step's canvas area (no need to pre-select a step first), dragging an existing canvas token to move it within or between steps, and dragging a step in the list to reorder it. Drop targets are resolved via `elementFromPoint` against `data-step-id`/`data-token-index` attributes rendered by the canvas.
- A quick tap with no real pointer movement still runs the existing plain click behavior (add-to-selected-step, select) — the tracker reports whether the pointer moved past a small threshold, so tap and drag share the same `pointerdown` without one breaking the other. Native `<button>` elements (TokenPicker, StepList) keep their `onClick` for keyboard activation, guarded by a same-tick flag so a completed drag's trailing synthetic click doesn't also fire it.
- Since Pointer Events already unify mouse/touch/pen, task 10 was mostly verification plus `touch-action: none` on the draggable elements (token chips, picker buttons, step-list items) so a touch-drag doesn't also scroll the page.
- A floating label (`DragGhost`) follows the pointer during a drag, and the step currently hovered as a drop target gets a dashed highlight.

### Task 12 — Data Persistence

- `state/persistence.ts` auto-saves the document to IndexedDB via `idb-keyval`, debounced. Storage availability is feature-detected by actually round-tripping a value (not just checking `"indexedDB" in window`, which is true even in Safari private browsing where writes are blocked/capped — the exact risk the plan calls out) — when that fails, a visible toolbar banner warns the user their changes won't survive closing the tab, rather than losing work silently.
- `main.tsx` awaits the initial load before the first render, so the default empty document never flashes on screen only to be overwritten a moment later once the saved one loads.
- **Bug found and fixed:** `selectedStepId` initializes (at module load, before the async storage read resolves) against the throwaway default document's first step. Loading a saved document without also reselecting its first step left `selectedStepId` pointing at a step id that no longer existed, so nothing appeared selected after a reload. Fixed by having `initPersistence` call `selectStep` on the loaded document's first step. See the [Fixed Issues log](../../fixed-issues/stale-step-selection-after-persisted-load.md).
- **Limitation found, only partly fixable, documented:** an edit made within the debounce window before closing/reloading the tab can be lost, because the pending `setTimeout` never fires once the page is torn down. A `visibilitychange`/`pagehide` listener attempts an immediate flush, but this doesn't reliably survive a same-tab `reload()` in Chromium either — the async IndexedDB write gets abandoned mid-navigation, a browser limitation, not something fixable from page script. Mitigated by shrinking the debounce from an initial 500ms to 200ms, small enough that no realistic usage pattern hits it; see [../../known-issues.md](../../known-issues.md).

### Token connector lines and live drag insertion marker (beyond the original task list)

Before building this, three possible future features were discussed and deliberately deferred - see [../../planned-additions.md](../../planned-additions.md) (warnings rendered inside their related token; a radial "steps point to a center goal" canvas; per-connection line style/labels). None of them required a change before proceeding.

- A plain thin line is drawn between each pair of consecutive tokens within a step, in array order; steps stay visually separate (no lines between steps). Purely a rendering computation from token order - no new stored data.
- On desktop, when a step's tokens wrap onto a second row, the connector bends: down from the last chip's row, across to the first chip's row, instead of breaking the chain or cutting a diagonal across the step.
- While dragging a token, the step being hovered now shows a live insertion-point marker at the exact slot it would land in (using the same index `resolveTokenDropTarget` already computed for the drop itself), not just a highlight on the whole step - `state/drag.ts`'s `dropTargetStepId` signal became `dropTarget: { stepId, index } | null` to carry this.
- **Two bugs found and fixed, both in the row-wrap bend specifically:** see the [Fixed Issues log](../../fixed-issues/README.md) for the full write-ups - an invisible-line bug (fixed by widening the gap and darkening the stroke) and a "wraps read as one long bar" bug (fixed by routing the bend through the gap between the two specific rows it connects).
- **Token block centering**, added right after: a step's tokens (chips, connectors, and the insertion marker) are now horizontally centered within the step card instead of flush against its left edge - a short step on the same full-width card as a long one previously looked lopsided, all its empty space pushed to one side. Computed per step, from that step's own widest row, so a 2-token step centers within the same card width a 6-token step fills edge-to-edge; the badge and incomplete-flag stay anchored to their fixed corners.
- **Rounded connector corners**, added right after: the row-wrap bend's two 90° corners are now rounded. First attempt was `stroke-linejoin: round` (pure CSS, no path change) - technically applied but imperceptible, since its rounding radius is tied to the 2px stroke width. Fixed properly by building an explicit radius (`CONNECTOR_CORNER_RADIUS = 8`) into the path itself with quadratic Bezier (`Q`) segments at each corner, independent of stroke width - confirmed visible via tightly-cropped screenshots of each corner.
- **Connector lead-out stub**, added right after: the row-wrap bend now pokes out `CONNECTOR_LEAD_OUT = 8` units past the last chip in a row before curving down, so it reads as a distinct line rather than one starting flush against (and blending into) the chip's own border. The canvas's overall width calculation now reserves this same amount of extra margin, so the stub can never poke past a step card's own right border even when a row's width exactly matches the canvas's widest content - verified with a full 6-per-row (maximum width) case specifically.

### Design system and visual refresh (beyond the original task list)

Before this, the app used ad hoc hardcoded colors/radii scattered across `global.css`. All colors, radii, and shadows now live in `:root` CSS custom properties (`--color-accent`, `--color-canvas-bg`, `--radius-lg`, etc.), so a retheme is a one-place edit going forward. The canvas panel got its own tinted background (`--color-canvas-bg`), distinct from both the plain app background and the white side panels, with white step cards sitting on top of it — step/row layout mechanics (left-aligned, growing right, wrapping) are untouched; this is a colors-only change. TokenPicker's flat per-category list became a `role="tablist"` of category tabs (`activeTokenCategory` in `state/ui.ts`) so the vocabulary can grow without every category's grid showing at once.

Two connector-line follow-up fixes, both reported from screenshots - see the [Fixed Issues log](../../fixed-issues/README.md) for the full write-ups: the row-wrap bend's lead-out stub only existed on the source side (mirrored to fix); and multiple wrap bends in the same step looked inconsistently "tight" (a rendering-scale issue, not a geometry bug, fixed by raising the corner radius and lead-out to 12).

### Token attachments — Quantity, Warning, and Time (beyond the original task list)

> ⚠️ **Superseded by [Quantity and Time rework](./quantity-and-time-rework.md).**
> This section is kept for history (it's what shipped first), but Quantity
> and Time were both significantly reworked afterward - see that file for
> current behavior before relying on anything below.

Implements [Planned Addition #1](../../planned-additions.md) (warnings rendered inside their related token, deferred earlier this session), generalized per the user's request: Quantity and Warning moved out of "Add to step" entirely, and a new Time category joined them — all now attached *to* a token instead of standing on their own as a step-level chip.

- `InstructionToken` gained three optional fields — `quantity`/`warning`/`time`, each a `TokenAttachment` (`{ iconId, label? }`; no `id`/`note`/`metadata`, since it's never independently ordered, dragged, or a connector-line endpoint). At most one of each kind per token; attaching a second of the same kind replaces the first (`state/document.ts`'s `attachToToken`/`attachToSelectedToken`/`removeTokenAttachment`, built on a shared `setTokenAttachment`).
- A new **"Add to token"** panel (`TokenAttachmentPicker`), stacked below "Add to step" in the same grid column, offers Quantity/Warning/Time as its own tab set (`activeAttachmentCategory` in `state/ui.ts` — a separate signal so switching tabs in one picker never affects the other). Click-only by design, no drag: attaching only makes sense once a token is already selected, so there's no drop-target ambiguity to resolve. Shows a placeholder message instead of tabs when no token is selected.
- On the canvas, an attachment renders as a small, non-interactive corner badge on its parent token's existing chip — warning top-left, quantity bottom-left, time bottom-right — leaving the remove control's top-right corner untouched and the chip's 96×56 size and every row/wrap layout calculation unchanged. Badges show in both the editor and read-only preview, since they're instruction content, not an editing affordance.
- Token details lists each attachment (icon + label) with its own remove button, since the tiny canvas badge has no room for one and isn't interactive — this is the only way to remove an attachment.
- A new Time sample set (30 sec/1 min/5 min/10 min/30 min) reuses one `clock` icon throughout — a duration reads fine as text alone, unlike Warning's per-value icons (thermometer vs. triangle-alert).

## Files touched

- `src/model/instruction.ts` — added `InstructionStep.title`, `InstructionToken.note`.
- `src/state/document.ts` — added `selectedTokenId`/`selectedToken`, `selectStep`/`selectToken`, `addTokenToStep`/`moveToken`/`reorderSteps`, `updateStepTitle`/`updateStepDescription`/`updateTokenLabel`/`updateTokenNote` mutators; existing mutators updated to keep selection state consistent.
- `src/state/ui.ts` — new: `previewMode` signal (task 8).
- `src/state/drag.ts` — new: `dragGhost` and `dropTarget` (`{ stepId, index } | null`) signals (task 9); `dropTarget` carries an index so the canvas can render a live insertion-point marker, not just a step-level highlight.
- `src/state/persistence.ts` — new: `initPersistence`/`persistenceStatus`, IndexedDB auto-save via `idb-keyval` (task 12).
- `src/lib/pointer-drag.ts` — new: shared Pointer Events drag tracker and drop-target resolver (tasks 9–10).
- `src/data/icon-library.ts` — new: resolves `iconId` to bundled Lucide path markup (task 7).
- `src/app.tsx` — renders `StepDetails`, `TokenDetails`, `DragGhost`, the Preview toggle, and the persistence warning banner alongside the existing panels.
- `src/main.tsx` — awaits `initPersistence()` before the first render.
- `src/components/Icon/Icon.tsx`, `src/components/DragGhost/DragGhost.tsx` — new.
- `src/components/InstructionCanvas/InstructionCanvas.tsx` — new in the previous update (replaces deleted `StepBuilder`); revised again for real icons, a `readOnly` prop, drag-and-drop, connector lines, and the live insertion marker; `CHIP_GAP` widened 8 → 16 for line visibility.
- `src/components/StepDetails/StepDetails.tsx`, `src/components/TokenDetails/TokenDetails.tsx` — use `Icon` instead of the removed glyph text.
- `src/components/StepList/StepList.tsx` — shows step title; selection goes through `selectStep`; drag-to-reorder.
- `src/components/TokenPicker/TokenPicker.tsx` — uses `Icon`; drag-to-add alongside the existing tap-to-add; no longer disabled when no step is selected (a drop target says where a dragged token goes).
- `src/data/sample-tokens.ts` — added per-token `description`; dropped the placeholder unicode `glyph` field.
- `src/styles/global.css` — toolbar/grid layout (now three left panels plus the preview toggle), panel chrome, canvas styles (including the icon color, drop-target highlight, and `touch-action: none` on draggable elements), Step/Token details styles, mobile clamp, drag-ghost and persistence-warning styles.
- `src/vite-env.d.ts` — new: `/// <reference types="vite/client" />`, needed for `?raw` SVG imports.
- `eslint.config.js` — ignore `.claude/`.
- `package.json` — added `playwright`, `lucide-static`, `idb-keyval`.
- `.claude/skills/run-instruction-builder/driver.mjs`, `SKILL.md` — driver extended to cover icons, drag-and-drop (including the live insertion marker), connector lines, preview, and persistence-across-reload; a new Gotcha documents that DOM/style inspection alone missed the line-visibility bug.
- `docs/planned-additions.md` — new: three discussed-but-not-built ideas (attached warnings, a radial canvas, per-connection line style/labels) and what each would require later.
- `docs/known-issues.md` — new in the previous update; the `vite`/`esbuild` entry broadened to the fuller advisory list `npm audit` reports, and a new entry documents the persistence debounce edge case.
- `docs/phase-1/ux-and-wireframes.md` — fixed the token-category order in the wireframe to match `TokenPicker`.
- `src/components/StepBuilder/` — deleted (superseded by `InstructionCanvas`).
- `src/model/instruction.ts` — added the `time` `TokenCategory`, the `TokenAttachment` type, and `InstructionToken.quantity`/`warning`/`time`.
- `src/data/sample-tokens.ts` — added `CATEGORY_LABELS` (moved here from `TokenPicker.tsx` so both pickers share one copy) and five Time samples.
- `src/data/icon-library.ts` — added the `clock` icon, mapped to all five `time.*` ids.
- `src/state/ui.ts` — added `activeAttachmentCategory`.
- `src/state/document.ts` — added `AttachmentKind` and `setTokenAttachment`/`attachToToken`/`attachToSelectedToken`/`removeTokenAttachment`.
- `src/components/TokenPicker/TokenPicker.tsx` — restricted to action/object/tool/note categories (quantity/warning moved out); imports the now-shared `CATEGORY_LABELS` instead of defining its own copy.
- `src/components/TokenAttachmentPicker/TokenAttachmentPicker.tsx` — new: the "Add to token" panel.
- `src/components/TokenDetails/TokenDetails.tsx` — lists the selected token's attachments with a remove button each.
- `src/components/InstructionCanvas/InstructionCanvas.tsx` — renders attachment corner badges (originally `ChipBadge`, later split into `WarningBadge`/`QuantityBadge` - see [quantity-and-time-rework.md](./quantity-and-time-rework.md)); `CONNECTOR_CORNER_RADIUS`/`CONNECTOR_LEAD_OUT` raised 8 → 12; row-wrap path mirrored with a lead-in stub; canvas-width margin reservation doubled accordingly.
- `src/app.tsx` — renders `TokenAttachmentPicker` alongside the existing panels.
- `src/styles/global.css` — full `:root` design-token system (color/radius/shadow custom properties); canvas background distinguished from the app/panel backgrounds; category-tab, chip-badge, and token-details-attachment-list styles; new `panel-token-attachments` grid area.
- `.claude/skills/run-instruction-builder/driver.mjs` — step-token flow swapped Sharp! → Knife (Warnings is no longer available at step level); new attach/verify/remove segment covering "Add to token."
