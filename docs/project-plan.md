# Visual Instruction Builder

> 📌 **Doc status: CURRENT (reference).** Defines project scope and the
> original task list; not updated per-task. For live task status, see
> [milestones.md](./milestones.md#documentation-status-conventions).

> **Status (2026-09-13): Phase 2 (MVP) is in progress.** Phase 1 (Concept
> Validation) is complete; Phase 2 tasks 5–14, 18, and 19 are done (18/19,
> JSON Export/Import, were deliberately pulled ahead of 15–17 on request) and
> task 15 (SVG Export) is next. This is well past the "planning" stage - see
> [milestones.md](./milestones.md) for the current task-by-task breakdown
> and [phase-2/progress/README.md](./phase-2/progress/README.md) for what's
> actually been built. Historical, phase-specific docs live under
> [phase-1/](./phase-1/) and [phase-2/](./phase-2/); some of their content
> (especially phase-1/'s) has since been superseded by the real
> implementation - milestones.md is the doc to trust for current status.

## Short Summary

Visual Instruction Builder is a fast, browser-based web application that allows users to create step-by-step instructions by arranging visual icons (actions, objects, tools, quantities, warnings, etc.) on a structured canvas.

The application is designed to create food recipes first, but its core system is generic and can later be reused for assembly manuals, repair guides, classroom procedures, safety instructions, and other visual workflows.

Users can export their finished instructions as:

- Visual pictogram guides
- Detailed instructions with text
- SVG files
- PNG files
- PDF/Print layouts
- JSON project files for later editing

---

# Project Goals

## Primary Goal

Create the easiest possible way to build visual instructions using drag-and-drop or tap-based interaction.

## Core Principles

### Free to Build
- Target budget: €0
- Use free, open-source technologies
- Use free static hosting
- Avoid server infrastructure whenever possible

### Single Purpose
- The application should do one thing exceptionally well: Build visual instructions.

### Generic Instruction Engine
- Support recipes, assembly manuals, repair guides, cleaning instructions, safety procedures, educational workflows, and other step-by-step processes.

### Fast and Responsive
- Instant startup, responsive UI, smooth interactions, and mobile-first design.

### Accessible
- Support icons + text, keyboard navigation, high contrast, and touch devices.

### Offline First
- Users should be able to build, save, and export instructions without an internet connection.

---

# Recommended Technical Direction

## Platform
- Progressive Web App (PWA)

## Technology Stack

A lighter stack than originally scoped — every choice below is picked to minimize bundle size and dependency count while still meeting the "fast, instant startup" principle.

| Concern | Choice | Why |
|---|---|---|
| Language | TypeScript | Type safety for a growing instruction data model |
| UI framework | Preact | ~3KB vs React's ~45KB; same JSX/component model, no rewrite risk |
| Build tool | Vite | Fast dev server, minimal config |
| State management | [@preact/signals](https://github.com/preactjs/signals) | Built for Preact, no separate store library needed (drops Zustand); fine-grained reactivity keeps re-renders cheap on the canvas |
| Local persistence | [idb-keyval](https://github.com/jakearchibald/idb-keyval) | ~600-byte wrapper over IndexedDB instead of a full ORM (e.g. Dexie) — this app only needs get/set/list, not queries |
| Instruction canvas | Native SVG DOM | The canvas is built directly as SVG elements rather than `<canvas>` or a rendering library — this makes vector export nearly free (see Export Strategy below) |
| Hosting | Vercel | Static Vite deployment at the domain root; no backend or Vercel-specific runtime code is required |

**Removed from the original plan:** React (replaced by Preact), Zustand (replaced by signals). Net effect: one fewer runtime dependency and a smaller bundle, with no loss of capability for this app's scope.

## Export Strategy

Because the canvas is native SVG, all three visual export formats derive from one source of truth instead of three separate pipelines:

1. **SVG export** — Serialize the canvas DOM directly with `XMLSerializer`. No library needed; this is the cheapest export and should be built first, since PNG and PDF both build on it.
2. **PNG export** — Load the serialized SVG string into an `Image` (via a `Blob`/object URL), draw it to an offscreen `<canvas>` at the desired pixel density (2x/3x for sharpness), then call `canvas.toBlob()`. Still no external library.
3. **PDF export** — Two tiers, so the MVP isn't blocked on the harder option:
   - **Baseline (MVP):** a dedicated print stylesheet (`@media print`) plus `window.print()` → "Save as PDF". Zero dependencies, works everywhere, ships with Phase 2.
   - **Stretch (Phase 4 polish):** [jsPDF](https://github.com/parallax/jsPDF) + [svg2pdf.js](https://github.com/yWorks/svg2pdf.js) for a true vector PDF (selectable text, crisp icons, precise page layout) instead of a rasterized print capture. Load these two libraries lazily, only when a user actually exports a PDF, so they don't affect initial load time.

This reduces what was previously three loosely-specified export tasks into one pipeline with a clear dependency order and an explicit fallback, and avoids pulling in a heavier all-in-one export/rendering library.

---

# Implementation Plan

## Phase 1: Concept Validation
- Create a working prototype and validate the interaction model.

## Phase 2: MVP
- Build a complete instruction editor with saving, exporting, and mobile support.

## Phase 3: Recipe Content & Launch
- Build the recipe builder out fully (icon library, sample content, UI polish) and get it in front of real users, before investing in generalizing to other domains.

## Phase 4: Generalize
- Turn the now-proven recipe content into an actual swappable content-pack shape, validate it against a second, non-recipe domain, and add the in-app switcher/theming that makes multiple builders real. Also covers general polish (performance, accessibility, stretch export formats).

---

**Reprioritized 2026-09-14** (discussed and scoped with the user): Phase 3
was originally "Generic Instruction Framework" (a content-pack system, a
theme system, and second-domain validation, built before any one domain
was fully fleshed out). Decided instead to build the recipe domain out
fully first - a much larger icon library, aligned sample content, and a
UI polish pass - then publish and get real users on it, and only
generalize to a second domain once real recipe usage has shown what a
content pack actually needs to support (rather than guessing upfront).
Phase 3 also absorbs two of Phase 4's originally-planned tasks (Publish
MVP, Test Real Users) plus Refine UX as its own closing task, and folds in
one item previously tracked only as a known issue (the exported-filename
collision from unset `meta.title` - see
[known-issues.md](./known-issues.md)). Phase 4 keeps the rest of the
original Phase 3 (content packs, theme system, second-domain validation,
now evidence-based instead of speculative) plus its own original stretch/
optional tasks and closing task. See
[phase-3/progress/README.md](./phase-3/progress/README.md) for what's
actually shipped as Phase 3 proceeds.

---

# Step-by-Step Project Tasks

**Progress tracker:** see [milestones.md](./milestones.md) for current phase/task status, kept there as the single source of truth rather than duplicated here.

## Phase 1: Concept Validation
1. Define Instruction Model - Create a reusable data structure for instructions, including a schema version field from day one so later JSON exports can be migrated instead of breaking on import.
2. Design User Experience - Define editing workflows and interactions.
3. Create Wireframes - Design desktop and mobile layouts.
4. Build Project Foundation - Initialize the application architecture, linting, and free CI (GitHub Actions) for build/type checks on every push.

## Phase 2: MVP
5. Create UI Layout - Build the main application shell.
6. Implement Instruction Canvas - Enable instruction composition as native SVG elements (see Export Strategy).
7. Build Icon Library - Create categorized visual assets, sourced from a permissively-licensed set (e.g. Tabler Icons or Lucide, both MIT) and bundled locally rather than loaded from a CDN — required for offline-first, and avoids canvas-tainting `SecurityError`s on PNG export in Safari.
8. Create Live Preview - Display the final output while editing, before persistence exists so the core editing loop can be validated early.
9. Add Drag-and-Drop System - Support intuitive visual building, implemented with Pointer Events rather than the HTML5 Drag-and-Drop API, which has unreliable touch support and would otherwise conflict with task 10.
10. Implement Touch Support - Optimize mobile interactions.
11. Add Tap-to-Insert System - Improve usability on touch devices.
12. Build Data Persistence - Save projects locally via idb-keyval.
13. Implement Undo/Redo - Allow safe experimentation.
14. Implement Visual Validation - Detect incomplete instructions.
15. Develop SVG Export - Serialize the canvas DOM directly (`XMLSerializer`); no library required.
16. Develop PNG Export - Rasterize the serialized SVG to a `<canvas>` and export via `toBlob()`.
17. Implement Print/PDF Export - Ship a print-stylesheet baseline (`window.print()`) for the MVP; defer vector PDF (jsPDF + svg2pdf.js) to Phase 4.
18. Implement JSON Export - Allow future editing.
19. Create Import System - Reopen saved projects.
20. Add Automated Testing - Cover the instruction model, undo/redo, and export pipeline with unit tests using Vitest (native to the Vite toolchain, no separate test runner needed), run in CI.
21. Build Responsive Layouts - Support all common screen sizes.
22. Add Accessibility Features - Improve inclusivity and usability, including a keyboard-operable alternative to drag-and-drop (e.g. move-up/move-down buttons on each step) — accessible drag-and-drop is a known hard problem, and building the keyboard path now is cheaper than retrofitting a DnD library later.
23. Convert to PWA - Enable installation and offline operation on Vercel; keep Vite's `base`, manifest, and service-worker scope aligned to the Vercel domain root.
24. Optimize Performance - Keep interactions smooth and fast.

## Phase 3: Recipe Content & Launch
25. Expand Recipe Icon Library (curated v1) - Grow the icon library from its Phase 2 sample set (16 icons) to a curated, bounded list of common recipe actions/objects/tools, sourced from Lucide only (see [known-issues.md](./known-issues.md) for the accepted approximate-icon tradeoff). Deliberately not the library's final size - ongoing expansion beyond this curated list is Phase 4 task 36.
26. Expand Sample/Starter Tokens - Align `data/sample-tokens.ts` with the expanded icon set so default picker content matches.
27. Add Document Title UI - Let users set `meta.title` from within the app, fixing the every-export-downloads-as-"untitled-instructions" filename collision (previously tracked only as a known issue).
28. UI Polish Pass - A small, scoped visual/UX polish pass immediately before publishing - not an open-ended redesign.
29. Publish MVP - Deploy the static build to Vercel (moved from the original Phase 4).
30. Test Real Users - Validate assumptions through feedback; first round is informal (share the URL directly with a small group, gather feedback by conversation) (moved from the original Phase 4).
31. Refine UX - Improve workflows based on that feedback (moved from the original Phase 4).

## Phase 4: Generalize
32. Formalize the Content-Pack Shape - Turn the recipe content built in Phase 3 (icon library, sample tokens, units list - already isolated, swappable modules) into an actual pack mechanism, informed by what building one real domain out actually needed rather than guessed upfront.
33. Build & Validate a Second Domain - Build one non-recipe example (e.g. a simple assembly guide) on that pack shape, to prove the instruction model is actually generic, not recipe-shaped (the original Phase 3 task 27, now evidence-based).
34. Build In-App Domain Switcher UI - Let a user pick which builder (recipe, the new second domain, etc.) they're using.
35. Create Theme System - Allow easy visual customization, revisited once real usage and a second domain show whether it's actually wanted (the original Phase 3 task 26).
36. Continue Icon Library Expansion - Open-ended, ongoing growth of icon coverage beyond Phase 3's curated v1 list.
37. Add Vector PDF Export (Stretch) - Integrate jsPDF + svg2pdf.js, lazy-loaded, for true vector PDF output.
38. Add Basic Gamification (Optional) - Add progress and feedback mechanisms, only if it doesn't compete with the single-purpose goal.
39. Prepare Future Expansion - Maintain a flexible architecture.

---

# Known Risks & Mitigations

- **Safari IndexedDB limits in private browsing** — Safari private windows historically cap or block persistent IndexedDB storage. Feature-detect on startup and degrade to a session-only, non-persistent mode with a visible warning, rather than letting saves fail silently.
- **Print-to-PDF inconsistency across browsers** — `window.print()` output (margins, page breaks, headers/footers) varies by browser engine. Test the print stylesheet in Chrome, Firefox, and Safari specifically before relying on it as the MVP's only PDF path.
- **Canvas tainting on PNG export** — any externally-loaded image or font referenced by the SVG (even same-site but cross-origin-flagged) can taint the canvas and block `toBlob()`/`toDataURL()` in Safari with a `SecurityError`. Mitigated by bundling all icons and fonts locally (see task 7).
- **Accessible drag-and-drop** — pointer-based reordering alone will not satisfy the "Accessible" core principle. Mitigated by shipping a keyboard-operable alternative (task 22) rather than treating it as a stretch goal.

---

# Success Criteria

- A first-time user, with no tutorial, can create a 5-step instruction in under 3 minutes.
- Initial load is under 2 seconds on a mid-range mobile device on a 4G connection.
- The app works on the last two versions of Chrome, Firefox, Safari, and mobile Safari/Chrome Android.
- No backend is required for any core feature (build, save, export).
- Hosting cost remains €0/month.
- SVG exports open cleanly in a standard vector editor (e.g. Inkscape/Illustrator); PNG exports are sharp at 2x pixel density; PDF exports print without clipping.
- The instruction engine is proven generic by Phase 4: at least one non-recipe instruction set (e.g. an assembly guide) is built using the same core model, not a fork of it - deliberately sequenced after Phase 3 ships and tests the recipe domain first, so the proof is grounded in what real usage actually needed rather than a guess made before any domain was fully built out (reprioritized 2026-09-14 - see the note under Phase 3 above).
- The application remains focused on a single purpose — creating visual instructions — with no features added outside that scope (gamification and similar additions stay optional/deferred, per Phase 4).
