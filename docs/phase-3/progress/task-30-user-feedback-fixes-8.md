# Task 30: eighth user feedback pass

> 📌 **Doc status: CURRENT** — one file in the
> [Phase 3 Progress Log](./README.md).

Date: 2026-09-17

A same-day follow-up to the
[seventh feedback pass](./task-30-user-feedback-fixes-7.md). Settled via
`/mattpocock-skills:grill-me` (one round, three questions) after two rounds
of fact-finding sub-agent research into what Lucide icons actually exist,
then implemented and verified in a real browser only after the user's
explicit confirmation of all three recommendations.

## What was reported

Users requested more icons for testing:

1. "More generic actions, like 'add' 'remove' 'wait' (add up to 12 new
   actions)."
2. "Up to 15 more common food ingredients."
3. "If you do not find relevant icons use placeholders."

## What shipped

Both `data/icon-library.ts` (the `iconId` → Lucide SVG mapping) and
`data/sample-tokens.ts` (the pickable token vocabulary `TokenPicker` reads)
gained matching new entries - the same two-files-in-lockstep pattern
established when the icon library was first expanded (see
[tasks-25-26-icon-library.md](./tasks-25-26-icon-library.md)). No model or
component changes were needed: `InstructionToken`/`TokenCategory` already
support arbitrary `iconId` strings within the existing `action`/`object`
categories.

**12 new generic action tokens**, all with distinct, literal Lucide icons
(confirmed via a sub-agent sweep of `lucide-static`'s ~2,098 icon files
before committing to a list, since a wrong filename would break the
build): Add (`plus`), Remove (`minus`), Wait (`hourglass`), Turn
(`rotate-cw`), Attach (`paperclip`), Detach (`unlink`), Repeat (`repeat`),
Measure (`ruler`), Open (`door-open`), Close (`door-closed`), Check
(`search-check`), Adjust (`sliders-horizontal`). These are deliberately
generic instruction verbs, not cooking techniques - distinct from the
existing 18 `action.*` tokens (Chop, Stir, Bake, etc.) and from the
"peel/marinate/garnish/flip/cover-wrap/grill/season-sprinkle" list the
original icon library doc explicitly deferred in v1.

**15 new ingredient tokens**, following the request's own fallback
instruction. A sub-agent sweep of common ingredient words against Lucide's
actual icon set found real, distinct matches for only 4: Cherry
(`cherry`), Chicken (`drumstick` - the closest recognizable proxy, no
literal "chicken" icon exists), Ham (`ham`), and Wheat (reuses the same
`wheat` icon `object.flour` already uses - the same "no distinct icon,
reuse a related one" pattern as Fry reusing Bake's flame). The other 11 -
Rice, Pasta, Butter, Honey, Chocolate, Mushroom, Corn, Avocado, Cucumber,
Cabbage, Yogurt - have no literal Lucide icon at all, so they reuse the
same shared `genericFood` fallback (`utensils`) already used for Garlic/
Tomato/Potato/Cheese/Bread/Salt/Pepper/Sugar, rather than being omitted.

A design choice was grilled and confirmed before implementing: given how
thin real ingredient-icon coverage turned out to be (4 of ~22 candidate
words checked), the alternative was broadening scope to "common foods" and
picking common prepared dishes/drinks that do have distinct icons (pizza,
hamburger, sandwich, beer, wine, martini, etc.) to maximize visual
variety. That was rejected in favor of staying literal to "ingredients" -
labels still fully distinguish each token even where the icon glyph is
shared, matching the precedent already set by the 8 existing fallback
tokens.

A fourth grilled decision - which icon should stand in for an `action`
token with no literal match (no such fallback existed before this pass,
only `object`'s `genericFood`) - settled on `asterisk.svg` as the
established choice for future use. None of the 12 actions shipped this
pass actually needed it (all 12 had real matches), so it wasn't wired into
`icon-library.ts` - that would be dead code without a caller. The choice is
recorded here for whoever adds the next unmatched action token.

## Verification

- `npx tsc -b`, `npm run lint`, `npm test` (135 tests, unchanged - this is
  a pure data addition to two lookup tables, no new branchable logic to
  test), and `npm run build` all pass cleanly. Main `index` chunk grew
  from 95.33 kB to 104.40 kB (28.52 kB → 30.02 kB gzip) from the 27 new
  inlined icon strings - expected, no code-splitting regression (the PDF
  libraries stayed in their own lazy chunks).
- A live Playwright check against the dev server confirmed `TokenPicker`'s
  Actions tab now renders 30 buttons (was 18) and Objects renders 43 (was
  28), zero console errors, and no horizontal overflow at the 390px mobile
  regression-guard width. Screenshots were read back to confirm every new
  icon actually renders a distinct, legible glyph (not a blank slot from a
  typo'd `iconId`) - both for the 12 actions and, scrolled to the bottom
  of the Objects grid, all 15 ingredients including the 11 sharing the
  `genericFood` fallback.

## What's next

See [README.md](./README.md) for Phase 3's overall status - task 30 (Test
Real Users) continues as more feedback comes in.
