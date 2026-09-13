# Phase 2 Progress Log — Tasks 5 through 12

> 📌 **Doc status: CURRENT** — living log for the in-progress phase, updated
> as tasks land. Per the convention in
> [../Milestones.md](../Milestones.md#documentation-status-conventions),
> this gets frozen with a HISTORICAL banner the day Phase 2 closes out, and
> a new `phase-3/Progress-Log.md` takes over as CURRENT.

Date: 2026-09-13
Scope: everything built since [../phase-1/Status-Report.md](../phase-1/Status-Report.md) declared Phase 1 complete and recommended starting Phase 2 task 5, through task 12 (Data Persistence), plus product additions beyond that task list. See [../Milestones.md](../Milestones.md) for the current phase/task status at a glance, and [../Fixed-Issues.md](../Fixed-Issues.md) for a dedicated log of bugs found and fixed along the way (this doc's "Bug found and fixed" mentions give fuller in-context narrative; Fixed-Issues.md is the scannable, self-contained list).

## Summary

Phase 2 tasks 5–12 are complete: UI Layout, Instruction Canvas, Icon Library, Live Preview, Drag-and-Drop, Touch Support, Tap-to-Insert (carried over from Phase 1), and Data Persistence — plus a set of product additions the user requested on top of the original task list: user-authored step titles/details, app-given token descriptions, a mobile-friendly canvas sizing scheme, and a two-stage step/token selection model with dedicated editor panels for each. `npm run lint`, `npm run typecheck`, and `npm run build` all pass, and every interactive flow (selection, editing, drag-and-drop, preview, persistence, keyboard access, mobile layout) is verified with a Playwright driver rather than by inspection alone.

## What shipped

### Task 5 — UI Layout

- `App` shell split into a toolbar (`.app__toolbar`) and a main region (`.app__main`) with a mobile-first single column that becomes a CSS Grid on desktop (`min-width: 800px`).
- Region placement is driven entirely by `grid-template-areas` in `global.css`, so reordering panels later is a CSS-only change — validated in practice this session when a third and fourth panel (`step-details`, `token-details`) were added without touching any component markup.

### Task 6 — Instruction Canvas (native SVG)

- `InstructionCanvas` replaced the Phase 1 HTML prototype (`StepBuilder`, deleted). Each step renders as an SVG group: a background card, a numbered "select" badge (keyboard-focusable, `role="button"`), an incomplete-step flag, and one chip per token (glyph + label + a remove control).
- Accessibility: the outer `<svg>` uses `role="group"` (not `role="img"`, which would hide focusable children from the accessibility tree); the badge is a sibling of the token chips, not a wrapper around them, so no interactive element is nested inside another.
- **Bug found and fixed:** SVG elements need a lowercase `tabindex` attribute — writing the HTML/React-conventional `tabIndex={0}` in JSX makes Preact set a literal, unrecognized `tabIndex` attribute on SVG nodes, silently making them unreachable via Tab with no console error. Caught by a dedicated keyboard-focus check in the Playwright driver, not by code review.

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
- `docs/Known-Issues.md` documents a moderate `esbuild`/Vite dev-server CORS advisory surfaced by `npm audit` after adding Playwright — deliberately not fixed (dev-server only; the real fix is a major Vite version bump deferred until there's an independent reason to touch it).
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
- **Bug found and fixed:** `selectedStepId` initializes (at module load, before the async storage read resolves) against the throwaway default document's first step. Loading a saved document without also reselecting its first step left `selectedStepId` pointing at a step id that no longer existed, so nothing appeared selected after a reload. Fixed by having `initPersistence` call `selectStep` on the loaded document's first step.
- **Limitation found, only partly fixable, documented:** an edit made within the debounce window before closing/reloading the tab can be lost, because the pending `setTimeout` never fires once the page is torn down. A `visibilitychange`/`pagehide` listener attempts an immediate flush, but this doesn't reliably survive a same-tab `reload()` in Chromium either — the async IndexedDB write gets abandoned mid-navigation, a browser limitation, not something fixable from page script. Mitigated by shrinking the debounce from an initial 500ms to 200ms, small enough that no realistic usage pattern hits it; see `docs/Known-Issues.md`.

### Token connector lines and live drag insertion marker (beyond the original task list)

Before building this, three possible future features were discussed and deliberately deferred - see [../Planned-Additions.md](../Planned-Additions.md) (warnings rendered inside their related token; a radial "steps point to a center goal" canvas; per-connection line style/labels). None of them required a change before proceeding.

- A plain thin line is drawn between each pair of consecutive tokens within a step, in array order; steps stay visually separate (no lines between steps). Purely a rendering computation from token order - no new stored data.
- On desktop, when a step's tokens wrap onto a second row, the connector bends: down from the last chip's row, across to the first chip's row, instead of breaking the chain or cutting a diagonal across the step.
- While dragging a token, the step being hovered now shows a live insertion-point marker at the exact slot it would land in (using the same index `resolveTokenDropTarget` already computed for the drop itself), not just a highlight on the whole step - `state/drag.ts`'s `dropTargetStepId` signal became `dropTarget: { stepId, index } | null` to carry this.
- **Two bugs found and fixed, both in the row-wrap bend specifically:**
  1. *Invisible line:* the connector lines were technically correct - valid path coordinates, correctly-applied `stroke` color, confirmed via `getComputedStyle`/`getBBox()` - but invisible in an actual screenshot, because the gap they were drawn in (8 design units) was too narrow and the color (`#bbb`) too pale against the light chip/step backgrounds. Only caught by looking at a real (cropped/zoomed) screenshot, not by DOM/style inspection. Fixed by widening the token gap (8 → 16 units) and using a darker, thicker stroke (`#999`, 2px).
  2. *Wraps reading as one long bar instead of distinct hooks:* the bend originally routed through each row's own mid-height, and since every full row's last chip sits at the same x, several consecutive wraps' vertical segments landed on that same x and chained into what looked like one continuous line spanning every row - reported by the user from a screenshot with several wrapped rows. Fixed by routing the bend through the middle of the gap *between* the two specific rows it connects (a distinct y-band per wrap) instead of either row's mid-height, so each wrap reads as its own "end of row N → start of row N+1" hook.
- **Token block centering**, added right after: a step's tokens (chips, connectors, and the insertion marker) are now horizontally centered within the step card instead of flush against its left edge - a short step on the same full-width card as a long one previously looked lopsided, all its empty space pushed to one side. Computed per step, from that step's own widest row, so a 2-token step centers within the same card width a 6-token step fills edge-to-edge; the badge and incomplete-flag stay anchored to their fixed corners.
- **Rounded connector corners**, added right after: the row-wrap bend's two 90° corners are now rounded. First attempt was `stroke-linejoin: round` (pure CSS, no path change) - technically applied but imperceptible, since its rounding radius is tied to the 2px stroke width. Fixed properly by building an explicit radius (`CONNECTOR_CORNER_RADIUS = 8`) into the path itself with quadratic Bezier (`Q`) segments at each corner, independent of stroke width - confirmed visible via tightly-cropped screenshots of each corner.
- **Connector lead-out stub**, added right after: the row-wrap bend now pokes out `CONNECTOR_LEAD_OUT = 8` units past the last chip in a row before curving down, so it reads as a distinct line rather than one starting flush against (and blending into) the chip's own border. The canvas's overall width calculation now reserves this same amount of extra margin, so the stub can never poke past a step card's own right border even when a row's width exactly matches the canvas's widest content - verified with a full 6-per-row (maximum width) case specifically.

### Design system and visual refresh (beyond the original task list)

Before this, the app used ad hoc hardcoded colors/radii scattered across `global.css`. All colors, radii, and shadows now live in `:root` CSS custom properties (`--color-accent`, `--color-canvas-bg`, `--radius-lg`, etc.), so a retheme is a one-place edit going forward. The canvas panel got its own tinted background (`--color-canvas-bg`), distinct from both the plain app background and the white side panels, with white step cards sitting on top of it — step/row layout mechanics (left-aligned, growing right, wrapping) are untouched; this is a colors-only change. TokenPicker's flat per-category list became a `role="tablist"` of category tabs (`activeTokenCategory` in `state/ui.ts`) so the vocabulary can grow without every category's grid showing at once.

Two connector-line follow-up fixes, both reported from screenshots:

- The row-wrap bend's lead-out stub (added in a previous session) only existed on the source side, landing flush against the destination chip's border on the other end — an asymmetry the user caught. Mirrored it: both ends now get an equal stub before curving, confirmed via the raw SVG path data (`M 656 60 L 664 60 ...` mirrored by `... L -8 132 L 0 132`), and the canvas's reserved margin doubled so the new destination-side stub can never overflow a step card.
- Even after that fix, multiple wrap bends in the same step still "looked" inconsistent to the user. Proven mathematically identical first (two dumped path strings differing only by a constant vertical shift), so the cause was rendering, not geometry: at the old 8-design-unit corner radius, the curve was only a handful of actual screen pixels once scaled down, small enough that rasterization made otherwise-identical curves read as inconsistently "tight." Both `CONNECTOR_CORNER_RADIUS` and `CONNECTOR_LEAD_OUT` were raised from 8 to 12 (kept equal, so the stub and curve read as one shape) — confirmed visually consistent across multiple wraps in the same step afterward.

### Token attachments — Quantity, Warning, and Time (beyond the original task list)

> ⚠️ **Superseded by "Quantity and Time rework" below.** This section is
> kept for history (it's what shipped first), but Quantity and Time were
> both significantly reworked afterward - see the next section for current
> behavior before relying on anything below.

Implements [Planned Addition #1](../Planned-Additions.md) (warnings rendered inside their related token, deferred earlier this session), generalized per the user's request: Quantity and Warning moved out of "Add to step" entirely, and a new Time category joined them — all now attached *to* a token instead of standing on their own as a step-level chip.

- `InstructionToken` gained three optional fields — `quantity`/`warning`/`time`, each a `TokenAttachment` (`{ iconId, label? }`; no `id`/`note`/`metadata`, since it's never independently ordered, dragged, or a connector-line endpoint). At most one of each kind per token; attaching a second of the same kind replaces the first (`state/document.ts`'s `attachToToken`/`attachToSelectedToken`/`removeTokenAttachment`, built on a shared `setTokenAttachment`).
- A new **"Add to token"** panel (`TokenAttachmentPicker`), stacked below "Add to step" in the same grid column, offers Quantity/Warning/Time as its own tab set (`activeAttachmentCategory` in `state/ui.ts` — a separate signal so switching tabs in one picker never affects the other). Click-only by design, no drag: attaching only makes sense once a token is already selected, so there's no drop-target ambiguity to resolve. Shows a placeholder message instead of tabs when no token is selected.
- On the canvas, an attachment renders as a small, non-interactive corner badge on its parent token's existing chip — warning top-left, quantity bottom-left, time bottom-right — leaving the remove control's top-right corner untouched and the chip's 96×56 size and every row/wrap layout calculation unchanged. Badges show in both the editor and read-only preview, since they're instruction content, not an editing affordance.
- Token details lists each attachment (icon + label) with its own remove button, since the tiny canvas badge has no room for one and isn't interactive — this is the only way to remove an attachment.
- A new Time sample set (30 sec/1 min/5 min/10 min/30 min) reuses one `clock` icon throughout — a duration reads fine as text alone, unlike Warning's per-value icons (thermometer vs. triangle-alert).

### Quantity and Time rework (beyond the original task list)

The preset-button version of Quantity/Time above didn't hold up once the user asked for a real amount+unit value (capped, validated) and a proper duration - reworked in two rounds the same session, ending in a materially different design from what's described above:

- **Quantity** is no longer a fixed preset list. `TokenAttachmentPicker`'s Quantity tab is now a form: an integer amount (1–99999, validated with an inline error and a disabled Attach button when out of range) plus a unit dropdown of common EU food-measurement units (`data/units.ts`'s `EU_FOOD_UNITS` - g/kg/ml/l/tsp/tbsp/pinch/pcs, deliberately a plain swappable list, not baked into the model, so a non-food domain can offer a different list later without changing `TokenAttachment`'s shape). The resulting value (e.g. "250 g") is stored as the attachment's `label` and shown as visible text in a pill-shaped chip badge - not an icon, since the number is the useful part - reusing one canonical `quantity.amount` icon (a weight glyph) only in contexts with room for it (Token details).
- **Time was pulled out of "Add to token" entirely** and became bigger in scope than originally planned: a duration can now be set independently on a **token** (`InstructionToken.time`) *and* on a **step** (`InstructionStep.time`, new) - the user pointed out that someone often knows how long a whole step takes without knowing the breakdown per token. Both are a new `DurationAttachment` (`{ iconId, label, seconds }` - unlike `TokenAttachment`, it carries the raw second count so a step can sum its tokens' times, not just display an already-formatted string). Input is a small, reusable `DurationField` component (day/hour/minute/second boxes, 0–99/23/59/59, collapsed to a single line - a "+ Time" button, or a value with Edit/Remove - until actively editing), used identically in `StepDetails` and `TokenDetails`.
- **Display moved off the chip entirely** and onto a centered header drawn above the step's card inside the SVG (`"XXd-XXh-XXm-XXs"`, reserving extra vertical space only for steps that have one): if the step has its own explicit time, that wins; otherwise its tokens' times are summed (`lib/duration.ts`'s `sumDurations`); otherwise nothing shows. The per-token clock corner badge from the original design was removed - showing a value in two different places/styles (a tiny badge and a big header) was judged confusing, and duplicating it added no information the header didn't already give a canvas viewer.
- A UI-cleanup pass alongside this (native number-input spinners removed from the day/hour/minute/second boxes; the duration value's layout fixed so it doesn't wrap awkwardly next to its buttons) is documented in [../Fixed-Issues.md](../Fixed-Issues.md), along with a real bug found in review: `DurationField` leaked its unsaved editing state across a token/step switch (missing a `key` prop) - see that doc for the full root cause and fix.

## Verification

- `npm run lint`, `npm run typecheck`, and `npm run build` pass cleanly after every change described above.
- The Playwright driver exercises, in a real browser: no console errors; canvas badges/remove controls are keyboard-focusable; the two-stage step/token select model; typing into Token details updating the canvas chip's label live; dragging a token from the picker onto a step; dragging an existing canvas token between steps; dragging a step in the list to reorder it; the Preview toggle hiding every editing control; the document (including the drag-reorder above) surviving a page reload via IndexedDB; and the mobile viewport rendering one row per step with legible, bounded icon sizes.
- Screenshots were visually reviewed (not just checked for a passing exit code) at desktop width, after drag-and-drop, in preview mode, at 390px mobile width, and (cropped/zoomed) for the connector lines and live insertion marker specifically - the only way the line-visibility bug above was actually caught.
- The Playwright driver now also asserts a step's connector-line count matches its token count minus one, and that the insertion marker is visible mid-drag (before release), not just after.
- The Playwright driver now also attaches a Warning and a Quantity to a token via "Add to token" (the Quantity form, not a preset button), confirms the canvas chip shows two badges and Token details lists two attachments, removes one via Token details, and confirms both drop to one (`ATTACHMENTS_WORKED_END_TO_END`).
- The Playwright driver now also sets a token's own time and a step's own time via `DurationField`, confirming the step's canvas header shows the token-sum first and then the step's explicit value once set (`TIME_WORKED_END_TO_END`) - and reproduces the exact stale-state bug from [../Fixed-Issues.md](../Fixed-Issues.md) (start editing, switch selection without saving, assert the new selection isn't left showing the old one's draft) for both a token switch and a step switch (`DURATION_FIELD_RESETS_PER_TOKEN`, `DURATION_FIELD_RESETS_PER_STEP`).
- The Safari-private-browsing fallback was verified directly: with `indexedDB.open` made to throw (simulating a blocked store), the app still renders and is fully usable, the warning banner appears, and no console errors are thrown.

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
- `docs/Planned-Additions.md` — new: three discussed-but-not-built ideas (attached warnings, a radial canvas, per-connection line style/labels) and what each would require later.
- `docs/Known-Issues.md` — new in the previous update; the `vite`/`esbuild` entry broadened to the fuller advisory list `npm audit` reports, and a new entry documents the persistence debounce edge case.
- `docs/phase-1/UX-and-Wireframes.md` — fixed the token-category order in the wireframe to match `TokenPicker`.
- `src/components/StepBuilder/` — deleted (superseded by `InstructionCanvas`).
- `src/model/instruction.ts` — added the `time` `TokenCategory`, the `TokenAttachment` type, and `InstructionToken.quantity`/`warning`/`time`.
- `src/data/sample-tokens.ts` — added `CATEGORY_LABELS` (moved here from `TokenPicker.tsx` so both pickers share one copy) and five Time samples.
- `src/data/icon-library.ts` — added the `clock` icon, mapped to all five `time.*` ids.
- `src/state/ui.ts` — added `activeAttachmentCategory`.
- `src/state/document.ts` — added `AttachmentKind` and `setTokenAttachment`/`attachToToken`/`attachToSelectedToken`/`removeTokenAttachment`.
- `src/components/TokenPicker/TokenPicker.tsx` — restricted to action/object/tool/note categories (quantity/warning moved out); imports the now-shared `CATEGORY_LABELS` instead of defining its own copy.
- `src/components/TokenAttachmentPicker/TokenAttachmentPicker.tsx` — new: the "Add to token" panel.
- `src/components/TokenDetails/TokenDetails.tsx` — lists the selected token's attachments with a remove button each.
- `src/components/InstructionCanvas/InstructionCanvas.tsx` — renders attachment corner badges (originally `ChipBadge`, later split into `WarningBadge`/`QuantityBadge` - see below); `CONNECTOR_CORNER_RADIUS`/`CONNECTOR_LEAD_OUT` raised 8 → 12; row-wrap path mirrored with a lead-in stub; canvas-width margin reservation doubled accordingly.
- `src/app.tsx` — renders `TokenAttachmentPicker` alongside the existing panels.
- `src/styles/global.css` — full `:root` design-token system (color/radius/shadow custom properties); canvas background distinguished from the app/panel backgrounds; category-tab, chip-badge, and token-details-attachment-list styles; new `panel-token-attachments` grid area.
- `.claude/skills/run-instruction-builder/driver.mjs` — step-token flow swapped Sharp! → Knife (Warnings is no longer available at step level); new attach/verify/remove segment covering "Add to token."

### Files touched — Quantity and Time rework + bug-fix/review pass

- `src/model/instruction.ts` — added the `DurationAttachment` type (`{ iconId, label, seconds }`); `InstructionToken.time` changed from `TokenAttachment` to `DurationAttachment`; added `InstructionStep.time`.
- `src/lib/duration.ts` — new: `formatDuration`/`splitDuration`/`buildDuration`/`sumDurations` and the duration bounds (`MAX_DURATION_DAYS = 99`, `MIN_DURATION_SECONDS = 1`).
- `src/data/units.ts` — new: `EU_FOOD_UNITS`, the Quantity unit dropdown's option list.
- `src/data/icon-library.ts` — dropped the five distinct Quantity icons (cup/tbsp/weight) and five distinct Time icons in favor of two canonical, exported ids (`QUANTITY_ICON_ID`, `TIME_ICON_ID`) each mapped to one icon.
- `src/data/sample-tokens.ts` — removed the now-unused Quantity/Time preset entries (Warning's presets are untouched).
- `src/state/document.ts` — `AttachmentKind` narrowed to `"quantity" | "warning"` (Time is no longer one of the generic attachment kinds); added `setTokenTime`/`setStepTime`.
- `src/components/TokenAttachmentPicker/TokenAttachmentPicker.tsx` — Quantity's button grid replaced with a validated amount+unit form; Time tab removed entirely.
- `src/components/DurationField/DurationField.tsx` — new: the shared day/hour/minute/second editor used by both details panels; forces a fresh instance per token/step via a `key` prop (see Fixed-Issues.md) and gives every button a distinguishing `aria-label` (e.g. "Save step time" vs. "Save token time").
- `src/components/StepDetails/StepDetails.tsx`, `src/components/TokenDetails/TokenDetails.tsx` — render `DurationField` (keyed by `step.id`/`token.id`); `TokenDetails`' generic attachment list narrowed to `["warning", "quantity"]` and its remove-button label now uses the attachment's own value instead of the category name.
- `src/components/InstructionCanvas/InstructionCanvas.tsx` — `CHIP_HEIGHT` raised 56 → 68 to fit Quantity's text pill; `ChipBadge` split into `WarningBadge` (unchanged icon-only circle) and `QuantityBadge` (a new text-only pill, no icon); added the step-level duration header (`stepDisplayedTime`, `TIME_HEADER_HEIGHT`) and the per-step header-height bookkeeping in the layout loop.
- `src/styles/global.css` — quantity-pill and step-time-header styles; `DurationField`'s collapsed/editing states (including hiding the native number-input spinners and fixing the value's wrap behavior - see Fixed-Issues.md); the Quantity form's styles in `TokenAttachmentPicker`.
- `.claude/skills/run-instruction-builder/driver.mjs` — reworked the attachment segment for the new Quantity form and the removal of Time from "Add to token"; added the `DurationField` flow (set token time, set step time, verify precedence) and the two stale-state regression checks.
- `docs/Fixed-Issues.md` — new: see below.

## What's next

See [../Milestones.md](../Milestones.md) for the current status at a glance, or the full task list in [../Visual-Instruction-Builder-Project-Plan.md](../Visual-Instruction-Builder-Project-Plan.md#step-by-step-project-tasks): task 13 (Undo/Redo) is next.
