# Phase 1 Project Foundation — File Guide

> 🗄️ **Doc status: HISTORICAL — superseded.** Frozen 2026-09-13 when Phase 1
> closed out. Not edited further. For current status, see
> [milestones.md](../milestones.md); see its "Documentation status
> conventions" section for what CURRENT/HISTORICAL mean.

This document explains every file generated for Phase 1 (task 4, "Build Project Foundation") and why it exists, following the architecture approved in [architecture.md](./architecture.md). Planning and architecture documents live in this `docs/` folder (organized into per-phase subfolders), kept separate from the buildable project at the repo root so the root stays a clean, standard Vite/Preact project.

The project uses Node.js 20+ and is intended to deploy as a static Vite build on Vercel.

---

## Vite configuration

**[`vite.config.ts`](../../vite.config.ts)**
Wires up the `@preact/preset-vite` plugin (JSX → Preact, fast refresh) and sets Vite's `base: "/"` for the Vercel domain root.

## TypeScript configuration

**[`tsconfig.json`](../../tsconfig.json)**
The application config, applied to everything in `src/`. Key choices:
- `strict: true` plus `noUnusedLocals`/`noUnusedParameters` — catches model/state bugs early, which matters more here than in most apps because the instruction model (task 1) is the thing every later phase's export/import correctness depends on.
- `jsx: "react-jsx"` with `jsxImportSource: "preact"` — Preact's modern JSX runtime, no `import { h }` boilerplate needed in every component.
- `moduleResolution: "bundler"` and `noEmit: true` — Vite does the actual transpiling/bundling; `tsc` here only type-checks.
- `references` to `tsconfig.node.json` — see below.

**[`tsconfig.node.json`](../../tsconfig.node.json)**
A second, separate config scoped to `vite.config.ts` only. Vite's config file runs under Node, not the browser, so it needs different module/lib assumptions than `src/`; splitting it out is the standard Vite pattern and avoids polluting the app config with Node types. `composite: true` lets `tsc -b` (used in `npm run build` and `npm run typecheck`) build both configs together in the correct order.

## Preact setup

**[`package.json`](../../package.json)**
Declares `preact` and `@preact/signals` as runtime dependencies (no React, no separate state-management library — matching the plan's "lighter stack" decision), and `@preact/preset-vite` as the only Preact-specific dev dependency. Scripts:
- `dev` — Vite dev server.
- `build` — `tsc -b && vite build`, so a broken type ever blocks a broken production bundle from being produced.
- `typecheck` / `lint` — the same commands CI runs, so "passing" means one thing locally and in CI.

**[`src/main.tsx`](../../src/main.tsx)**
The entry point: mounts `<App />` into `#app` (declared in `index.html`) via Preact's `render`. Throws immediately if `#app` is missing rather than failing silently, since a missing mount point is a build/HTML bug, not a runtime state to recover from.

**[`index.html`](../../index.html)**
The single HTML page (this is a single-page app). Loads `src/main.tsx` as a module script and links the PWA manifest (see below).

## ESLint configuration

**[`eslint.config.js`](../../eslint.config.js)**
Flat config (ESLint 9) combining `@eslint/js` recommended rules with `typescript-eslint`'s recommended rules, scoped to browser globals. No React/Preact-specific lint plugin is included because Preact's function components don't need hooks-rules-of-hooks style enforcement beyond what TypeScript already catches; keeping the dependency list short matches the plan's bundle/dependency-minimization principle (this only affects dev tooling, not the shipped bundle, but the same "don't add what isn't earning its place" logic applies).

## Project folder structure

```
instruction-builder/
├── docs/                        # planning + architecture, not part of the built app
├── .github/workflows/ci.yml
├── public/
│   ├── manifest.webmanifest
│   └── icons/                   # empty in Phase 1 — see PWA groundwork below
├── src/
│   ├── main.tsx
│   ├── app.tsx
│   ├── model/                   # instruction.ts, migrate.ts, validate.ts
│   ├── state/                   # document.ts (signals)
│   ├── components/              # StepBuilder/, TokenPicker/, StepList/
│   ├── data/                    # sample-tokens.ts (Phase 1 placeholder vocabulary)
│   └── styles/                  # global.css
├── tests/                       # empty — Vitest specs start Phase 2 task 20
├── index.html, vite.config.ts, tsconfig*.json, package.json, eslint.config.js
```

This is exactly the structure proposed in [architecture.md § 4](./architecture.md#4-folder-structure), so no reshuffling is needed when Phase 2 tasks (icon library, testing, canvas) start filling in the currently-empty `public/icons/` and `tests/` folders.

### `src/model/`
- **`instruction.ts`** — the `InstructionDocument`/`InstructionStep`/`InstructionToken` interfaces and `CURRENT_SCHEMA_VERSION`, exactly as specified in the architecture doc §2.2, plus small factory helpers (`createEmptyDocument`, `createEmptyStep`, `createToken`) used by `state/document.ts` and the components.
- **`migrate.ts`** — a stub `migrate()` that only accepts documents already at `CURRENT_SCHEMA_VERSION` and throws otherwise. There is only one schema version so far, so there is nothing to migrate; the real migration chain is Phase 2 task 19.
- **`validate.ts`** — implements only the single domain-agnostic rule from the architecture doc §2.4 (a step needs at least one action token), enough for `StepList` to flag incomplete steps in the prototype. The full rule set is Phase 2 task 14.

### `src/state/`
- **`document.ts`** — the `@preact/signals` state described in the architecture doc §3.2: a `document` signal holding the current `InstructionDocument`, a `selectedStepId` signal, a `selectedStep` computed value, and mutator functions (`addStep`, `removeStep`, `addTokenToSelectedStep`, `removeTokenFromStep`). In-memory only — no `idb-keyval` yet, since persistence is Phase 2 task 12.

### `src/data/`
- **`sample-tokens.ts`** — a placeholder token vocabulary (actions, objects, tools, quantities, warnings) using plain unicode glyphs instead of real icon assets, since the bundled icon library (Phase 2 task 7) doesn't exist yet. Each entry still carries a stable `iconId` string so this file can be deleted in favor of real icon data later without changing any component's props or the model itself.

### `src/components/`
Only the three components needed to validate the interaction model are built in Phase 1, matching the architecture doc §5:
- **`StepList/StepList.tsx`** — lists steps, lets the user select one, add a new one, or remove one, and flags incomplete steps via `validateStep`.
- **`StepBuilder/StepBuilder.tsx`** — renders the selected step's tokens as removable chips. Deliberately plain HTML/CSS, not SVG — the real `InstructionCanvas` (Phase 2 task 6) replaces this once the interaction is proven, so this component is intentionally cheap to throw away.
- **`TokenPicker/TokenPicker.tsx`** — a tap-to-insert grid of the sample vocabulary, grouped by category, appending to the currently selected step. This is the "pick action → pick object → pick quantity" flow from task 2 (Design UX), built as the simplest possible version: a straight tap, no drag yet (Phase 2 tasks 9–11).

### `src/styles/global.css`
A minimal reset plus enough layout/chip styling to make the three Phase 1 components usable and testable on both desktop and mobile widths (44px minimum touch targets, a single-column layout under 800px). This is not the responsive design pass (Phase 2 task 21) — it exists only so the prototype can be evaluated on a phone, since mobile-first is a stated core principle.

## GitHub Actions CI workflow

**[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)**
Runs on every push and pull request: `npm ci`, then `lint`, `typecheck`, `build`, in that order (cheapest/fastest check first). This is free (GitHub Actions' public-repo free tier) and validates the same static build that Vercel deploys.

## PWA groundwork

Per the project plan, full PWA conversion (installability, offline service worker, app icons) is Phase 2 task 23 — building it now would be scope creep into Phase 2. Vercel serves the eventual PWA assets from the domain root. What's laid here is only the groundwork so that task doesn't require restructuring anything:
- **`public/manifest.webmanifest`** — a valid but minimal web app manifest (name, colors, `display: "standalone"`) with an empty `icons` array, linked from `index.html` via `<link rel="manifest">`. It has no effect without icons and a service worker, but its presence and shape are already correct for Phase 2 to fill in.
- **`public/icons/`** — the empty destination for both the Phase 2 task 7 icon library and the PWA app icons; kept as one folder since both are "bundled local image assets" for the same reasons (offline support, avoiding canvas-tainting on export).
- No service worker file and no `vite-plugin-pwa` dependency are added yet — registering a service worker before there's anything meaningful to cache/serve offline would be dead code, and adding the plugin dependency early would violate the plan's minimal-dependency principle for no present benefit.

## Initial application shell

**[`src/app.tsx`](../../src/app.tsx)**
Renders `StepList`, `StepBuilder`, and `TokenPicker` in one static layout (a header plus a responsive grid). This is not the final "toolbar / canvas / side panel" shell from the architecture doc §5 — that's Phase 2 task 5 (Create UI Layout). Phase 1's shell exists only to host the three prototype components so the interaction model (task 2/3) can actually be clicked through and validated, per the Phase 1 exit criterion in [architecture.md § 6](./architecture.md#6-phased-implementation-roadmap).

---

## What's intentionally not here

Consistent with Phase 1's scope in the approved architecture: no `idb-keyval`/persistence, no SVG canvas, no drag-and-drop, no export pipeline, no automated tests, no real icon assets, no service worker. Each has a named task and phase in the roadmap where it's introduced — building any of them now would be scope creep ahead of the UX/wireframe validation this phase exists to do.

## Next step to run this locally

```bash
npm install
npm run dev
```

Then open the printed local URL and confirm: selecting a step, tapping tokens to add them, adding/removing steps, and seeing the "!" flag on an empty or action-less step all work as expected.
