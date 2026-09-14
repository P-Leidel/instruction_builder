# Row-wrap bends looked inconsistently "tight" between wraps

> 📌 **Doc status: CURRENT** — one entry in the [Fixed Issues log](./README.md).

- **What broke:** the user reported that different row-wrap bends in the
  same document didn't look the same, specifically in curve tightness.
- **Root cause:** *not* a geometry bug - two wraps' path data, dumped and
  compared directly, were mathematically identical (one was exactly the
  other translated down by one row height). The real cause was rendering at
  scale: the 8-design-unit corner radius amounted to only a handful of
  actual screen pixels once the canvas was scaled down for a wide/tall
  document, small enough that rasterization made otherwise-identical curves
  read as inconsistently rounded.
- **Fix:** raised `CONNECTOR_CORNER_RADIUS` and `CONNECTOR_LEAD_OUT` from 8
  to 12 (kept equal, so the stub and curve read as one shape) - large
  enough to render as an unambiguous, consistent curve at any canvas scale.
- **Verified by:** re-rendering a 3-row wrapped step and visually comparing
  both bends side by side.
- **Found & fixed:** 2026-09-13.
