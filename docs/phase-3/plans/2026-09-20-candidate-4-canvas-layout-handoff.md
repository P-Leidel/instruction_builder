# Handoff — Candidate 4: move the canvas layout onto computed signals

> 🗄️ **Doc status: HISTORICAL — superseded (2026-09-20).** The work this
> handoff scoped shipped the same day the handoff was written, with all
> eight settled decisions implemented as recorded below, so it is frozen
> here as the plan of record rather than maintained. See
> [../progress/architecture-2026-09-20-canvas-layout-signals.md](../progress/architecture-2026-09-20-canvas-layout-signals.md)
> for what actually shipped. See
> [../../milestones.md](../../milestones.md#documentation-status-conventions)
> for what CURRENT/HISTORICAL mean project-wide.

**Repo:** `D:\websites\instruction_builder` (branch `main`, HEAD `c68c80d`)
**Date:** 2026-09-20
**Status:** design fully settled by a grilling session; **no code written yet**

---

## What this is

Candidate 4 of the 2026-09-20 architecture review. Read the candidate in place — do not re-derive it from this doc:

- Audit: `docs/phase-3/audits/2026-09-20-architecture-review.html`, `<article id="c4">` (and `id="c1"`, whose "Honest cost" paragraph is why candidate 4 is sequenced first)
- Sibling work already landed at the same funnel, for tone and conventions:
  - `docs/phase-3/progress/architecture-2026-09-20-selection-repair-funnel.md` (candidate 2)
  - `docs/phase-3/progress/architecture-2026-09-20-token-write-seam.md` (candidate 3)
- Relevant ADR: `docs/adr/0003` (no component test environment — logic moves to testable modules). `docs/adr/0002` is **not** implicated by this candidate.

The work: `App` computes two `CanvasLayout`s in `useMemo`s and passes them down as props. Move them to `computed()` signals so any module can read the layout — candidate 1 needs `TokenPicker` to resolve drops against the live layout, and `TokenPicker` holds no canvas ref and no layout prop.

---

## Settled decisions

All eight were put to the user and chosen explicitly. Do not revisit without asking.

| # | Decision | Answer |
|---|---|---|
| Q1 | Where the computeds live | **New `src/state/canvas.ts`** — module-level signals reading the exported `document`. *Not* inside `createDocumentSession()`, despite the audit saying "beside the document, exactly as `selectedStep`/`selectedToken`". A viewport is not a property of a document session. Note the deviation from the audit explicitly in the write-up. |
| Q2 | How `isDesktop` becomes a signal | `export const isDesktop = signal(true)` plus `export function startViewportTracking()` that reads `matchMedia` **synchronously** and installs the `change` listener. `main.tsx` calls it **before** `render()`, so there is no wrong first paint. Module import must touch no DOM. |
| Q3 | The audit's "root stops re-rendering per keystroke" win | **Out of scope, and false as written** — see Findings below. Correct the audit in place. |
| Q4 | `InstructionCanvas`'s `layout` prop | **Keep `layout: CanvasLayout` as-is.** App reads `liveLayout.value` / `exportLayout.value` and passes the value. Do not drop the prop, do not change it to a `ReadonlySignal`. |
| Q5 | Tests, and session symmetry | New `src/state/canvas.test.ts`. **No** `createCanvasLayouts(session)` factory — YAGNI, add it when candidate 1 shows a need. |
| Q6 | `isDesktop`'s home + teardown | Both `isDesktop` and `startViewportTracking()` live in `state/canvas.ts`, **not** `state/ui.ts`. `startViewportTracking()` returns **nothing** — no teardown. |
| Q7 | `handleExportPdf`'s `layout` param | **Keep it.** Call site becomes `handleExportPdf(getExportSvgElement(), exportLayout.value)`. |
| Q8 | Doc-comment migration | Move the two comments, **and** fix every sentence this change makes false — including `InstructionCanvas.tsx`'s prop comment and the stale pointer in `canvas-layout.ts`. Scope tightly to false sentences; not a general rewrite. |

---

## Findings from the grilling that must survive into the write-up

These are corrections to the audit, established by reading the code. The project has precedent for correcting an audit in place rather than silently dropping a wrong claim (commit `aa91a1d`, and candidates 2 and 3 both did it).

1. **The audit's headline win does not hold.** Its "After" diagram claims *"App no longer subscribes to the document at all."* False: the toolbar's document-title input reads `document.value.meta.title`, and `document` is a single signal holding the whole document, so Preact's per-signal subscription re-renders `App` on every token keystroke regardless. Removing the two `useMemo`s changes nothing here. Candidate 4's real value is leverage — which the audit's own deletion-test grading already concedes ("weaker than candidates 1, 2 and 3… it earns its place through what it enables"). This is statically decidable from the code; state it that way rather than claiming a measurement that was not taken.

2. **`InstructionCanvas.tsx:24-33` becomes false in both halves.** It states `App` "owns calling `computeCanvasLayout`" and "decides what `isDesktop` value feeds it." After this change neither is true. Because Q4 *keeps* the prop, leaving this comment stale would make a deliberate decision read as an oversight.

3. **`src/lib/canvas-layout.ts:371` is already stale** — it points at `useIsDesktop` "in InstructionCanvas.tsx", which moved to `app.tsx` during the 2026-09-17 remediation and was never updated. It is about to move again.

---

## The trap

`vitest.config.ts:9-11` sets `environment: "node"` with `include: ["src/**/*.test.ts"]`. `.tsx` files are never tested, but a `.ts` state module's **import-time side effects do run** in the suite. A module-level `window.matchMedia(...)` in `state/canvas.ts` would crash every test file that transitively imports it.

This is the entire reason `startViewportTracking()` exists as a separate exported call rather than module-level init. **`initPersistence()` in `src/state/persistence.ts` is the precedent** — same file family, same contract (`main.tsx` owns calling it), same reason. Follow its shape.

Corollary worth stating in the write-up: `canvas.test.ts` importing `state/canvas.ts` under node **is** the proof that the no-DOM-at-import contract holds. If it regresses, the whole file fails to load.

---

## Line anchors

Current state at `c68c80d`. Verify before editing — the working tree has uncommitted changes to `src/state/` from candidates 2 and 3.

**`src/app.tsx`** (504 lines)

- `:1-2` — `useMemo`/`useState`/`useEffect` imports; prune whatever goes unused
- `:6` — `import { DESKTOP_QUERY, computeCanvasLayout, type CanvasLayout }`
- `:36-46` — `useIsDesktop`'s doc comment (carries the 2026-09-17 rationale this change reverses)
- `:48-60` — `useIsDesktop` itself; deleted by this work
- `:108-114` — `handleExportPdf`; signature unchanged per Q7
- `:339-340` — `const isDesktop = useIsDesktop()`, `const steps = document.value.steps`
- `:341-348` — the comment explaining why both read-only instances share a fixed-desktop layout
- `:349-350` — the two `useMemo`s
- `:421` — `handleExportPdf(getExportSvgElement(), exportLayout)` (PDF button)
- `:470` — Preview canvas, `readOnly layout={exportLayout}`
- `:477` — live canvas, `layout={liveLayout}`
- `:500` — hidden export canvas, `readOnly layout={exportLayout} svgRef={exportSvgRef}`

**`src/components/InstructionCanvas/InstructionCanvas.tsx`** (449 lines)

- `:24-34` — `readOnly` and `layout` prop comments; `:26-33` is finding 2 above
- `:114-115` — component signature; already reads `document.value.steps` itself, so it re-renders on any document change independently of the layout prop

**`src/lib/canvas-layout.ts`**

- `:44` — `export const DESKTOP_QUERY = "(min-width: 800px)"`
- `:364-380` — `computeCanvasLayout`'s doc comment; `:371` is finding 3 above

**`src/main.tsx`** — add the `startViewportTracking()` call before `render()`. Note `render()` currently sits inside `initPersistence().finally(...)`; the viewport call should be synchronous and ahead of that, not nested in the promise.

---

## Tests to write (`src/state/canvas.test.ts`)

Three assertions, in priority order:

1. **`exportLayout` is identity-stable (`toBe`) across an `isDesktop` flip, while `liveLayout` is not.** This is the load-bearing one. It encodes the 2026-09-17 export-viewport-independence invariant, which today exists only as a comment in `App`'s body and is held by nothing. A shared or printed document must not render structurally differently depending on the exporting device.
2. `liveLayout` tracks document edits.
3. `liveLayout` tracks `isDesktop` (mobile collapses to one row per step).

These mutate the **default session's** global `document` signal, unlike `document.test.ts` which builds isolated sessions via `createDocumentSession()`. That is safe — Vitest isolates per file — but name the asymmetry in the write-up.

**Mutation-check the tests before claiming they hold.** This project's last two candidates each proved their tests load-bearing by removing the guard and counting failures; both write-ups contain the resulting table. Match that.

---

## Definition of done

- `npx tsc -b`, `npx eslint .`, `npm run build` — all clean
- `npx vitest run` — currently **194 passing / 13 files**; report the new number
- Progress doc at `docs/phase-3/progress/architecture-2026-09-20-<topic>.md`, following the two sibling docs' structure (What changed / findings / Behaviour changes / Verification / Not touched)
- Audit HTML annotated at `<article id="c4">` — badge row plus an inset box, matching how `id="c2"` and `id="c3"` were annotated. The "root stops re-rendering" claim must be corrected there, not just in the progress doc.
- If behaviour changes anywhere, say so plainly. Candidate 4 is expected to be a pure restructuring — if that turns out false, that is a finding, not a footnote.

---

## Standing constraints

- **Never add a `Co-Authored-By: Claude` line (or any Claude attribution) to a commit message or PR description in this project.** Standing user preference. If an existing commit or PR already carries one, remove it.
- Commit only when the user asks. **Candidates 2 and 3 are currently uncommitted in the working tree** (`src/state/document.ts`, `src/state/document.test.ts`, `docs/adr/0002-*.md`, plus three untracked docs) — do not sweep them into a candidate-4 commit.
- The app's target audience is European; defaults and formats follow European conventions.
- Verify an audit's claimed symptom with a throwaway probe before implementing. Candidate 2's claimed symptom did not reproduce; candidate 3's did, and was wider than stated. Candidate 4's stated perf win is already known to be wrong (finding 1) — do not repeat the claim.

---

## Suggested skills

Call the Skill tool for these:

- **`mattpocock-skills:implement`** — primary. The design is settled; this is execution.
- **`mattpocock-skills:codebase-design`** — the deep-module / funnel-point / deletion-test vocabulary the audit and all three progress docs are written in. Read it before writing the write-up so the language matches.
- **`mattpocock-skills:tdd`** — optional, if you prefer to drive the three assertions above before the implementation.

Do **not** call `grill-me` / `grilling` again — the frontier is empty and every branch was visited. Re-opening a settled decision needs the user, not another grilling pass.
