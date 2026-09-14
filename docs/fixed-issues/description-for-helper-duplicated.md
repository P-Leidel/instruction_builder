# `descriptionFor` helper duplicated verbatim across two components

> 📌 **Doc status: CURRENT** — one entry in the [Fixed Issues log](./README.md).

- **What broke:** nothing user-visible - an identical 3-line helper
  (`SAMPLE_TOKENS.find((s) => s.iconId === iconId)?.description`) was
  copy-pasted between `StepDetails.tsx` and `TokenDetails.tsx`, a latent
  drift risk rather than a bug.
- **Root cause:** the helper was written locally in each component instead
  of being added to `data/sample-tokens.ts`, which already exports the
  `SAMPLE_TOKENS`/`CATEGORY_LABELS` data it reads.
- **Fix:** moved `descriptionFor` into `data/sample-tokens.ts` (exported
  alongside `SAMPLE_TOKENS`/`CATEGORY_LABELS`) and imported it from both
  components instead of redefining it.
- **Verified by:** `npm run lint`/`typecheck`/`build` passing with no
  duplicate-definition or unused-import errors.
- **Found & fixed:** 2026-09-13 (via code review, `docs/phase-2/reviews/2026-09-13-1516-review.md`).
