# Visual Instruction Builder — Phase 1 Architecture Blueprint

> 🗄️ **Doc status: HISTORICAL — superseded.** Frozen 2026-09-13 when Phase 1
> closed out. Not edited further; several decisions below (e.g. the SVG
> canvas being deferred, the component list in section 5) have since been
> superseded by the actual Phase 2 implementation — check
> [phase-2/progress/README.md](../phase-2/progress/README.md) for what's actually
> built, and [milestones.md](../milestones.md) for current status. See
> "Documentation status conventions" there for what CURRENT/HISTORICAL mean.

Source: [`../project-plan.md`](../project-plan.md)

---

## 1. Requirements, Constraints, and Architectural Decisions

### 1.1 Requirements extracted from the plan

- Build step-by-step visual instructions by arranging icons (actions, objects, tools, quantities, warnings) on a structured canvas.
- Domain-agnostic core: recipes first, but the data model must not be recipe-shaped.
- Export targets (deferred to Phase 2+): SVG, PNG, PDF/print, JSON.
- €0 budget: no paid services, no backend, Vercel static hosting only.
- Offline-first: build, save, export without a network connection.
- Fast: instant startup, smooth interactions, mobile-first.
- Accessible: icon+text, keyboard navigation, high contrast, touch support.
- Single purpose: nothing added beyond building visual instructions.

### 1.2 Constraints this phase must respect

- No backend, no paid APIs, no telemetry service — everything runs client-side.
- No feature work belongs to Phase 1 beyond: data model, UX workflows, wireframes, and a running project skeleton. No persistence, no export, no drag-and-drop polish yet.
- Every dependency added must be justified against the "minimize bundle size and dependency count" principle already set in the plan (Preact, signals, idb-keyval, native SVG — no React, no Zustand, no Dexie, no canvas library).

### 1.3 Key architectural decisions (and why)

| Decision | Rationale |
|---|---|
| Preact + TypeScript + Vite | Matches the plan's stack; smallest viable runtime, fastest cold start, no build config overhead. |
| `@preact/signals` for state | Fine-grained reactivity avoids re-rendering the whole canvas on every small edit (important once the canvas holds many SVG nodes in Phase 2). No separate store/reducer layer needed. |
| Instruction model as plain, serializable TypeScript data (no classes) | The model must round-trip through `JSON.stringify`/`parse` cleanly for the Phase 2 export/import tasks (18, 19) — classes with methods or non-plain fields would complicate that. |
| Schema version field from day one | Task 1 explicitly calls this out. Without it, any later change to the model shape breaks previously-saved/exported JSON with no way to detect or migrate it. |
| Icons referenced by stable string ID, not inlined SVG, in the model | Keeps saved/exported JSON small and lets the icon library (task 7) be swapped or extended later (and later, content packs in Phase 3) without touching existing instruction data. |
| No canvas rendering yet in Phase 1 | Phase 1's job is to validate the interaction model on paper/wireframes and in a throwaway prototype, not to build the real SVG canvas (that's task 6, Phase 2). Building it now risks locking in a design before the UX pass (task 2/3) happens. |
| idb-keyval deferred to Phase 2 | Task 12 is explicitly Phase 2. Phase 1 has no persistence — state lives in memory only, matching "no persistence" scope. |
| GitHub Actions CI from day one (build + typecheck) | Task 4 calls for this explicitly so regressions are caught before any feature work lands, and it's free. |

---

## 2. Instruction Data Model

The model is designed now (Phase 1, task 1) but must already anticipate Phase 2 export/import and Phase 3 content packs, per the plan's "future compatibility" requirement.

### 2.1 Design principles

1. **Plain data, no behavior.** Every type here is JSON-serializable as-is.
2. **Versioned from the root.** The root document carries `schemaVersion`; nothing else needs its own version.
3. **Icons and domain vocabulary are references, not embedded content.** A step doesn't own icon SVG markup — it owns an icon ID that resolves against an icon library (bundled locally per task 7). This is what makes Phase 3's content-pack/template system possible without a data migration.
4. **Everything a user can place on the canvas is a "token".** Actions, objects, tools, quantities, and warnings are all the same shape (an icon + optional label + optional metadata) so the canvas, validation, and export code don't need a special case per category. Category is just a field, not a different type.

### 2.2 TypeScript interfaces

```ts
// src/model/instruction.ts

/** Bumped whenever a breaking change is made to any type in this file. */
export const CURRENT_SCHEMA_VERSION = 1;

export type TokenCategory =
  | "action"
  | "object"
  | "tool"
  | "quantity"
  | "warning"
  | "note";

/** A single placed icon+label unit — the atomic building block of a step. */
export interface InstructionToken {
  /** Stable unique id within the document (e.g. nanoid). */
  id: string;
  category: TokenCategory;
  /** References an icon in the icon library by id — never inlined SVG. */
  iconId: string;
  /** Optional human-readable text shown alongside/under the icon. */
  label?: string;
  /** Free-form, category-specific data (e.g. { amount: 2, unit: "cups" } for a quantity token). Kept generic so content packs can extend it without changing this interface. */
  metadata?: Record<string, string | number | boolean>;
}

/** One step in the instruction sequence. */
export interface InstructionStep {
  id: string;
  /** 1-based order is derived from array position; this id is for stable references (undo/redo, drag reorder), not ordering. */
  tokens: InstructionToken[];
  /** Optional free text shown in "detailed instructions with text" export mode. */
  description?: string;
  /** True when Phase 2 validation (task 14) finds this step incomplete. Computed, not authored — see 2.4. */
}

/** Top-level metadata about the instruction set, independent of domain. */
export interface InstructionMeta {
  title: string;
  /** e.g. "recipe", "assembly", "safety" — free string in Phase 1/2; becomes a content-pack id in Phase 3. */
  domain: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

/** The root document — this is exactly what gets saved (task 12) and exported/imported as JSON (tasks 18, 19). */
export interface InstructionDocument {
  schemaVersion: number;
  meta: InstructionMeta;
  steps: InstructionStep[];
}
```

### 2.3 Schema versioning strategy

- `schemaVersion` lives once, at the document root — not per-step or per-token — since a document is always read/written as a whole.
- On import (task 19), a single `migrate(doc: unknown): InstructionDocument` function inspects `schemaVersion` and applies a chain of small migration functions (`migrateV1toV2`, etc.) until the document matches `CURRENT_SCHEMA_VERSION`. Each migration is a pure function `(doc: DocV_n) => DocV_n+1`.
- Migrations are additive-first: prefer adding optional fields over renaming/removing, so most version bumps need no migration function at all (an old document is already valid at the new version once defaults are filled in).
- Documents newer than `CURRENT_SCHEMA_VERSION` (opened in an older build) are rejected with a clear error rather than silently mis-read — this only matters once export/import ships in Phase 2, but the check costs nothing to design in now.
- No versioning is needed below the document level (steps/tokens aren't versioned independently) — this keeps the model simple, matching the "avoid speculative complexity" principle.

### 2.4 Validation rules

Validation (task 14, Phase 2) is a pure function over the model, not state stored on it — this avoids the model lying about a state that hasn't been recomputed:

```ts
export interface StepValidationResult {
  stepId: string;
  isComplete: boolean;
  issues: string[]; // e.g. "Missing an action token", "Missing a quantity for this ingredient"
}

export function validateStep(step: InstructionStep): StepValidationResult;
export function validateDocument(doc: InstructionDocument): StepValidationResult[];
```

Baseline rules for Phase 1/2 (domain-agnostic, so they hold for recipes and the Phase 3 assembly-guide validation case alike):
- A step must contain at least one `action` token.
- A `quantity` token's `metadata` should include a numeric amount when present (warn, don't block).
- Empty steps (no tokens) are always incomplete.

Domain-specific rules (e.g. "a recipe step needs an object") are intentionally left out of this core function and deferred to the Phase 3 content-pack system, so the core engine stays generic per the plan's explicit success criterion.

### 2.5 Export/import requirements this model satisfies

- **JSON export/import (tasks 18, 19):** `JSON.stringify(document)` / `JSON.parse` + `migrate()` — no transformation needed since the model is already plain data.
- **SVG/PNG/print export (tasks 15–17):** these don't serialize the model directly; they serialize the rendered SVG DOM. The model's job is only to be the source of truth the canvas renders from — token → icon lookup → SVG node.
- **Future content packs (Phase 3, task 25):** a content pack supplies its own set of valid `TokenCategory`/icon-id vocabulary and domain-specific validation rules; it does not need a new document shape, because `domain` and `metadata` already give it room without touching `InstructionDocument`.

---

## 3. Application Architecture

### 3.1 Stack usage

| Layer | Choice | Responsibility |
|---|---|---|
| Language | TypeScript (strict mode) | Type safety across the model, UI, and export code. |
| UI framework | Preact + `htm`-free JSX (via Vite's `@preact/preset-vite`) | Component rendering. |
| Build tool | Vite | Dev server, bundling, TS transpilation. |
| State | `@preact/signals` | All mutable app state (current document, selection, undo stack later) lives in signals, not component state, so canvas and side panels stay in sync without prop-drilling. |
| Persistence | `idb-keyval` (Phase 2+) | Not wired up in Phase 1; the storage module is written against an interface so it can be added without touching callers. |
| Canvas | Native SVG DOM (Phase 2+) | Not built in Phase 1; Phase 1 validates the interaction model with plain HTML/CSS mockups of the workflow instead. |

### 3.2 State architecture (signals)

Phase 1 only needs enough state to drive the prototype's interaction model — no persistence, no undo:

```ts
// src/state/document.ts
import { signal, computed } from "@preact/signals";
import type { InstructionDocument } from "../model/instruction";

export const document = signal<InstructionDocument>(createEmptyDocument());
export const selectedStepId = signal<string | null>(null);

export const selectedStep = computed(() =>
  document.value.steps.find(s => s.id === selectedStepId.value) ?? null
);
```

Later phases add to this file (undo stack, persistence sync) rather than replacing it — signals compose, so this is additive.

### 3.3 Rendering strategy

Phase 1 deliberately renders the prototype step-builder with plain DOM/CSS (flexbox chips for tokens), not SVG. The real SVG canvas is Phase 2 (task 6). This lets Phase 1 focus purely on validating "pick action → pick object → pick quantity" as an interaction, without spending time on SVG layout code that might be thrown away once the UX pass (task 2/3) is done.

---

## 4. Folder Structure

```
instruction-builder/
├── .github/
│   └── workflows/
│       └── ci.yml              # build + typecheck on every push (task 4)
├── public/
│   └── icons/                  # bundled icon SVGs (populated in task 7; empty/placeholder in Phase 1)
├── src/
│   ├── main.tsx                # Preact entry point
│   ├── app.tsx                 # App shell / routing between prototype screens
│   ├── model/
│   │   ├── instruction.ts      # interfaces from section 2.2
│   │   ├── migrate.ts          # schema migration chain (stub in Phase 1)
│   │   └── validate.ts         # validation rules (stub in Phase 1, real in Phase 2)
│   ├── state/
│   │   └── document.ts         # signals from section 3.2
│   ├── components/
│   │   ├── StepBuilder/        # Phase 1 prototype: assemble one step from tokens
│   │   ├── TokenPicker/        # pick an icon+category to add as a token
│   │   └── StepList/           # list/reorder steps (basic, no drag yet)
│   ├── data/
│   │   └── sample-tokens.ts    # placeholder token/icon vocabulary for prototype use
│   └── styles/
│       └── global.css
├── tests/                      # Vitest specs (Phase 2, task 20); folder present, empty in Phase 1
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
├── .eslintrc.cjs               # or eslint.config.js (flat config)
└── Visual-Instruction-Builder-Project-Plan.md
```

Notes:
- `public/icons/` and `tests/` are created empty/placeholder in Phase 1 so the structure doesn't need to be reshuffled when Phase 2 tasks 7 and 20 start.
- No `services/`, `export/`, or `db/` folders yet — adding them before there's code to put in them would be speculative structure ahead of need.

---

## 5. Core Components (MVP scope, built incrementally)

| Component | Responsibility | Phase introduced |
|---|---|---|
| `App` | Top-level shell: layout regions (canvas, side panel, toolbar). | 1 (skeleton), 2 (real layout, task 5) |
| `StepBuilder` | Renders one step as an ordered row of tokens; lets the user pick action → object → quantity, etc. This is the component that validates the core interaction model in Phase 1. | 1 |
| `TokenPicker` | A categorized list/grid the user picks an icon+category from to append to the current step. | 1 |
| `StepList` | Shows all steps in the document, lets the user select/add/remove a step. | 1 (basic), 2 (reorder via task 9/22) |
| `InstructionCanvas` | Renders the full document as native SVG, replacing `StepBuilder`'s HTML prototype once the UX is validated. | 2 (task 6) |
| `IconLibraryProvider` | Resolves `iconId` → actual bundled SVG asset for both the picker and the canvas. | 2 (task 7) |
| `LivePreview` | Read-only rendered view of the current document, updated as it's edited. | 2 (task 8) |
| `DragLayer` | Pointer-Events-based drag-and-drop for placing/reordering tokens and steps. | 2 (task 9) |
| `PersistenceController` | Wraps `idb-keyval` get/set calls behind a small interface; also does the Safari-private-mode feature detection called out in the plan's risks section. | 2 (task 12) |
| `UndoRedoController` | Maintains a bounded history of document snapshots for undo/redo. | 2 (task 13) |
| `ExportPanel` | Triggers SVG/PNG/print/JSON export using the strategies in the plan (`XMLSerializer`, offscreen canvas, `window.print()`). | 2 (tasks 15–18) |
| `ImportDialog` | Reads a JSON file, runs it through `migrate()` and `validateDocument()`, and loads it into `document`. | 2 (task 19) |

Phase 1 only needs to build `App`, `StepBuilder`, `TokenPicker`, and `StepList` — everything else is listed here to show where today's model and folder-structure decisions plug in later, per the requirement to map every task to concrete milestones (section 6).

---

## 6. Phased Implementation Roadmap

### Phase 1: Concept Validation
| Task | Milestone |
|---|---|
| 1. Define Instruction Model | `src/model/instruction.ts` merged with interfaces from section 2.2, `CURRENT_SCHEMA_VERSION = 1`. |
| 2. Design UX | Documented click/tap flow for "assemble a step" (action → object → quantity → tool → warning), reviewed against `StepBuilder`'s planned props. |
| 3. Create Wireframes | Desktop + mobile layouts for the step-builder screen, covering the same flow as task 2. |
| 4. Build Project Foundation | Vite+Preact+TS scaffold committed; ESLint configured; `.github/workflows/ci.yml` runs `tsc --noEmit` + `vite build` on push/PR. |

**Exit criterion:** a clickable prototype (`StepBuilder` + `TokenPicker` + `StepList`, in-memory only) lets someone assemble a 5-step instruction using the sample token vocabulary, proving the interaction model before any canvas/export work begins.

### Phase 2: MVP
| Task | Milestone |
|---|---|
| 5. UI Layout | `App` shell with toolbar/canvas/panel regions. |
| 6. Instruction Canvas | `InstructionCanvas` renders `document` as SVG, replacing the Phase 1 HTML prototype. |
| 7. Icon Library | Tabler/Lucide subset vetted for license, bundled under `public/icons/`, wired through `IconLibraryProvider`. |
| 8. Live Preview | `LivePreview` reflects canvas state read-only. |
| 9. Drag-and-Drop | `DragLayer` using Pointer Events. |
| 10. Touch Support | Pointer Events path verified on touch devices (shared code with 9). |
| 11. Tap-to-Insert | Alternate to drag: tap a token, tap a target slot. |
| 12. Data Persistence | `PersistenceController` wraps `idb-keyval`; Safari private-mode fallback implemented per the plan's risk mitigation. |
| 13. Undo/Redo | `UndoRedoController` with bounded snapshot history. |
| 14. Visual Validation | `validate.ts` implemented for real; incomplete steps flagged in the canvas. |
| 15. SVG Export | `XMLSerializer` on the canvas DOM. |
| 16. PNG Export | Offscreen canvas + `toBlob()`, built on task 15. |
| 17. Print/PDF Export | `@media print` stylesheet + `window.print()`. |
| 18. JSON Export | `JSON.stringify(document)` download. |
| 19. Import System | `ImportDialog` running `migrate()` + `validateDocument()`. |
| 20. Automated Testing | Vitest specs for the model, undo/redo, and the SVG/PNG export pipeline, run in CI. |
| 21. Responsive Layouts | Breakpoints for the `App` shell and canvas. |
| 22. Accessibility | Keyboard alternative (move up/down buttons) to drag-and-drop; high-contrast pass. |
| 23. Convert to PWA | Manifest + service worker; `base` path set correctly for the chosen host. |
| 24. Optimize Performance | Profile canvas re-renders under signals; lazy-load anything non-critical. |

### Phase 3: Generic Instruction Framework
| Task | Milestone |
|---|---|
| 25. Content Pack System | Domain-specific vocabularies/validation rules loaded as data, not code changes, using the `domain`/`metadata` extension points already in the model. |
| 26. Theme System | CSS custom-property theme layer. |
| 27. Validate a Second Domain | A non-recipe (e.g. assembly guide) instruction set built with zero changes to `InstructionDocument`. |

### Phase 4: Polish
| Task | Milestone |
|---|---|
| 28. Vector PDF Export | jsPDF + svg2pdf.js, lazy-loaded only on export action. |
| 29. Gamification (optional) | Only if it doesn't dilute single-purpose focus — evaluate against success criteria before building. |
| 30. Test Real Users | Usability sessions against the 3-minute/5-step success criterion. |
| 31. Refine UX | Iterate based on task 30. |
| 32. Publish MVP | Deploy the static build to Vercel. |
| 33. Prepare Future Expansion | Architecture review against Phase 3 learnings. |

---

## 7. Technical Risks and Recommendations (Phase 1 lens)

In addition to the risks already documented in the plan (Safari IndexedDB, print/PDF inconsistency, canvas tainting, accessible drag-and-drop — all correctly deferred to Phase 2), Phase 1 carries its own risks:

- **Risk: the token model (section 2.2) turns out to be wrong once real wireframing happens.**
  Mitigation: keep `metadata` as a generic bag and `TokenCategory` as a plain string union rather than modeling per-category fields as separate interfaces now — cheap to adjust before any persisted data exists. Nothing is exported or saved in Phase 1, so the model can change freely without a migration.

- **Risk: building `StepBuilder` with real DOM/CSS now creates throwaway work once the SVG canvas (task 6) replaces it.**
  Mitigation: this is accepted deliberately — the plan calls for validating the interaction model before committing to canvas/export machinery (Phase 1 goal statement). Keep `StepBuilder` deliberately simple (flex row of chips) so the throwaway cost stays low; do not invest in animations, drag, or styling polish here.

- **Risk: scope creep from Phase 2 concerns bleeding into Phase 1 (e.g. starting the icon library or persistence early).**
  Mitigation: Phase 1's exit criterion (section 6) is explicit and small — an in-memory clickable prototype. Treat any temptation to add saving/export/real icons as a signal to stop and move to Phase 2 tasks properly, not fold them in early.

- **Risk: TypeScript/lint setup drifts from what CI enforces, causing "works on my machine" failures.**
  Mitigation: task 4's CI workflow should run the exact same `tsc --noEmit` and lint commands locally available via `npm run typecheck` / `npm run lint`, so there's one source of truth for what "passing" means.

---

## 8. Summary

Phase 1 delivers: a versioned, plain-data instruction model (section 2); documented UX flow and wireframes for assembling a step; and a Preact/Vite/TypeScript project skeleton with CI — all without building the canvas, persistence, or export systems that depend on it. Every decision above is scoped to stay inside the €0, offline-first, single-purpose constraints from the plan, and every later-phase component or folder named here exists only to show where Phase 1's model and structure plug in — none of it is built until its own phase/task arrives.
