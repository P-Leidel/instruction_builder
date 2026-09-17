# Task 30: fifth user feedback pass

> 📌 **Doc status: CURRENT** — one file in the
> [Phase 3 Progress Log](./README.md).

Date: 2026-09-17

A same-day follow-up to the
[fourth feedback pass](./task-30-user-feedback-fixes-4.md) brought three more
reports, all about the canvas's own heading. Settled via
`/mattpocock-skills:grill-me` (two rounds, eight questions - read-only vs.
editable heading, the empty-title fallback, whether to sum every step's
displayed time or just steps with an explicit time, and how aggressively to
cap the backdrop) before any code changed.

## What was reported

1. **"The top of the canvas says 'Instructions' - it should say the name,
   just like the browser tab."** The heading was a static string, unrelated
   to `document.value.meta.title`.
2. **"Similar to how steps can display the sum of token time, the sum of
   step time should be calculated and shown before the instructions name,
   following the format of step time and step title on the canvas."** Each
   step already shows `stepDisplayedTime(step)` (its own explicit `time`, or
   else the sum of its tokens' times) rendered as `{time} - {title}` - there
   was no document-level equivalent one level up.
3. **"The canvas backdrop expands to the right longer than its actual
   size."** `.instruction-canvas`'s background card was wider than the SVG
   it contains at wide viewports.

## What shipped

### Heading now mirrors the document title (read-only)

`InstructionCanvas.tsx`'s `<h2>` now renders
`document.value.meta.title || "Untitled instructions"` instead of a static
"Instructions" label - the same fallback string `createEmptyDocument()`
already uses (`model/instruction.ts`), so it matches what a brand-new
document's title placeholder and the browser tab already show. Grilled as a
**read-only mirror**, not a second editable field: the toolbar's title
`<input>` (`app.tsx`) stays the one place to edit it, exactly like
`useDocumentTitleSync()` already mirrors the same value into
`window.document.title`.

### A document-level total time, using the same pattern as step time

`totalTime = sumDurations(steps.map(stepDisplayedTime))` sums every step's
*displayed* time - each step's own explicit `time` if set, else its tokens'
summed time - reusing `stepDisplayedTime`/`sumDurations` from
`lib/duration.ts` unchanged. The heading renders `{totalTime.label} - {title}`
in two new spans (`instruction-canvas__heading-time`/
`instruction-canvas__heading-title`), mirroring the existing per-step
`{time} - {title}` tspan pattern one level up - and, like that per-step
case, the time prefix disappears entirely (not "0s") when no step has any
time to sum, since `sumDurations` returns `undefined` rather than zero for
"nothing to sum."

### Backdrop capped to the SVG's actual width

`.instruction-canvas`'s background card no longer stretches past the SVG's
own `clamp(480px, 100%, 960px)` cap at wide viewports - grilled to a
**wide-viewport-only** fix (narrow-viewport `overflow-x: auto` scrolling was
left untouched, since the card is already at its floor there) and a
**centered** cap rather than left-aligned.

The first implementation (`max-width: calc(960px + 2rem + 2px);
margin-inline: auto;`, no explicit `width`) shipped a real regression,
caught during verification, not by the user: adding `margin-inline: auto` to
a grid item whose own `width` is `auto` disables CSS Grid's default
stretch-to-fill sizing and falls back to shrink-to-fit sizing instead - which
is circular here, because the child `.instruction-canvas__svg`'s own width
is itself a percentage of this box, and percentages don't contribute to a
shrink-to-fit calculation. A debug Playwright script measuring
`getBoundingClientRect` directly caught it: at 1920px the card measured
333.95px wide against an expected 994px, narrower even than the SVG's own
480px floor. Fixed by giving the item an explicit, non-`auto` width instead:
`width: min(100%, calc(960px + 2rem + 2px)); margin-inline: auto;` - a
definite width resolves cleanly under Grid's normal (non-shrink-to-fit)
sizing, which also lets the SVG's percentage width resolve correctly against
it. Re-measured after the fix: card width 994px, SVG width 960px, a 17px gap
on the right - exactly the card's own padding + border, not excess
background.

## Verification

- `npm run lint` / `npm run typecheck` / `npm test` (131 tests, unchanged -
  a component/CSS-only change, no new branchable `lib`/`state` logic) /
  `npm run build` all clean.
- Real-browser Playwright checks (three scratch scripts run against the dev
  server, deleted after use - not part of `driver.mjs`): heading text/format
  correct with a step time set (`"45m - Untitled instructions"` style
  output) and correctly absent with no step times set; the toolbar title
  input, the canvas heading, and the browser tab title all stay in sync,
  including live as the toolbar title is edited; backdrop-to-SVG gap
  measured at a consistent 17px at both 1600px and 1920px (down from ~344px
  at 1920px before the fix); 390px mobile width unaffected, with zero
  horizontal page overflow.

## What's next

See [README.md](./README.md) for Phase 3's overall status - task 30 (Test
Real Users) continues as more feedback comes in.
