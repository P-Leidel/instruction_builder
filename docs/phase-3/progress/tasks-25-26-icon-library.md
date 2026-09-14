# Tasks 25–26: Expand Recipe Icon Library + Sample Tokens

> 📌 **Doc status: CURRENT** — one file in the
> [Phase 3 Progress Log](./README.md).

Date: 2026-09-14

## What shipped

The icon library ([data/icon-library.ts](../../../src/data/icon-library.ts))
grew from its Phase 2 prototype set (12 recipe icons: 5 actions, 4 objects,
3 tools) to a curated "v1" list drafted and reviewed with the user:
**18 actions, 28 objects, 9 tools** (55 recipe icons total, on top of the
existing warning/quantity/time icons). [data/sample-tokens.ts](../../../src/data/sample-tokens.ts)
was expanded in the same pass so every new icon is actually reachable in
the app - `TokenPicker`'s "Add to step" panel reads from `SAMPLE_TOKENS`,
so an icon with no matching entry there would be dead code.

All icons are still Lucide-only (`lucide-static`, ISC license), per the
decision made when scoping this task - no second icon source, accepting
approximate icons where Lucide has no literal match. Some concepts share
one icon deliberately, the same pattern already used for Quantity/Time:

- **Fry** reuses Bake's flame icon; **Rinse** reuses Boil's droplets icon;
  **Oil** reuses Pour's droplet icon; **Ice** reuses Chill's snowflake
  icon; **tool.Thermometer** reuses the Warning "hot" icon.
- **Garlic, Tomato, Potato, Cheese, Bread, Salt, Pepper, and Sugar** all
  share one generic "food" fallback icon (Lucide's `utensils`, a fork and
  knife) - decided with the user rather than omitting these common recipe
  staples entirely, since Lucide has no literal icon for any of them.

**Confirmed gaps, deliberately left out of v1** (no reasonable Lucide icon
exists, and forcing a bad fit was judged worse than omitting): as actions -
peel, marinate, garnish, flip, cover/wrap, grill (as distinct from roast);
season/sprinkle was dropped as an action in favor of representing
seasoning via ingredient tokens (Salt, Pepper) instead. As tools - whisk,
spatula, tongs, grater, ladle, mixing bowl, cutting board, measuring cup,
oven mitt - Lucide has almost no dedicated kitchenware beyond what shipped
here. Revisit if real user testing (task 30) surfaces these as actually
missed, or if a second icon source is ever considered.

## Verification

- `npm run lint`, `npm run typecheck`, `npm test` (113 tests, unchanged),
  and `npm run build` all pass. Production bundle grew from 66.86 kB JS /
  21.70 kB gzip (the task 24 baseline) to 88.86 kB / 26.70 kB gzip - a
  real but small increase from ~40 new inlined SVGs, no performance
  concern at this size.
- Verified in a real browser (dev server): all three `TokenPicker`
  category tabs report the expected button count (Actions 18, Objects 28,
  Tools 9) with zero icons failing to parse (checked via each icon's
  inlined `<svg>` having real child markup, not an empty element - the
  failure mode an unresolvable `iconId` or a bad `?raw` import would
  produce). Zero console errors throughout.
- The Objects tab - the largest, at 28 items - was screenshotted and
  visually confirmed to lay out cleanly in `TokenPicker`'s existing
  category-tab pattern (one category's grid rendered at a time) with no
  overflow or cutoff; this was the first real test of that pattern at
  more than a handful of icons per category, which its own code comment
  anticipated but hadn't yet been exercised against.
- Added a new token (Slice) to a step via click-to-add and confirmed it
  renders correctly on the canvas with its icon, label, and
  `sample-tokens.ts` description, in Step Details.

## What's next

See [README.md](./README.md) for Phase 3's overall status. Task 27 (Add
Document Title UI) is next.
