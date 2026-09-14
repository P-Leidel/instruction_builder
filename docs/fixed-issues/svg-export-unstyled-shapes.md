# SVG export would have downloaded unstyled, invisible-looking shapes

> 📌 **Doc status: CURRENT** — one entry in the [Fixed Issues log](./README.md).

- **What broke:** nothing shipped - caught while building task 15, before
  the Export SVG button existed at all. The initial plan (per
  `docs/project-plan.md`'s Export Strategy) was to
  serialize the canvas's real rendered `<svg>` DOM node directly via
  `XMLSerializer`. Tested against the actual node: the output had correct
  markup (paths, positions, text) but every fill, stroke, and font came out
  as browser defaults - black fills, no strokes, default font - because the
  canvas's entire visual appearance is driven by CSS classes in
  `global.css` (resolved against `:root`'s custom-property design tokens),
  and `XMLSerializer` only captures DOM attributes, never the stylesheet
  that gives those classes meaning. Opened outside this app's own page
  (the plan's own success criterion: "SVG exports open cleanly in a
  standard vector editor"), the file would have rendered as barely-visible
  black-on-white shapes with no connector lines, no accent-colored badges,
  and no warning/quantity badge colors.
- **Root cause:** conflating "serialize the DOM" with "serialize what the
  DOM looks like" - the two are the same only while the file stays inside a
  page that still loads this app's stylesheet, which an exported, portable
  `.svg` file by definition does not.
- **Fix:** `lib/svg-export.ts`'s `bakeComputedStyles` walks a clone of the
  live SVG node in lockstep with the original, copying each element's
  *resolved* `getComputedStyle` values (fill, stroke, stroke-width,
  stroke-dasharray, stroke-linejoin, stroke-linecap, color, font-family,
  font-size, font-weight, font-variant-numeric - exactly the properties
  `global.css`'s `.instruction-canvas__*` rules actually set) onto the
  clone as an inline `style` attribute, before that clone is serialized.
  Reading computed values (rather than re-deriving them from the CSS
  source) means the result is correct regardless of the custom-property
  cascade, with nothing to keep in sync by hand.
- **Verified by:** a dedicated Playwright regression check
  (`SVG_EXPORT_IS_SELF_CONTAINED_AND_STYLED`) that downloads the exported
  file and checks its raw text for `rgb(245, 246, 249)` - the resolved
  value of the `--color-surface-sunken` token used for every chip's fill -
  which could only appear in the output if the baking step actually ran.
  Also manually inspected the downloaded file's content directly (not just
  the boolean check): confirmed real `rgb(...)` values throughout, correct
  `xmlns`, and a clean `</svg>` close.
- **Found & fixed:** 2026-09-13 (building task 15, before shipping).
