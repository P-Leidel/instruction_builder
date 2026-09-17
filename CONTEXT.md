# Domain context

Terms used consistently across `docs/` and `src/`, kept here so architecture
reviews and new contributors have one place to check a name's meaning
instead of reverse-engineering it from call sites.

## Document session

A **document session** is one editable `InstructionDocument` together with
its undo/redo history (`past`/`future`), its selection
(`selectedStepId`/`selectedTokenId`), and its token clipboard
(`copiedToken`) - everything one instance of the app has open at a time.
It's constructed by `createDocumentSession()` in
[src/state/document.ts](./src/state/document.ts).

The running app uses exactly one document session (the module-level
`defaultSession` in that file), and every existing import from
`state/document` (`document`, `addStep`, `undo`, ...) is a thin, zero-argument
binding to it, so no consumer had to change when the session became
constructable. A second document session - independent signals, independent
undo/redo, independent coalescing clock - can be constructed by any other
caller (a test, or a future embedded/second instance of the app) via the
same `createDocumentSession()` factory, without touching the browser's one
JS realm the way the module-level-only version before it required.

This term replaces the informal "module-level singleton" phrasing used in
[docs/known-issues.md](./docs/known-issues.md) while that item was still
open; see [docs/phase-2/progress/README.md](./docs/phase-2/progress/README.md)
for when it was resolved.

## Token clipboard

The **token clipboard** is a document session's single-slot, in-memory
holding area for one copied token (`copiedToken`) - a full deep copy of an
`InstructionToken`, including its `note`/`quantity`/`warning`/`time`, but
with a freshly generated `id`. Copying a token writes it here, overwriting
whatever was held before; pasting reads it and appends a further fresh-id
copy onto the currently selected step, and can be repeated indefinitely
without clearing the clipboard. It is session-only UI state, not part of
the document: it isn't saved, isn't part of undo/redo history, and doesn't
touch the operating system's real clipboard - a browser tab reload or a
document replace (New/Import) simply loses it, the same way selection does.
_Avoid_: "copy buffer", "system clipboard" (this is never that).
