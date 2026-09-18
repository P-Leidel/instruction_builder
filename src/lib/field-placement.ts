/**
 * Where a field popover sits relative to the trigger button that opened it
 * - see `components/FieldPopover/FieldPopover.tsx` for the panel itself and
 * `CONTEXT.md` for what a field popover is.
 *
 * Extracted from inside FieldPopover's own effect by the 2026-09-18
 * architecture review (findings 6 and 8). The reason is testability, not
 * reuse: FieldPopover is the only caller and is expected to stay the only
 * caller, so this is a hypothetical seam by the usual "one adapter means a
 * hypothetical seam, two means a real one" test. What justifies it is that
 * the arithmetic was previously unreachable from any test this repo can
 * run - `vitest.config.ts` is `environment: "node"` and matches only
 * `*.test.ts`, so nothing under `src/components/` is testable at all
 * without adding a DOM test environment, which this project has weighed
 * and declined on its own merits (see
 * `docs/adr/0003-no-component-test-environment.md`). Placement is the part of that
 * panel most likely to be wrong on a device nobody here owns, so it is the
 * part worth being able to test on a machine with no browser. Please don't
 * inline it back for want of a second caller.
 *
 * Takes plain numbers rather than `DOMRect`/`Window` for the same reason:
 * a test constructs an input with object literals and no DOM whatsoever.
 * The caller does all the measuring.
 */

/** The measured trigger button, in viewport coordinates (a `DOMRect`'s own fields). */
export interface AnchorRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** The measured panel - `offsetWidth`/`offsetHeight`, since it is already rendered when this runs. */
export interface PopoverSize {
  width: number;
  height: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface FieldPlacementInput {
  anchor: AnchorRect;
  popover: PopoverSize;
  viewport: ViewportSize;
}

/**
 * Which edge of the anchor the panel aligns to, and which side of it the
 * panel sits on. Deliberately not pixel coordinates: CSS still owns the
 * actual positioning (`.field-popover` is absolutely positioned inside
 * `.field-popover-anchor`, and these two answers select the
 * `--right`/`--above` modifiers), so this module never has to know about
 * the anchor wrapper, the 0.4rem trigger gap, or scroll position - and the
 * panel cannot drift away from its trigger while the page scrolls the way
 * a `position: fixed` pixel pair would.
 */
export interface FieldPlacement {
  horizontal: "left" | "right";
  vertical: "below" | "above";
}

/**
 * Minimum space left between the panel and the edge of the window, per
 * edge. 8px, preserving the threshold the flip has always used in
 * practice; `global.css`'s `.field-popover` `max-width` is expressed
 * against this same number rather than a second literal of its own.
 *
 * The ~6.4px (0.4rem) gap CSS leaves between trigger and panel is
 * deliberately not modelled here. It applies equally whether the panel
 * sits above or below, so it cannot change which side wins; it only makes
 * the absolute "does this fit" test about 6px optimistic, which this
 * gutter more than absorbs. Modelling it would mean a second constant that
 * has to stay in step with a CSS value, for no decision it could change.
 */
export const VIEWPORT_GUTTER = 8;

/**
 * Below-left is the default, and matches what CSS does unaided.
 *
 * Horizontally, the panel flips to right-aligned when a left-aligned one
 * would run past the right edge. Right-aligned means aligned to the
 * trigger's right edge, not the window's, so it is on-screen by
 * construction as long as the trigger is.
 *
 * Vertically, the panel flips above only when it does not fit below *and*
 * genuinely does fit above. When neither side fits, it stays below: a
 * panel overflowing the bottom can still be scrolled to, while one
 * overflowing the top is clipped by the window with no way to reach it.
 */
export function resolveFieldPlacement({ anchor, popover, viewport }: FieldPlacementInput): FieldPlacement {
  const overflowsRight = anchor.left + popover.width > viewport.width - VIEWPORT_GUTTER;

  const spaceBelow = viewport.height - VIEWPORT_GUTTER - anchor.bottom;
  const spaceAbove = anchor.top - VIEWPORT_GUTTER;
  const fitsBelow = popover.height <= spaceBelow;
  const fitsAbove = popover.height <= spaceAbove;

  return {
    horizontal: overflowsRight ? "right" : "left",
    vertical: !fitsBelow && fitsAbove ? "above" : "below",
  };
}
