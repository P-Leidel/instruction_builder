# Visual Instruction Builder

A browser-based, offline-first app for building step-by-step visual instructions by arranging icons on a structured canvas.

## Getting started

Requires Node.js 20+.

```bash
npm install
npm run dev       # start the dev server
npm run typecheck # tsc -b, no emit
npm run lint      # eslint .
npm run build     # typecheck + production build
```

## Documentation

Planning and architecture docs live in [docs/](docs/):

- [docs/milestones.md](docs/milestones.md) — the single source of truth for current phase/task status; start here.
- [docs/project-plan.md](docs/project-plan.md) — the approved project plan (goals, stack, phased task list, risks, success criteria).
- [docs/phase-1/architecture.md](docs/phase-1/architecture.md) — the Phase 1 architecture blueprint (data model, app architecture, folder structure, component responsibilities, roadmap, risks). Historical - see milestones.md for what's actually been built since.
- [docs/phase-1/foundation.md](docs/phase-1/foundation.md) — explains every file in the original Phase 1 scaffold and why it exists.

## Deployment

The chosen host is Vercel. Use the Vite defaults:

- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: `dist`
- Node.js: 20+

No Vercel-specific package, serverless function, or backend configuration is
required. The app is deployed as a static client-side build.

## Status

See [docs/milestones.md](docs/milestones.md) for the current phase and task-by-task status - it's the one place that's kept up to date as work lands, so it's deliberately not duplicated here.
