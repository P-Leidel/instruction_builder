# Row-wrap connector's stub only existed on one end

> 📌 **Doc status: CURRENT** — one entry in the [Fixed Issues log](./README.md).

- **What broke:** the row-wrap bend poked a short stub out past the *source*
  chip's border before curving, but landed flush against the *destination*
  chip's border on the other end - reported by the user as visually
  asymmetric.
- **Root cause:** the lead-out stub (added to keep the line visually
  distinct from the chip it leaves) was only ever computed for the source
  side; the destination side's approach was never given the same treatment.
- **Fix:** mirrored the stub - the destination side now gets an equal-length
  stub before a final straight run into the chip, confirmed via the raw SVG
  path data (`M 656 60 L 664 60 ...` mirrored by `... L -8 132 L 0 132`).
  The canvas's reserved margin was doubled so the new destination-side stub
  can never overflow a step card's edge.
- **Verified by:** inspecting the generated path's exact coordinates for
  both ends of a wrap.
- **Found & fixed:** 2026-09-13.
