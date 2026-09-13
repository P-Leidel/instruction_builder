import { get, set } from "idb-keyval";
import { signal, effect } from "@preact/signals";
import { document, selectStep } from "./document";
import { CURRENT_SCHEMA_VERSION, type InstructionDocument } from "../model/instruction";

const STORAGE_KEY = "instruction-builder:document";
const PROBE_KEY = "instruction-builder:probe";
// Short on purpose: `pagehide`/`visibilitychange` (below) turned out not to
// reliably flush a same-tab reload in Chromium - the async IndexedDB write
// gets abandoned mid-flight once navigation tears down the JS realm, which
// is a browser limitation, not something fixable from page script (see the
// comment on flushPendingSave). Keeping the debounce short instead shrinks
// the window in which an edit could be lost to something no real user
// hits (closing/reloading within ~200ms of typing), while still coalescing
// the common case of several keystrokes in a row into one write.
const SAVE_DEBOUNCE_MS = 200;

export type PersistenceStatus = "loading" | "available" | "unavailable";

/**
 * Phase 2 task 12: whether IndexedDB persistence is actually working this
 * session. Safari private browsing historically caps or blocks persistent
 * IndexedDB storage (a risk called out explicitly in the plan) - rather than
 * letting saves fail silently, `App` shows a visible warning when this is
 * "unavailable" so the user knows their work won't survive a reload.
 */
export const persistenceStatus = signal<PersistenceStatus>("loading");

let saveTimer: ReturnType<typeof setTimeout> | undefined;
let pendingDoc: InstructionDocument | undefined;

/**
 * Writes whatever the most recent debounced change was, right now, bypassing
 * the rest of the debounce window. Called from the `visibilitychange`/
 * `pagehide` listeners below so that backgrounding the tab (switching away
 * on desktop, or the OS suspending it on mobile) flushes a pending edit
 * instead of leaving it queued in a `setTimeout` that never fires.
 *
 * This is a best-effort backstop, not a guarantee: an automated test that
 * reorders a step and calls `page.reload()` immediately, with no pause,
 * still loses that edit even with this in place - a same-tab reload in
 * Chromium tears down the JS realm (abandoning any in-flight async
 * IndexedDB write) faster than `pagehide` can be relied on to complete one.
 * That's a browser limitation, not something fixable from page script - see
 * `SAVE_DEBOUNCE_MS` above for the actual mitigation (a short debounce, so
 * the vulnerable window is small enough that no real user hits it).
 */
function flushPendingSave(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = undefined;
  }
  if (pendingDoc === undefined || persistenceStatus.value !== "available") return;
  const doc = pendingDoc;
  pendingDoc = undefined;
  set(STORAGE_KEY, doc).catch(() => {
    persistenceStatus.value = "unavailable";
  });
}

/**
 * Feature-detects storage by actually round-tripping a value (rather than
 * just checking `"indexedDB" in window`, which is true in Safari private
 * mode even though writes are blocked/capped there), then loads any
 * previously-saved document before wiring up auto-save. Call once, and
 * await it before the app's first render - otherwise the default empty
 * document (created synchronously at import time in state/document.ts)
 * would flash on screen and then get clobbered once the real saved
 * document loads a moment later.
 *
 * A saved document from a newer, incompatible schema version is discarded
 * in favor of the default empty document rather than crashing - see
 * docs/phase-1/Architecture.md section 2.3 for the full migration strategy,
 * which task 19 (Import System) implements; task 12 only needs to not lose
 * data or throw on an old/foreign document.
 */
export async function initPersistence(): Promise<void> {
  try {
    await set(PROBE_KEY, true);
    if ((await get(PROBE_KEY)) !== true) {
      throw new Error("IndexedDB round-trip did not return the written value");
    }

    const saved = await get<InstructionDocument>(STORAGE_KEY);
    if (saved && saved.schemaVersion === CURRENT_SCHEMA_VERSION) {
      document.value = saved;
      // `selectedStepId` was already initialized (at module load, in
      // document.ts) against the throwaway default document created before
      // this async load resolved - it points at a step id that no longer
      // exists once `saved` replaces it, so reselect the loaded doc's first
      // step (also resets selectedTokenId via selectStep).
      selectStep(saved.steps[0]?.id ?? null);
    }
    persistenceStatus.value = "available";
  } catch {
    persistenceStatus.value = "unavailable";
    return;
  }

  effect(() => {
    pendingDoc = document.value;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(flushPendingSave, SAVE_DEBOUNCE_MS);
  });

  // `visibilitychange` -> "hidden" fires reliably on tab close, reload, and
  // navigation (and backgrounding on mobile) while the page is still alive
  // enough for an IndexedDB write to complete - unlike `beforeunload`, which
  // doesn't reliably allow async work to finish. `pagehide` is a second,
  // Safari-friendly backstop for the same "about to go away" moment.
  window.addEventListener("visibilitychange", () => {
    if (window.document.visibilityState === "hidden") flushPendingSave();
  });
  window.addEventListener("pagehide", flushPendingSave);
}
