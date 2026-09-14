# Token connector lines invisible despite correct markup

> 📌 **Doc status: CURRENT** — one entry in the [Fixed Issues log](./README.md).

- **What broke:** the lines drawn between a step's tokens (in array order)
  had valid path coordinates and a correctly-applied `stroke`, confirmed via
  `getComputedStyle`/`getBBox()` - but were imperceptible in an actual
  screenshot.
- **Root cause:** the gap the line was drawn in was only 8 design units
  wide with a pale `#bbb` stroke, too subtle against the light chip/step
  backgrounds at the canvas's rendered scale. DOM/style inspection said
  "this is correct"; only a real screenshot showed it wasn't visible.
- **Fix:** widened the inter-chip gap (8 → 16 design units) and used a
  darker, thicker stroke.
- **Verified by:** a cropped/zoomed screenshot of the gap specifically, and
  a driver check that counts connector-line elements against the expected
  token-count-minus-one.
- **Found & fixed:** 2026-09-13.
