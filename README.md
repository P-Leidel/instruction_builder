# Visual Instruction Builder

A browser-based, offline-first app for building step-by-step visual instructions by arranging icons on a structured canvas. Currently in **Phase 1: Concept Validation**.

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

- [docs/project-plan.md](docs/project-plan.md) — the approved project plan (goals, stack, phased task list, risks, success criteria).
- [docs/phase-1/architecture.md](docs/phase-1/architecture.md) — the Phase 1 architecture blueprint (data model, app architecture, folder structure, component responsibilities, roadmap, risks).
- [docs/phase-1/foundation.md](docs/phase-1/foundation.md) — explains every file in this scaffold and why it exists.

## Deployment

The chosen host is Vercel. Use the Vite defaults:

- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: `dist`
- Node.js: 20+

No Vercel-specific package, serverless function, or backend configuration is
required. The app is deployed as a static client-side build.

## Status

Phase 1 only: an in-memory, no-persistence prototype validating the "assemble a step from tokens" interaction. No canvas, export, drag-and-drop, or saving yet — those are Phase 2.
