# Saved document silently discarded and overwritten on a schema version mismatch

> 📌 **Doc status: CURRENT** — one entry in the [Fixed Issues log](./README.md).

- **What broke:** if the document saved in IndexedDB ever had a
  `schemaVersion` other than `CURRENT_SCHEMA_VERSION` (a corrupted record, or
  - once a v2 ships - an old v1 save on a newer build), `initPersistence`
  discarded it with no warning, and the autosave `effect()` then overwrote it
  in IndexedDB with the empty default document about 200ms later - the old
  save was gone for good, silently, before the user had done anything.
  Unreachable in practice today (schema version 1 is still the only version
  that has ever existed), but a live, verifiable defect in the load path
  itself, not a hypothetical.
- **Root cause:** `state/persistence.ts` only ever loaded `saved` when
  `saved.schemaVersion === CURRENT_SCHEMA_VERSION`; any other case fell
  through with no `else`, leaving `document.value` at its throwaway default -
  which the very next autosave cycle (wired up unconditionally right after)
  then wrote back to the same IndexedDB key, clobbering the real save. The
  JSON import path (task 19) already had a `migrate()` step for exactly this
  situation; the IndexedDB load path never called it.
- **Found by:** an external architecture audit (a third-party HTML report,
  archived at [phase-2/audits/2026-09-13-external-architecture-audit.html](../phase-2/audits/2026-09-13-external-architecture-audit.html) -
  not the `code-reviewer` subagent) that traced this exact sequence through
  `persistence.ts`. Independently confirmed by reading the file before
  making any change.
- **Fix:** a mismatched `saved.schemaVersion` now goes through the same
  `migrate()` the import flow uses instead of being silently dropped. If
  `migrate` also rejects it (genuinely corrupted, or from a newer app
  version than this one supports), the app falls back to the empty document
  and shows an error toast explaining the load failed - and a new
  `skipNextAutosave` guard skips exactly the one autosave write that would
  otherwise have overwritten the still-present, still-unrecovered record on
  disk before the user has made a single edit. The very next real edit
  autosaves normally.
- **Verified by:** a new Playwright regression check
  (`VERSION_MISMATCH_HANDLED_SAFELY` in the project skill's driver) that
  seeds IndexedDB directly with a `schemaVersion: 2` document (bypassing the
  app, since no UI path produces one), reloads, and confirms an error toast
  appears, the original record is still intact on disk immediately after
  reload, and a subsequent real edit autosaves normally - confirmed to fail
  (toast never appears) against the pre-fix code and pass after.
- **Found & fixed:** 2026-09-13.
