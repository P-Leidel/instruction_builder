# Quantity and Time rework (beyond the original task list)

> 📌 **Doc status: CURRENT** — one file in the
> [Phase 2 Progress Log](./README.md). Supersedes the original Quantity/Time
> design described in
> [tasks-05-12-early-build.md](./tasks-05-12-early-build.md#token-attachments--quantity-warning-and-time-beyond-the-original-task-list).

The preset-button version of Quantity/Time described in
[tasks-05-12-early-build.md](./tasks-05-12-early-build.md) didn't hold up
once the user asked for a real amount+unit value (capped, validated) and a
proper duration - reworked in two rounds the same session, ending in a
materially different design from what shipped first:

- **Quantity** is no longer a fixed preset list. `TokenAttachmentPicker`'s Quantity tab is now a form: an integer amount (1–99999, validated with an inline error and a disabled Attach button when out of range) plus a unit dropdown of common EU food-measurement units (`data/units.ts`'s `EU_FOOD_UNITS` - g/kg/ml/l/tsp/tbsp/pinch/pcs, deliberately a plain swappable list, not baked into the model, so a non-food domain can offer a different list later without changing `TokenAttachment`'s shape). The resulting value (e.g. "250 g") is stored as the attachment's `label` and shown as visible text in a pill-shaped chip badge - not an icon, since the number is the useful part - reusing one canonical `quantity.amount` icon (a weight glyph) only in contexts with room for it (Token details).
- **Time was pulled out of "Add to token" entirely** and became bigger in scope than originally planned: a duration can now be set independently on a **token** (`InstructionToken.time`) *and* on a **step** (`InstructionStep.time`, new) - the user pointed out that someone often knows how long a whole step takes without knowing the breakdown per token. Both are a new `DurationAttachment` (`{ iconId, label, seconds }` - unlike `TokenAttachment`, it carries the raw second count so a step can sum its tokens' times, not just display an already-formatted string). Input is a small, reusable `DurationField` component (day/hour/minute/second boxes, 0–99/23/59/59, collapsed to a single line - a "+ Time" button, or a value with Edit/Remove - until actively editing), used identically in `StepDetails` and `TokenDetails`.
- **Display moved off the chip entirely** and onto a centered header drawn above the step's card inside the SVG (`"XXd-XXh-XXm-XXs"`, reserving extra vertical space only for steps that have one): if the step has its own explicit time, that wins; otherwise its tokens' times are summed (`lib/duration.ts`'s `sumDurations`); otherwise nothing shows. The per-token clock corner badge from the original design was removed - showing a value in two different places/styles (a tiny badge and a big header) was judged confusing, and duplicating it added no information the header didn't already give a canvas viewer.
- A UI-cleanup pass alongside this (native number-input spinners removed from the day/hour/minute/second boxes; the duration value's layout fixed so it doesn't wrap awkwardly next to its buttons) is documented in the [Fixed Issues log](../../fixed-issues/duration-value-wrapped-awkwardly.md), along with a real bug found in review: `DurationField` leaked its unsaved editing state across a token/step switch (missing a `key` prop) - see the [Fixed Issues log](../../fixed-issues/duration-field-stale-edit-on-switch.md) for the full root cause and fix.

## Files touched — Quantity and Time rework + bug-fix/review pass

- `src/model/instruction.ts` — added the `DurationAttachment` type (`{ iconId, label, seconds }`); `InstructionToken.time` changed from `TokenAttachment` to `DurationAttachment`; added `InstructionStep.time`.
- `src/lib/duration.ts` — new: `formatDuration`/`splitDuration`/`buildDuration`/`sumDurations` and the duration bounds (`MAX_DURATION_DAYS = 99`, `MIN_DURATION_SECONDS = 1`).
- `src/data/units.ts` — new: `EU_FOOD_UNITS`, the Quantity unit dropdown's option list.
- `src/data/icon-library.ts` — dropped the five distinct Quantity icons (cup/tbsp/weight) and five distinct Time icons in favor of two canonical, exported ids (`QUANTITY_ICON_ID`, `TIME_ICON_ID`) each mapped to one icon.
- `src/data/sample-tokens.ts` — removed the now-unused Quantity/Time preset entries (Warning's presets are untouched).
- `src/state/document.ts` — `AttachmentKind` narrowed to `"quantity" | "warning"` (Time is no longer one of the generic attachment kinds); added `setTokenTime`/`setStepTime`.
- `src/components/TokenAttachmentPicker/TokenAttachmentPicker.tsx` — Quantity's button grid replaced with a validated amount+unit form; Time tab removed entirely.
- `src/components/DurationField/DurationField.tsx` — new: the shared day/hour/minute/second editor used by both details panels; forces a fresh instance per token/step via a `key` prop (see the Fixed Issues log) and gives every button a distinguishing `aria-label` (e.g. "Save step time" vs. "Save token time").
- `src/components/StepDetails/StepDetails.tsx`, `src/components/TokenDetails/TokenDetails.tsx` — render `DurationField` (keyed by `step.id`/`token.id`); `TokenDetails`' generic attachment list narrowed to `["warning", "quantity"]` and its remove-button label now uses the attachment's own value instead of the category name.
- `src/components/InstructionCanvas/InstructionCanvas.tsx` — `CHIP_HEIGHT` raised 56 → 68 to fit Quantity's text pill; `ChipBadge` split into `WarningBadge` (unchanged icon-only circle) and `QuantityBadge` (a new text-only pill, no icon); added the step-level duration header (`stepDisplayedTime`, `TIME_HEADER_HEIGHT`) and the per-step header-height bookkeeping in the layout loop.
- `src/styles/global.css` — quantity-pill and step-time-header styles; `DurationField`'s collapsed/editing states (including hiding the native number-input spinners and fixing the value's wrap behavior - see the Fixed Issues log); the Quantity form's styles in `TokenAttachmentPicker`.
- `.claude/skills/run-instruction-builder/driver.mjs` — reworked the attachment segment for the new Quantity form and the removal of Time from "Add to token"; added the `DurationField` flow (set token time, set step time, verify precedence) and the two stale-state regression checks.
- `docs/fixed-issues/` — new entries for the stale-edit and layout-wrap bugs; see the [Fixed Issues index](../../fixed-issues/README.md).
