import { describe, it, expect, beforeEach } from "vitest";
import { document, addTokenToStep, addStep, updateTitle } from "./document";
import { isDesktop, liveLayout, exportLayout } from "./canvas";
import { createEmptyDocument, createToken } from "../model/instruction";

// Unlike document.test.ts, which builds isolated sessions through
// `createDocumentSession()`, these tests drive the *default session's*
// module-level `document` signal - `liveLayout`/`exportLayout` are derived
// from that one global and deliberately have no per-session factory (the
// viewport isn't a property of a document session). Safe because Vitest
// isolates per file; this beforeEach handles isolation within the file.
beforeEach(() => {
  document.value = createEmptyDocument();
  isDesktop.value = true;
});

function fillFirstStepWith(tokenCount: number): void {
  const stepId = document.value.steps[0].id;
  for (let i = 0; i < tokenCount; i++) {
    addTokenToStep(stepId, createToken("object", "apple", `t${i}`));
  }
}

describe("canvas layout signals", () => {
  // The load-bearing one. Encodes the 2026-09-17 export-viewport-independence
  // invariant, which until this change existed only as a comment in App's
  // body and was held by nothing: a shared or printed document must not
  // render structurally differently depending on the exporting device.
  it("pins exportLayout to desktop while liveLayout follows the viewport", () => {
    fillFirstStepWith(8);
    const pinned = exportLayout.value;
    const live = liveLayout.value;

    isDesktop.value = false;

    expect(exportLayout.value).toBe(pinned);
    expect(liveLayout.value).not.toBe(live);
  });

  it("collapses every step to a single chip row on mobile", () => {
    fillFirstStepWith(8);
    expect(liveLayout.value.layouts[0].chipsPerRow).toBe(6);

    isDesktop.value = false;

    expect(liveLayout.value.layouts[0].chipsPerRow).toBe(8);
    expect(exportLayout.value.layouts[0].chipsPerRow).toBe(6);
  });

  it("tracks document edits", () => {
    const before = liveLayout.value;
    expect(before.layouts).toHaveLength(1);

    addStep();

    expect(liveLayout.value).not.toBe(before);
    expect(liveLayout.value.layouts).toHaveLength(2);
    expect(exportLayout.value.layouts).toHaveLength(2);
  });

  // Guards the private `steps` computed in canvas.ts. `document` is one
  // signal holding the whole document, so a title edit produces a new
  // document object around the *same* steps array. Deriving the layouts
  // from `document.value.steps` directly would recompute the full geometry
  // on every keystroke in the title field - a cost the `useMemo(..., [steps])`
  // this change replaced did not pay.
  it("does not recompute either layout for a title-only edit", () => {
    fillFirstStepWith(3);
    const live = liveLayout.value;
    const pinned = exportLayout.value;

    updateTitle("Pannenkoeken");

    expect(document.value.meta.title).toBe("Pannenkoeken");
    expect(liveLayout.value).toBe(live);
    expect(exportLayout.value).toBe(pinned);
  });

  // The no-DOM-at-import contract: vitest runs under `environment: "node"`,
  // where a module-level `window.matchMedia(...)` in canvas.ts would throw
  // at import and take this whole file down with it. Reaching this
  // assertion at all is the proof; the default is asserted so the
  // expectation is written down rather than implied.
  it("imports under node without touching the DOM, defaulting to desktop", () => {
    expect(typeof globalThis.window).toBe("undefined");
    expect(isDesktop.value).toBe(true);
  });
});
