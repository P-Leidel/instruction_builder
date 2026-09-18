# Architecture: 2026-09-18 modal confirm dialogs, download timing, and the mobile layout

> 📌 **Doc status: CURRENT** — one file in the
> [Phase 3 Progress Log](./README.md).

Date: 2026-09-18

The second batch of remediation against the 2026-09-18 codebase health
review ([archived report](../audits/2026-09-18-architecture-review.html)),
picking up where
[the field-placement seam and tablet viewports](./architecture-2026-09-18-field-placement-and-tablet-viewports.md)
left off. Everything here was scoped to land **before** task 30's tablet
round: each item is either something a tablet or phone tester would hit
first, or a decision that needed recording before it got re-litigated.

The work list was treated as **fourteen items on one severity scale** -
the review's ten still-open findings plus the four non-accepted items
already tracked in [known-issues.md](../../known-issues.md) - rather than
two lists graded separately. Four things came out of that as pre-round
work; the rest were requeued as ordinary work (findings 1, 2, 4, 5, 12,
14, the small-tokens-at-390px clamp, and the keyboard token move that
finding 4 gates) or parked with a reason (finding 10, now
[ADR-0003](../../adr/0003-no-component-test-environment.md)).

## What shipped

Four commits, in the order below. Each code commit was followed by a full
driver run rather than batching the verification at the end.

- **`docs/adr/` exists, with the three decisions it was recommended for.**
  The review's candidate 1 asked for an ADR log by name, for a specific
  reason: its own consolidation suggestion had been raised by two
  successive reviews with nothing in `docs/` recording the answer.
  [0001](../../adr/0001-keep-collapsedfield-dual-mode.md) keeps
  `CollapsedField`'s dual controlled/uncontrolled mode and replaces the
  "deferred, not rejected" comment at the guard with a real cost argument
  and a revisit trigger. [0002](../../adr/0002-no-shared-no-op-guard.md)
  declines a shared no-op guard in `state/document.ts`; per the review's
  own "five-minute version", `setSteps`' doc comment now names the
  convention the three guards serve, so the concept is visible without an
  abstraction existing to hold it.
  [0003](../../adr/0003-no-component-test-environment.md) parks
  component-level unit testing and writes down the coupling nothing else
  recorded - a DOM test environment forces the Vite major upgrade
  `known-issues.md` defers, to gain a *simulated* DOM for the behaviour a
  simulated DOM is worst at. All three landed in one commit because they
  share an index that would otherwise have been rewritten three times.
- **Every export stopped revoking its object URL in the click's own task**
  (finding 9). `downloadBlob` clicked a detached `<a download>` and
  revoked on the next line. Chromium tolerates both; Safari, and iOS
  Safari particularly, has a long history of cancelling the transfer when
  the URL dies first. It is the one code path behind all four export
  formats and had only ever run on desktop Chromium.
- **The confirm dialogs became modal in declaration, not just in
  behaviour** (finding 7). `aria-modal="true"`, `inert` on everything
  outside the dialog, focus returned to the opener - and the hand-rolled
  two-button Tab cycle deleted rather than kept alongside. Details below;
  this was the item that turned out to have more inside it than the report
  described.
- **The empty "Token details" placeholder collapses on the mobile layout**
  (`known-issues.md`, graded S3). One modifier class and a rule inside the
  existing `min-width: 800px` block; no DOM reorder was needed, because
  collapsing the placeholder already leaves the order reading Step details
  -> canvas -> Add to step.

## Decisions worth keeping

- **`inert` covers the toast and the persistence banner too**, not only
  the toolbar and the main grid. Those two sit outside both, and the toast
  carries a focusable Dismiss button - leaving it tabbable behind a modal
  is exactly what `aria-modal="true"` would then have been lying about.
  The cost is that a visible toast leaves the accessibility tree while a
  dialog is open, which is what modality means.
- **`confirmDialogOpen()` is a second helper, not a reuse of
  `keyboardShortcutsSuspended()`** beside it. The two overlap on both
  dialog signals, but the existing one also includes `previewMode`, and
  Preview is not modal: inerting the page during it would strand the user
  on a read-only canvas with no way back. Two names for two genuinely
  different questions. Being called from `App`'s render (rather than from
  an event handler) is also what subscribes `App` to those signals, which
  is the only reason the `inert` attributes update at all.
- **The Tab cycle was deleted, not kept as a backstop.** It knows about
  exactly two buttons, does nothing for a screen reader in browse mode,
  and says nothing about what is behind the dialog. Keeping it alongside
  `inert` would have been two mechanisms enforcing one rule - the exact
  shape removed from `FieldPopover` one commit earlier.
- **No third media query.** `global.css` has exactly two (`print` and
  `min-width: 800px`), and that discipline is what makes "which layout am
  I looking at?" answerable. The mobile fix is a modifier plus one rule in
  the block that already exists.
- **Finding 5 (the PDF chunk) was *not* fixed here**, deliberately. The
  correction below shows the dead libraries are never downloaded by
  anyone, so it is a deploy-size issue rather than a tester-facing one -
  requeued as ordinary work rather than treated as pre-round.

## Three things the work found that the report did not

- **Escape stopped closing the dialogs.** Removing the Tab cycle let focus
  legitimately leave the dialog's subtree (past the last button the
  browser parks it on `<body>`), and the Escape handler lived on the
  dialog element's `onKeyDown`, which only sees keys bubbling *through* the
  dialog. The dialog became uncloseable by keyboard. It is a `window`
  listener now, matching the native `<dialog>` element. Surfaced as a hard
  driver timeout on the next interaction, not as anything visible.
- **The opener cannot be read from `document.activeElement` on open.**
  Marking the toolbar `inert` *blurs* whatever was focused inside it, in
  the same commit that mounts the dialog - so by the time any effect runs,
  `activeElement` is already `<body>`. The hook records the last element
  focused while the dialog was closed instead. Surfaced as a plain
  `false`.
- **The hidden export canvas was a keyboard tab stop on every page view**,
  with nothing to do with dialogs. `.instruction-canvas` is
  `overflow-x: auto`, and Chromium makes scroll containers
  keyboard-focusable, so focus vanished once per pass into a zero-sized
  `aria-hidden` node. `width: 0; height: 0; overflow: hidden` and
  `aria-hidden` have no effect on tab order. Marked `inert`; it has its own
  [fixed-issues entry](../../fixed-issues/hidden-export-canvas-was-a-keyboard-tab-stop.md)
  since it long predates this work.

All three were found by the *rewritten* driver check failing, not by
reading the code - which is the argument for having changed the check's
assertion rather than only its subject. The old check asserted a mechanism
("Tab cycles between exactly these two buttons"); the new one asserts the
property ("Tab never lands outside the dialog"), and a property survives
the mechanism being replaced.

## Two corrections to the report

- **Finding 5 overstates the PDF chunk's cost.** jsPDF 4.2.1 imports
  `html2canvas` and `dompurify` **dynamically** (`import("html2canvas")`),
  not statically as the report claims. Rollup emits them as separate
  chunks with an empty preload-deps array, so they sit on the CDN and are
  never requested. Driven against a real production build, an Export PDF
  click fetches exactly `jspdf.es.min` (391 kB), `svg2pdf.es.min` (87 kB)
  and `_commonjsHelpers` (0.24 kB) - **478 kB raw / ~155 kB gzipped**, not
  the report's 858 kB / 265 kB. `index.es` (151 kB) is not fetched either;
  the report counted it as downloaded. The real cost is ~381 kB of dead
  chunks *deployed* that no user ever downloads. There is also a risk the
  report missed: aliasing `dompurify` to a stub means that if jsPDF ever
  reaches for it on a path this app does use, it fails at runtime rather
  than at build time. Recorded in
  [known-issues.md](../../known-issues.md).
- **Tablet overflow assertions must use `<= 0`, never `=== 0`.** Above
  800px, `html { scrollbar-gutter: stable }` reserves 15px
  unconditionally, so `scrollWidth` is legitimately *smaller* than
  `clientWidth` - it measures -15, not a positive overflow. The mobile
  pass's `=== 0` is correct at 390px and wrong at 1024px. Already
  commented in `driver.mjs` and the driver skill, and repeated here
  because it is easy to "fix" back by mistake.

## Verification

- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` all
  clean.
- A full driver run after each code commit, plus a final green run:
  every check `true`, all five axe scans at zero violations, and
  `CONSOLE_ERRORS_COUNT=0`. The axe scans carried real weight this time,
  since `inert` and `aria-modal` both change what the accessibility tree
  contains.
- Three new checks: `DOWNLOAD_DEFERS_OBJECT_URL_REVOKE`,
  `CONFIRM_DIALOG_RETURNS_FOCUS_TO_OPENER`, and
  `MOBILE_LAYOUT_COLLAPSES_EMPTY_TOKEN_DETAILS`, plus a rewritten
  `IMPORT_DIALOG_TRAPS_FOCUS_AND_ESCAPE_CLOSES` and an
  `IMPORT_DIALOG_TAB_STOPS` trace that prints where focus actually went.
- The download check is the unusual one, because **Chromium cannot
  reproduce the bug it guards**. It patches
  `HTMLAnchorElement.prototype.click` and `URL.revokeObjectURL` in the
  page and asserts the property Safari cares about: anchor connected at
  click time, no revoke in the click's own task. Confirmed to fail against
  the old sequence with a throwaway control script
  (`sameTaskRevoke=true detachedAnchor=true`) before being trusted. A green
  result means "this could not fail on Safari for that reason", not "this
  was tested on Safari".
- No new Vitest tests. Nothing here added branchable pure logic: the
  download change is DOM sequencing, the dialog change is focus and
  attribute wiring, and the mobile change is one CSS rule - all three
  covered by the driver, which is the arrangement
  [ADR-0003](../../adr/0003-no-component-test-environment.md) now records
  as deliberate.

## What's next

Task 30's tablet round. After it reports back: folding the remaining
findings into `known-issues.md` with the report's two documentation
corrections, and architecture candidates 2, 4 and 5. The requeued
correctness one-liners (findings 1, 2, 4) are worth picking up whenever
those files are next open - finding 4 in particular gates the keyboard
token move, which is still a tracked accessibility gap.
