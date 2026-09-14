# Phase 1 Status Report

> 🗄️ **Doc status: HISTORICAL — superseded.** Frozen 2026-09-13 when Phase 1
> closed out. Not edited further. For current status, see
> [milestones.md](../milestones.md); see its "Documentation status
> conventions" section for what CURRENT/HISTORICAL mean.

Date: 2026-09-12
Scope: full review of the project against [architecture.md](./architecture.md), prompted by an independent review's findings.

## Summary

The scaffold, model, state, and the three Phase 1 components (`StepList`, `StepBuilder`, `TokenPicker`) match the approved architecture. `npm install`, `npm run lint`, `npm run typecheck`, and `npm run build` all pass. The independent review surfaced five real issues; all five were confirmed against the actual files, and the four implementation-level ones have been fixed. The UX-flow document and desktop/mobile wireframes are now documented in [ux-and-wireframes.md](./ux-and-wireframes.md).

## Findings and resolution

| # | Severity | Finding | Status |
|---|---|---|---|
| 1 | Medium | No documented UX flow or desktop/mobile wireframes for the action → object → quantity → tool → warning sequence (architecture doc tasks 2–3). `TokenPicker` currently allows any category in any order. | **Fixed** — documented in [ux-and-wireframes.md](./ux-and-wireframes.md); flexible category order was deliberately retained. |
| 2 | Medium | `ci.yml` restricted `push`/`pull_request` triggers to `branches: [main]`, contradicting the plan's "CI on every push." | **Fixed** — branch filters removed; CI now runs on every push and every PR. |
| 3 | Low | `tsconfig.node.json` allowed emit, so `tsc -b` generated `vite.config.js`/`vite.config.d.ts` next to the hand-written `vite.config.ts`; `vite.config.js` wasn't gitignored. | **Fixed** — added `emitDeclarationOnly: true` (satisfies the `composite` requirement without emitting JS), deleted the stray generated files, and added `vite.config.js` to `.gitignore`. Rebuilt and confirmed only `vite.config.ts` exists on disk afterward. |
| 4 | Low | Selected step conveyed only via CSS class; the incomplete-step "!" relied solely on a `title` tooltip — neither reaches screen-reader users. | **Fixed** — selected step now sets `aria-current="step"`; incomplete steps get `aria-describedby` pointing to a visually-hidden span carrying the actual issue text, alongside the existing tooltip for sighted mouse users. |
| 5 | Low | Document mutators (`addStep`, `removeStep`, `addTokenToSelectedStep`, `removeTokenFromStep`) never refreshed `meta.updatedAt`. | **Fixed** — all four now go through a single `setSteps()` helper in `state/document.ts` that refreshes `updatedAt` on every mutation. |

Verification after fixes: `npm run lint`, `npm run typecheck`, and `npm run build` all still pass cleanly (17 modules, build in ~260ms).

## Files touched

- [.github/workflows/ci.yml](../../.github/workflows/ci.yml) — removed branch filters.
- [tsconfig.node.json](../../tsconfig.node.json) — added `emitDeclarationOnly: true`.
- [.gitignore](../../.gitignore) — added `vite.config.js`.
- [src/components/StepList/StepList.tsx](../../src/components/StepList/StepList.tsx) — `aria-current`, `aria-describedby`, hidden issue text.
- [src/styles/global.css](../../src/styles/global.css) — added a `.visually-hidden` utility.
- [src/state/document.ts](../../src/state/document.ts) — added `setSteps()`, refreshed `updatedAt` on every mutation.
- [docs/phase-1/ux-and-wireframes.md](./ux-and-wireframes.md) — documented the minimal Phase 1 flow and desktop/mobile wireframes.
- Deleted stray generated `vite.config.js` / `vite.config.d.ts`.

## Hosting decision

Vercel is the selected deployment host. The Vite build uses the Vercel domain
root, and no application code or Vercel-specific runtime package is required.

## Recommendation

Everything in Phase 1 is now documented and consistent with the architecture doc and passing CI checks. There is no remaining Phase 1 engineering blocker. The prototype deliberately keeps category order flexible; later content packs can add domain-specific guidance without making the core model recipe-shaped.

The Phase 1 flow and wireframes are complete in [ux-and-wireframes.md](./ux-and-wireframes.md). `TokenPicker` and `StepBuilder` match the documented flexible-order interaction, so Phase 1's exit criterion is met. Phase 2 task 5 (UI Layout) is the natural next step.
