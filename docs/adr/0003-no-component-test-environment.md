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

## Why: the cost is a simulated DOM, not a dependency upgrade

**Corrected 2026-09-18, before this ADR was ever pushed.** The version first
written here argued that a DOM environment was blocked by the deferred Vite
major: that the only Vitest versions compatible with the pinned
`vite@^5.4.11` are the 2.x-4.x line, that every one of them depends on a
`@vitest/mocker` carrying a critical advisory
([GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9)),
and that the fix - `vitest@5` - requires `vite@^6.4.0 || ^7 || ^8`. Each of
those version facts is true. The *conclusion drawn from them was not*, and
it is corrected here in place rather than quietly deleted, because it is
exactly the argument a future reader would otherwise re-derive and believe.

None of those facts is a consequence of adding a DOM environment.
`vitest@2.1.9` - and with it `@vitest/mocker@2.1.9` - is **already installed
and already shipping in this project's dev tree today** (`npm ls
@vitest/mocker`), and that advisory is already an accepted, guard-railed
entry in [`known-issues.md`](../known-issues.md), with the guardrail being
"never run `vitest --ui`", the one mode it is exploitable in. Adding `jsdom`
as a devDependency and changing `vitest.config.ts`'s `environment: "node"`
introduces no new advisory and forces no upgrade at all. The exposure is
identical before and after. "Add component tests" *is* a tooling decision
that can be made on its own merits, and it is made on them below.

What it actually costs is real, but smaller and of a different kind:

- **A simulated DOM for the app whose hardest behaviour is precisely what a
  simulated DOM gets wrong.** Drag and drop, SVG export, download plumbing,
  `inert`, and focus management are this component tree's difficult parts,
  and jsdom either does not implement them or implements them as a
  plausible-looking approximation - which is worse, because a green test
  then asserts something the browser does not do. This is the argument that
  carries the decision, and it never depended on the upgrade claim.
- **A build step the test config currently does without.**
  [`vitest.config.ts`](../../vitest.config.ts) is deliberately standalone
  from [`vite.config.ts`](../../vite.config.ts), and its own comment says
  why: the app config exists for the build/dev-server and the Preact JSX
  plugin, "neither of which this pass's test scope needs (plain `.ts` unit
  tests, no `.tsx` rendering)". Rendering components means wiring
  `@preact/preset-vite` into the test config and adding a rendering helper,
  so `npm test` stops being a plain, plugin-free pass over plain TypeScript.
- **Two more devDependencies** on a project that committed in Phase 1 to
  adding as few as it can get away with.

None of that is prohibitive. It is simply not free either, and it buys a
weaker signal than the coverage that already exists.

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
- **Revisit when** the extraction strategy above stops absorbing the work -
  i.e. when a real regression ships that neither a `src/lib/` unit test nor
  the driver could have caught, and the honest post-mortem is "a component
  test would have found this". That, not a dependency upgrade, is the
  trigger. Nothing about the tooling blocks this decision from being
  reversed on any ordinary afternoon, so it should be re-argued on its
  merits whenever someone wants to, rather than inherited.
