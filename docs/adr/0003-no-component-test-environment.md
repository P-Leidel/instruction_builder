# ADR 0003 — No DOM test environment; components are covered by the browser driver

> 📌 **Doc status: CURRENT** — a reference doc: it records a decision that
> stays accurate until the decision itself is revisited (at which point this
> file is edited or superseded, not frozen). See
> [../milestones.md](../milestones.md#documentation-status-conventions) for
> what CURRENT/HISTORICAL mean project-wide, and
> [README.md](./README.md) for the index of decisions recorded here.

**Status:** accepted, 2026-09-18.

## Context

Every Vitest test in this project lives under `src/lib/`, `src/model/` or
`src/state/`. There is not one test file under `src/components/`, and no DOM
test environment (jsdom/happy-dom, `@testing-library/preact`) is configured.
The 2026-09-18 codebase health review
([finding 10](../phase-3/audits/2026-09-18-architecture-review.html)) named
this as one of the two structural weaknesses in the codebase.

The component tree's actual coverage is the Playwright driver in
[`.claude/skills/run-instruction-builder/`](../../.claude/skills/run-instruction-builder/SKILL.md):
a real Chromium, a real dev server, real pointer drags, real downloads
opened and inspected, and axe-core scans at five viewport/state
combinations. That is not a stand-in for component tests - it is a different
kind of coverage, and for this app's genuinely DOM-bound behaviour (drag and
drop, SVG export, download plumbing, focus management) it is the more
faithful one.

## Decision

Do not add a DOM test environment. Components stay covered by the browser
driver. Where a component holds logic worth testing in isolation, the logic
moves out to `src/lib/` rather than the test environment moving in.

## Why: the coupling nothing else records

Adding jsdom or happy-dom means adding a Vitest DOM environment, and the
only Vitest versions compatible with this project's pinned `vite@^5.4.11`
are the 2.x-4.x line. Every one of those depends on a `@vitest/mocker`
version carrying a critical advisory
([GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9)),
and the fix - `vitest@5` - requires `vite@^6.4.0 || ^7 || ^8`. That is the
major Vite upgrade [`known-issues.md`](../known-issues.md) already defers,
with its own reasons and its own two operational guardrails.

So "add component tests" is not a tooling decision that can be made on its
own merits: it forces a dependency upgrade this project has deliberately
deferred, in order to gain a *simulated* DOM for an app whose hardest
behaviour is precisely the part a simulated DOM gets wrong. Neither
`known-issues.md` (which explains the deferral but not what depends on it)
nor the review (which names the coupling in passing) recorded this as a
standing constraint. It is recorded here.

## The alternative that is actually being pursued

Push testable logic *out* of components and into `src/lib/`, where it is
plain Vitest with no environment at all. This is not hypothetical - it is
the move that already produced
[`canvas-layout.ts`](../../src/lib/canvas-layout.ts),
[`pointer-drag.ts`](../../src/lib/pointer-drag.ts),
[`quantity.ts`](../../src/lib/quantity.ts) and, most recently,
[`field-placement.ts`](../../src/lib/field-placement.ts), which turned "where
does a floating panel go?" from an untested comparison inside an effect into
six unit tests at any viewport you can type.

## Consequences

- A component-only regression (markup, class names, wiring) is caught by the
  driver or not at all. The driver therefore has to be run - and has to stay
  green - for any component change, which is why it is invoked after every
  code commit rather than only before a release.
- A component whose logic is hard to reach from the driver is a signal that
  the logic wants extracting, not that the test environment is missing.
- **Revisit when** the Vite major upgrade happens for its own reasons. At
  that point `vitest@5` and a DOM environment come almost for free, and this
  decision should be re-argued on its merits rather than inherited.
