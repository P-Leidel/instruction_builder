# Stale step selection after a persisted document loads

> 📌 **Doc status: CURRENT** — one entry in the [Fixed Issues log](./README.md).

- **What broke:** after a page reload with a previously-saved document,
  nothing appeared selected in the canvas or side panels.
- **Root cause:** `selectedStepId` initializes at module load (synchronously,
  before persistence's async IndexedDB read resolves) against the
  throwaway default document's first step. Once the real saved document
  replaced it, `selectedStepId` still pointed at a step id that no longer
  existed in the loaded document.
- **Fix:** `initPersistence` now calls `selectStep` on the loaded document's
  first step once it resolves.
- **Verified by:** the persistence-across-reload driver check, extended to
  also confirm a step is selected post-reload.
- **Found & fixed:** 2026-09-13.
