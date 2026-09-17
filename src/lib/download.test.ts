import { describe, it, expect } from "vitest";
import { slugify } from "./download";

describe("slugify", () => {
  it("lowercases and hyphenates a title", () => {
    expect(slugify("My Grandma's Recipe")).toBe("my-grandma-s-recipe");
  });

  it("trims leading/trailing hyphens left over from stripped punctuation", () => {
    expect(slugify("  -- Weird Title! --  ")).toBe("weird-title");
  });

  it("falls back to 'untitled-instructions' when nothing usable remains", () => {
    // Matches today's actual default document title (docs/known-issues.md's
    // still-open filename item) - this is current behavior, not a bug to
    // route around here.
    expect(slugify("Untitled instructions")).toBe("untitled-instructions");
    expect(slugify("!!!")).toBe("untitled-instructions");
    expect(slugify("")).toBe("untitled-instructions");
  });
});
