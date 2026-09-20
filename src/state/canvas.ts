import { computed, signal } from "@preact/signals";
import {
  DESKTOP_QUERY,
  computeCanvasLayout,
  resolveDropTarget,
  resolveStepDropIndex,
  type TokenDropSlot,
} from "../lib/canvas-layout";
import { clientToCanvasPoint, isInsideViewport } from "../lib/pointer-drag";
import { document } from "./document";

/**
 * Tracks the `min-width: 800px` breakpoint so the live editable canvas can
 * switch between desktop's wrapped multi-row chips and mobile's single row
 * per step. Moved here from `app.tsx`'s `useIsDesktop` hook (and, before the
 * 2026-09-17 export-viewport-independence remediation, from
 * `InstructionCanvas.tsx`): the viewport is now app state rather than one
 * component's local state, so a module holding no canvas ref and no props
 * can still resolve a pointer position against the live layout.
 *
 * Deliberately *not* part of `createDocumentSession()`, despite
 * `liveLayout` below being derived from the document: a viewport is a
 * property of the browser window, not of a document session, and two
 * sessions open at once would still share one screen.
 *
 * Defaults to `true` rather than reading `matchMedia` here - see
 * `startViewportTracking` for why this module touches no DOM at import.
 */
export const isDesktop = signal(true);

/**
 * Seeds `isDesktop` from the real viewport and keeps it current. `main.tsx`
 * owns calling this, synchronously and *before* `render()`, so the first
 * paint already has the right breakpoint and no layout flash occurs.
 *
 * Split out of module scope for the same reason `initPersistence()` in
 * `persistence.ts` is: `vitest.config.ts` runs the suite under
 * `environment: "node"`, where a module-level `window.matchMedia(...)` would
 * throw at import and take down every test file that transitively imports
 * this one. `canvas.test.ts` importing this module at all is what proves
 * that contract still holds - if it regresses, that file stops loading.
 *
 * Returns nothing: the listener lives exactly as long as the page does, so
 * there is no teardown to hand back and nothing that could call it.
 */
export function startViewportTracking(): void {
  const mql = window.matchMedia(DESKTOP_QUERY);
  isDesktop.value = mql.matches;
  mql.addEventListener("change", () => {
    isDesktop.value = mql.matches;
  });
}

/**
 * Narrows the document down to just its step list before the layouts read
 * it. Load-bearing, not a convenience: `document` is a single signal holding
 * the *whole* document, so editing the title produces a new document object
 * that shares the same `steps` array. A computed returning that unchanged
 * array doesn't bump its own version, which leaves both layouts below on
 * their cached values - exactly the dependency the `useMemo(..., [steps])`
 * calls in `App` used to declare by hand. Reading `document.value.steps`
 * directly from each layout instead would recompute the full geometry on
 * every keystroke in the document-title field.
 */
const steps = computed(() => document.value.steps);

/**
 * The live editable canvas's geometry, at the real viewport.
 */
export const liveLayout = computed(() => computeCanvasLayout(steps.value, isDesktop.value));

/**
 * The geometry Preview and the hidden export canvas both render with, and
 * the bounds `lib/pdf-export.ts` paginates against - pinned to desktop
 * regardless of `isDesktop` (2026-09-17 remediation). A shared or printed
 * document shouldn't render structurally differently depending on which
 * device happened to trigger the export, and Preview's whole job is to
 * stand in for what export actually produces (see `InstructionCanvas.tsx`'s
 * `readOnly` doc comment). Both read-only instances sharing this one
 * computed also means it's evaluated once, not twice, for provably the same
 * input.
 */
export const exportLayout = computed(() => computeCanvasLayout(steps.value, true));

/**
 * The live editable canvas: the rendered `<svg>` every client-to-canvas
 * conversion reads its CTM from, and the scrolling card that clips it. Null
 * when no editable canvas is mounted (Preview mode swaps it out entirely -
 * see app.tsx). Registered by the editable `InstructionCanvas` instance
 * itself; the read-only Preview and hidden export instances deliberately
 * never register, so a drag can only ever resolve against the canvas the
 * user is editing.
 *
 * One signal holding both elements rather than two holding one each: the
 * same effect in the same component registers and clears them together, and
 * a resolution is only meaningful if both describe the same mount. Two
 * signals could disagree for a render; a pair cannot.
 *
 * A signal rather than a ref threaded down from `App` for the same reason
 * `liveLayout` is a computed rather than a prop: the token picker is not a
 * child of the canvas and has no path to its node, and making `App` hold the
 * ref and pass it along would put `App` back in the middle of an interaction
 * it has nothing to do with (the coupling the 2026-09-20 candidate 4 change
 * removed). With this, both drag sources read the layout and the elements
 * from the same module and take nothing from `App` at all.
 */
export interface LiveCanvas {
  svg: SVGSVGElement;
  viewport: HTMLElement;
}

export const liveCanvas = signal<LiveCanvas | null>(null);

/**
 * Where a token drag currently hovering at (`clientX`, `clientY`) would
 * land, or null when it is over no step - the one call both drag sources
 * (TokenChip, TokenPicker) make on every move.
 *
 * This is the whole composition candidate 1 exists to make possible: reject
 * points the canvas cannot actually be seen at (`isInsideViewport`), one DOM
 * read to convert the rest (`clientToCanvasPoint`), then pure geometry
 * against the same `liveLayout` the canvas was rendered from
 * (`resolveDropTarget`). It lives here, in state rather than in lib, because
 * only this module knows *which* canvas is live; the three functions it
 * calls know nothing about that and stay independently testable.
 *
 * The viewport check is not a detail. `resolveDropTarget` rejects the
 * canvas's own left and right padding, but it has no way to know that at the
 * mobile breakpoint the `<svg>` is wider than the card holding it, so a
 * client point over the page background beside the card still converts to a
 * canvas point inside a step. See `isInsideViewport` for the full reasoning.
 */
export function resolveLiveDropTarget(clientX: number, clientY: number): TokenDropSlot | null {
  const canvas = liveCanvas.value;
  if (!canvas) return null;
  if (!isInsideViewport(canvas.viewport, clientX, clientY)) return null;
  const point = clientToCanvasPoint(canvas.svg, clientX, clientY);
  if (!point) return null;
  return resolveDropTarget(point, liveLayout.value);
}

/**
 * Where a step dragged by its reorder handle would land, or null when no
 * editable canvas is mounted to resolve against. Same composition as
 * `resolveLiveDropTarget` above, and unlike it this is only ever called on
 * drop: a step reorder has no live insertion marker of its own (see
 * docs/known-issues.md).
 *
 * Deliberately *without* the viewport check. A step reorder is a drag along
 * a vertical list and has always been horizontally indifferent - the DOM
 * version this replaced took a `clientY` and nothing else - so a handle
 * released wide of the card still drops the step at the row it was level
 * with. Adding the check here would be a behaviour change in its own right,
 * not a fix, and would make a reorder fail in the one direction users are
 * most likely to overshoot. The asymmetry is deliberate and recorded in
 * docs/adr/0005-viewport-guard-on-token-drops-only.md, since two functions
 * this alike differing by one line otherwise reads as an oversight.
 */
export function resolveLiveStepDropIndex(clientX: number, clientY: number): number | null {
  const canvas = liveCanvas.value;
  if (!canvas) return null;
  const point = clientToCanvasPoint(canvas.svg, clientX, clientY);
  if (!point) return null;
  return resolveStepDropIndex(point, liveLayout.value);
}
