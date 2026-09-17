# PDF export's step-bounds reader also matched token groups

> 📌 **Doc status: CURRENT** — one entry in the [Fixed Issues log](./README.md).

- **What broke:** an external code-review evaluation of the
  `StepCard`/`TokenChip` extraction (see
  [../phase-3/progress/architecture-stepcard-tokenchip-extraction.md](../phase-3/progress/architecture-stepcard-tokenchip-extraction.md))
  found that `pdf-export.ts`'s `readStepBounds()` could feed PDF pagination
  corrupted step positions on some documents. Caught via source review, not
  a symptom seen in the running app - confirmed by direct code inspection,
  not by a visibly broken export.
- **Root cause:** `readStepBounds()` selected every `[data-step-id]`
  element to build the list of step-card positions/heights that
  `paginateSteps` packs onto pages. `TokenChip`'s own outer `<g>` also
  carries `data-step-id` (needed for `pointer-drag.ts`'s drop-target
  resolution, unrelated to pagination), so the selector matched every token
  group in the document too - each contributing a spurious zero-height
  "step" entry, positioned at the token's own *local* transform coordinates
  (relative to its step's tokens-area group) rather than the document-level
  Y a real step's transform represents. Sorted alongside the real step
  entries, these could shift page-break decisions.
- **Fix:** `readStepBounds()` now selects `[data-step-index]` instead -
  the attribute `StepCard` already sets uniquely on step groups (see
  `pointer-drag.ts`'s `resolveStepDropIndex`, which already relied on this
  same distinction), which `TokenChip` never sets. One-line selector
  change, no markup added.
- **Verified by:** `npm run lint`/`typecheck`/`test` (141 tests,
  unchanged)/`build` all clean. A driver-based regression test was
  attempted but found not currently possible: the existing 18-step/
  4-tokens-per-step pagination test document (`PDF_EXPORT_PRODUCES_MULTIPLE_PAGES`
  in `.claude/skills/run-instruction-builder/driver.mjs`) is too uniform to
  expose this bug - a byte-level diff of the multi-page PDF exported by the
  pre-fix and post-fix code is identical except for the embedded
  `/CreationDate` timestamp, since every step in that document has the same
  height and even spacing, so the corrupted token entries get absorbed into
  page-1's packing slack without ever shifting a real page-break boundary.
  Tracked as an open item rather than shipped with a test that doesn't
  actually cover the bug - see
  [../known-issues.md](../known-issues.md#pdf-pagination-selector-fix-has-no-driver-regression-test-yet).
- **Found & fixed:** 2026-09-17 (external code-review evaluation of the
  `StepCard`/`TokenChip` extraction).
