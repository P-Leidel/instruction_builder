# Row-wrap connectors reading as one continuous bar across several rows

> 📌 **Doc status: CURRENT** — one entry in the [Fixed Issues log](./README.md).

- **What broke:** in a step wrapping across 3+ rows, the connector bends
  between rows visually merged into what looked like a single line running
  down the whole step, instead of distinct "end of row N → start of row
  N+1" hooks - reported from a screenshot.
- **Root cause:** the bend was routed through each row's own mid-height.
  Since every full row's last chip sits at the same x, consecutive wraps'
  vertical segments landed on that same x and chained together; the
  horizontal leg also overlapped the next row's own same-row connectors
  (both drawn at that row's mid-height).
- **Fix:** route the bend through the middle of the specific gap *between*
  the two rows it connects, not either row's mid-height - giving each wrap
  its own y-band with no overlap.
- **Verified by:** reproducing a 4-row/24-token step and confirming three
  visually distinct hooks in a screenshot.
- **Found & fixed:** 2026-09-13.
