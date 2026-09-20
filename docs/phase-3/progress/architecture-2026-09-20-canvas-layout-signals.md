# The canvas layout moved onto computed signals

> 📌 **Doc status: CURRENT** — one file in the
> [Phase 3 Progress Log](./README.md).

**Date:** 2026-09-20
**Source:** [2026-09-20 architecture review](../audits/2026-09-20-architecture-review.html), candidate 4
**Scope:** [`src/state/canvas.ts`](../../../src/state/canvas.ts) (new),
[`src/state/canvas.test.ts`](../../../src/state/canvas.test.ts) (new),
[`src/app.tsx`](../../../src/app.tsx), [`src/main.tsx`](../../../src/main.tsx),
[`src/components/InstructionCanvas/InstructionCanvas.tsx`](../../../src/components/InstructionCanvas/InstructionCanvas.tsx),
[`src/lib/canvas-layout.ts`](../../../src/lib/canvas-layout.ts)

Design settled ahead of implementation in
[the candidate 4 handoff](../plans/2026-09-20-candidate-4-canvas-layout-handoff.md);
all eight decisions there were followed as written.

## What changed

`App` computed both `CanvasLayout`s in `useMemo`s and passed them down as
props, which made the layout reachable only by a component `App` renders.
They are now module-level computeds:

```ts
// src/state/canvas.ts
export const isDesktop = signal(true);
export function startViewportTracking(): void   // main.tsx owns calling this
const steps = computed(() => document.value.steps);            // private
export const liveLayout = computed(() => computeCanvasLayout(steps.value, isDesktop.value));
export const exportLayout = computed(() => computeCanvasLayout(steps.value, true));
```

| Was | Now |
| --- | --- |
| `useIsDesktop()` hook in `app.tsx` (13 lines, `useState` + `useEffect`) | `isDesktop` signal + `startViewportTracking()` in `state/canvas.ts` |
| `useMemo(() => computeCanvasLayout(steps, isDesktop), [steps, isDesktop])` | `liveLayout` computed |
| `useMemo(() => computeCanvasLayout(steps, true), [steps])` | `exportLayout` computed |
| `const steps = document.value.steps` in `App`'s body | gone — nothing in `App` reads the step list any more |

`App` now reads `liveLayout.value` / `exportLayout.value` at the three call
sites and passes the values on. `InstructionCanvas` keeps its plain
`layout: CanvasLayout` prop unchanged: a caller that wants to render a
layout this module didn't derive can still pass one, and the component goes
on working with values rather than taking a dependency on where they came
from.

## They do not live beside the document, and that is deliberate

The audit specified "two `computed()` values beside the document, exactly as
`selectedStep` and `selectedToken` already are" — that is, inside
`createDocumentSession()`. Declined. A viewport is a property of the browser
window, not of a document session; two sessions open at once would still
share one screen, so a per-session `isDesktop` would be a copy of a global
wearing a session's clothes.

`liveLayout`/`exportLayout` therefore read the default session's exported
`document` directly and have no `createCanvasLayouts(session)` factory. If
candidate 1 later needs one, that is when it gets built.

## The audit's headline win does not hold

The "After" diagram claims *"App no longer subscribes to the document at
all."* It is false, and was false before this change landed: the toolbar's
document-title input reads `document.value.meta.title`, and `document` is a
single signal holding the whole document, so Preact's per-signal
subscription re-renders `App` on every token keystroke regardless. Removing
the two `useMemo`s changes nothing there.

This is decidable by reading the code, not something a measurement was taken
for, and it is stated that way. Candidate 4's value is the leverage its own
deletion test already concedes — "it earns its place through what it
*enables*" — and that part landed intact: any module can now read the live
layout without holding a ref or a prop, which is what candidate 1 needs from
`TokenPicker`. The claim is struck through in the audit.

## A naive port would have made performance *worse*

Caught by probe before writing the module, and the most useful thing this
work turned up.

The old `useMemo`s declared `[steps]` — not `[document]`. `updateTitleCore`
rebuilds the document around the **same** `steps` array, so typing in the
title field never recomputed canvas geometry. A `computed()` reading
`document.value.steps` directly subscribes to the whole document signal and
would have recomputed *both* layouts on every keystroke in that field —
the exact cost the audit claimed the candidate would remove.

The private `steps` computed is what preserves the old semantics: it returns
the unchanged array, `@preact/signals` sees the value is identical and
doesn't bump its version, and both layouts stay on their cached values. The
probe that established this became the fourth test below, and removing the
computed fails it.

## Behaviour changes

**None.** This is pure restructuring, as expected:

- Every layout the three `InstructionCanvas` instances receive is computed
  from the same inputs by the same function as before.
- `handleExportPdf` keeps its `layout: CanvasLayout` parameter; the call
  site just became `exportLayout.value`.
- `isDesktop` now defaults to `true` at module load and is seeded from
  `matchMedia` by `startViewportTracking()`, which `main.tsx` calls
  **synchronously before `render()`** — ahead of the `initPersistence()`
  promise, not nested in it. The first paint therefore has the real
  breakpoint, exactly as `useIsDesktop`'s lazy `useState` initializer did.

## The node-environment contract

`vitest.config.ts` runs with `environment: "node"`. A module-level
`window.matchMedia(...)` in `state/canvas.ts` would throw at import and take
down every test file that transitively imports it — which is the entire
reason `startViewportTracking()` is a separate exported call rather than
module-scope init. `initPersistence()` in `state/persistence.ts` is the
precedent and the shape was copied from it.

`canvas.test.ts` importing the module at all is the proof the contract
holds. Mutation M3 below is that proof under test.

## Verification

- `npx tsc -b`, `npx eslint .`, `npm run build` — all clean.
- `npx vitest run` — **199 passing / 14 files** (was 194 / 13; 5 added).
- The five tests: `exportLayout` pinned to desktop across an `isDesktop`
  flip while `liveLayout` follows it; mobile collapsing every step to a
  single chip row; `liveLayout` tracking document edits; both layouts
  staying cached across a title-only edit; and the module importing under
  node with `isDesktop` defaulting to `true`.
- Mutation-checked, three mutations:

  | Mutation | Result |
  | --- | --- |
  | `exportLayout` reads `isDesktop.value` instead of `true` | 2 tests failed |
  | private `steps` computed replaced by a direct `document.value.steps` read | 1 test failed |
  | `matchMedia` call hoisted to module scope | whole file failed to load — `ReferenceError: window is not defined`, 5 tests lost |

The first mutation is the load-bearing one. The 2026-09-17
export-viewport-independence invariant — a shared or printed document must
not render structurally differently depending on the exporting device —
existed until now only as a comment in `App`'s body, held by nothing. It is
now held by a test.

## Test isolation differs from `document.test.ts`, on purpose

`document.test.ts` builds isolated sessions through `createDocumentSession()`.
`canvas.test.ts` cannot: the layouts are derived from the default session's
module-level `document` signal and have no factory (see above). It drives
that global instead and resets both it and `isDesktop` in a `beforeEach`.
Safe, because Vitest isolates per file — but the asymmetry is real and worth
knowing before adding a sixth test here.

## Doc comments corrected

Three sentences this change made false, fixed in place rather than left to
read as oversights:

- **`InstructionCanvas.tsx`'s `layout` prop comment** said `App` "owns
  calling `computeCanvasLayout`" and "decides what `isDesktop` value feeds
  it." Neither is true now. Because keeping the prop was a deliberate
  decision, a stale comment there would have read as something forgotten;
  the rewrite says why the prop is still a value.
- **`canvas-layout.ts:371`** pointed at `useIsDesktop` "in
  InstructionCanvas.tsx" — already stale before this work (the hook moved to
  `app.tsx` in the 2026-09-17 remediation and the pointer was never
  updated). It now points at `state/canvas.ts`.
- **`useIsDesktop`'s own doc comment** carried the 2026-09-17 rationale for
  `App` owning the viewport. That rationale is reversed by this change, so
  it moved onto `isDesktop` rewritten, rather than being deleted — the
  export-viewport-independence half of it is still live and now sits on
  `exportLayout`.

## Not touched

- **`computeCanvasLayout` itself** — unchanged. This work moved *who calls
  it*, not what it does.
- **`InstructionCanvas`'s own `document.value.steps` read** — the component
  already subscribes to the document independently of its `layout` prop, so
  it re-renders on any document change either way. Untouched, and the reason
  the finding above is a cost question rather than a correctness one.
- **Candidate 1** — the drop-resolution seam this unblocks was still open
  when this was written. It landed later the same day; see
  [the write-up](./architecture-2026-09-20-layout-hit-testing.md). It needed
  one thing this change did not provide: the live canvas's `<svg>`
  *element*, not just its layout, which `state/canvas.ts` gained a second
  signal for.
