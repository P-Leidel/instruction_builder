import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { BAKED_STYLE_PROPS } from "./svg-export";

/**
 * A guardrail for a real, if not-yet-shipped, risk flagged by a 2026-09-14
 * architecture review (see docs/known-issues.md): `BAKED_STYLE_PROPS` is a
 * hand-maintained allowlist of exactly which CSS properties get inlined
 * onto an exported SVG/PNG, and nothing previously checked it against the
 * `.instruction-canvas__*` rules in global.css it's implicitly describing.
 * A future visual property added there (an `opacity`, a `box-shadow`) that
 * isn't already on the allowlist would silently vanish from every export -
 * no lint, no type error, only a visual diff against a downloaded file
 * would catch it. This test parses global.css itself and fails loudly
 * instead.
 *
 * Reads the file directly via `node:fs` rather than importing it (even
 * with Vite's `?raw` suffix, which normally returns a file's contents as a
 * plain string) - Vitest mocks any `.css`-extensioned import to an empty
 * string by default regardless of query suffix, unless `test.css` is
 * configured otherwise; reading the file directly sidesteps that entirely
 * rather than carving out a config exception for one test.
 *
 * This is the one exception to task 20's rule that the export pipeline
 * stays covered by the Playwright driver, not Vitest (see
 * docs/phase-2/plans/task-20-automated-testing-plan.md) - unlike the rest
 * of svg-export.ts, this specific check never touches the DOM: it's pure
 * text parsing of a static file, exactly the kind of thing Vitest is for.
 */

// Layout/interaction properties this app's canvas rules legitimately set
// on `.instruction-canvas__*` elements that have nothing to do with a
// static export's *appearance* - baking them would be meaningless (cursor,
// touch-action), or they're already handled a different way (the root
// <svg>'s width/height/display come from cloneCanvasForExport's explicit
// attributes, taken from the live element's viewBox, not from baked CSS).
const KNOWN_NON_VISUAL_PROPS = new Set([
  "display",
  "width",
  "height",
  "cursor",
  "outline",
  "outline-offset",
  "touch-action",
  // Alongside cursor/touch-action above: an interaction property, and a
  // downloaded SVG has no interaction to opt out of. On the root <svg>
  // (see docs/fixed-issues/drag-marked-text-instead-of-dragging.md).
  "user-select",
  "-webkit-user-select",
  // From `.instruction-canvas__heading`'s rule - the panel's plain HTML
  // <h2>, a sibling of the <svg>, not a descendant of it, so never part of
  // what gets exported at all. Margin has no rendering effect on SVG shape
  // elements regardless, so this is doubly safe to skip.
  "margin",
]);

function instructionCanvasPropertiesUsedIn(css: string): Set<string> {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const properties = new Set<string>();
  // This app's global.css is flat (no SCSS-style nesting) with at most one
  // level of `@media { ... }` wrapping - a rule body never itself contains
  // a brace, so "selector { body }" with no braces in either half matches
  // every leaf rule (top-level or nested inside `@media`) without needing
  // a real CSS parser.
  for (const match of withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const [, selector, body] = match;
    if (!selector.includes(".instruction-canvas__")) continue;
    for (const propMatch of body.matchAll(/(-{0,2}[a-z][a-z-]*)\s*:/g)) {
      properties.add(propMatch[1]);
    }
  }
  return properties;
}

describe("BAKED_STYLE_PROPS", () => {
  it("covers every visual CSS property global.css sets on .instruction-canvas__* elements", () => {
    const cssPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "../styles/global.css");
    const css = readFileSync(cssPath, "utf-8");
    const usedProperties = instructionCanvasPropertiesUsedIn(css);
    expect(usedProperties.size).toBeGreaterThan(0); // sanity check the parser actually found rules

    const bakedProperties = new Set<string>(BAKED_STYLE_PROPS);
    const unaccountedFor = [...usedProperties].filter(
      (prop) => !bakedProperties.has(prop) && !KNOWN_NON_VISUAL_PROPS.has(prop),
    );

    expect(unaccountedFor).toEqual([]);
  });
});
