# Known Issues

> 📌 **Doc status: CURRENT** — living doc, evergreen across phases. Update
> it directly whenever an issue is found, fixed, or newly deferred; see
> [milestones.md](./milestones.md#documentation-status-conventions) for
> what CURRENT/HISTORICAL mean project-wide.

Tracked, intentionally-deferred issues that `npm run lint`/`typecheck`/`build`
don't surface. Not a replacement for fixing bugs promptly - only for things
noted and deliberately left alone.

## `vite`/`esbuild`/`vitest` dev-only vulnerabilities (3 moderate, 1 high, 1 critical; not fixed)

- **What it is:** `npm audit` reports a cluster of advisories against the
  existing `vite@^5.4.11` dependency (not introduced by any Phase 2
  addition - first surfaced 2026-09-13 by `npm audit` after adding
  `playwright`, and still the same underlying dependency after later adding
  `lucide-static` and `idb-keyval`):
  - [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99) (moderate, CVSS 5.3) - the bundled `esbuild` (`<=0.24.2`) dev server doesn't validate request origin, so any website a developer visits can send it requests and read the response.
  - A `vite` advisory group (rolled up by `npm audit` as "high") covering: path traversal in optimized-deps `.map` handling, an `server.fs.deny` bypass via Windows alternate data streams, and an NTLMv2 hash disclosure in `launch-editor` via UNC path handling on Windows.
- **Where it applies:** `npm run dev` (the local dev server) and, for the
  Windows-specific ones, only while running that dev server on Windows -
  plus, as of Task 20, `npm test`/`vitest run` (the critical `vitest`
  advisory below is a devDependency-only, UI-server-only risk, not present
  in the dev server itself). None of these affect `npm run build`'s output -
  the production static bundle never runs `esbuild`'s or Vite's dev server,
  nor any part of `vitest`.
- **Why it's not fixed:** `npm audit fix --force` would upgrade `vite` to
  `8.3.0`, a major-version jump (current: `^5.4.11`) with breaking changes,
  for vulnerabilities that only matter while actively running the dev
  server locally (this machine is Windows, so the Windows-specific ones are
  worth noting, but still dev-only). Deferred deliberately rather than
  accepted as safe indefinitely - revisit alongside a real reason to touch
  the Vite version (e.g. a Phase 2 task that needs a newer Vite feature),
  rather than as an isolated upgrade.
- **This also affects `vitest`, now a real `devDependency` as of Task 20.**
  Confirmed 2026-09-13 while prepping Task 20 (Automated Testing): the only
  `vitest` versions compatible with the pinned `vite@^5.4.11` are the 2.x-4.x
  line, every one of which depends on a version of `@vitest/mocker` with a
  **critical** advisory ([GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9)),
  arbitrary file read when Vitest's own UI server (`vitest --ui`) is
  listening - a mode this project never invokes (`npm test` runs `vitest
  run`, a one-shot CLI pass with no server). The fix is `vitest@5.0.0`,
  which requires `vite@^6.4.0 || ^7 || ^8` - the same major jump this entry
  already defers. Decided 2026-09-13 (with explicit sign-off, after the
  option was first tried, rolled back, and re-confirmed unavoidable at any
  compatible version) to accept this one exactly like the two above: `vitest@2.1.9`
  is installed, and this is now the accepted, understood state rather than a
  gap - revisit alongside the same eventual Vite major upgrade, not in
  isolation.
- **Operational guardrails while this stays deferred** (added 2026-09-17,
  per an independent external re-check - see
  [phase-3/reviews/check/audit-evaluation-2026-09-17.md](./phase-3/reviews/check/audit-evaluation-2026-09-17.md)):
  don't bind `npm run dev` to anything other than localhost (no `--host`, no
  exposing it on a shared/untrusted network) - the `esbuild` advisory above
  is exactly "any website a developer visits can send the dev server
  requests," so this matters while the server is actually running, not just
  in principle - and never run `vitest --ui` for this project, since that's
  the one mode the critical `@vitest/mocker` advisory actually requires to be
  exploitable (`npm test` only ever runs `vitest run`, which doesn't start
  that server). Neither guardrail requires any dependency change.
- **First noted:** 2026-09-13.

## Design debt flagged by an external architecture audit, one item still deferred

An external architecture-review report (a third-party HTML document, not the
`code-reviewer` subagent) was checked line-by-line against the actual source
on 2026-09-13 and found to be fully accurate. Archived as-received at
[phase-2/audits/2026-09-13-external-architecture-audit.html](./phase-2/audits/2026-09-13-external-architecture-audit.html). One finding from it (a live
data-loss bug on a document schema-version mismatch) was fixed immediately -
see [fixed-issues/schema-version-mismatch-data-loss.md](./fixed-issues/schema-version-mismatch-data-loss.md). A second (lifting the canvas's pure
layout geometry out of `InstructionCanvas` into its own module,
`lib/canvas-layout.ts`) was folded into Task 15 (SVG Export) as planned and
is done - see [planned-additions.md](./planned-additions.md) item 2 and
[phase-2/progress/task-15-svg-export.md](./phase-2/progress/task-15-svg-export.md). A third - "document
session tied to module-level singletons" - was resolved 2026-09-13 via a
`/improve-codebase-architecture` pass: `state/document.ts`'s undo/redo
history, coalescing clock, and selection-repair logic are now constructed by
`createDocumentSession()` rather than living only as module-level signals
and `let`s, so a second, fully independent session (for a test, or a future
embedded instance of the app) can exist alongside the app's own without
sharing state - see [CONTEXT.md](../CONTEXT.md)'s "Document session" entry
and [phase-2/progress/architecture-document-session-refactor.md](./phase-2/progress/architecture-document-session-refactor.md) for the shape of
the change. Every existing consumer of `state/document.ts` kept importing
the same names unchanged, verified by a full clean run of
`.claude/skills/run-instruction-builder`'s driver (35/35 checks,
`CONSOLE_ERRORS_COUNT=0`) after the refactor. This was prep work, not Task
20 itself - no test runner was added (see that task's own note below on
why) and no unit tests exist yet; it only makes writing them possible.
A fourth - "drag-and-drop protocol duplicated across four modules" - was
also resolved 2026-09-13, in the same `/improve-codebase-architecture`
session, as three surgical fixes rather than a full redesign:
`lib/pointer-drag.ts`'s `TokenDropTarget` and `state/drag.ts`'s `DropTarget`
(structurally identical, same comment copied verbatim) are now one type -
`state/drag.ts` imports `TokenDropTarget` instead of declaring its own copy,
since nothing outside that file ever referenced `DropTarget` by name
(confirmed by grep before merging); the module-level `justDragged` flag
independently declared in both `StepList.tsx` and `TokenPicker.tsx` is now
one shared `createClickAfterDragGuard()` factory in `lib/pointer-drag.ts`,
a plain function (not a hook) to match that file's existing style; and the
"drop-before index in the pre-removal array" adjustment, previously
hand-written once each in `moveTokenCore`/`reorderStepsCore`
(`state/document.ts`), is now one unexported `adjustIndexForRemoval` helper
in that file. `InstructionCanvas.tsx`'s own inline drag-orchestration block
was deliberately left alone - its click-vs-drag handling is genuinely
different (no `onClick`/`justDragged` at all; the decision is folded
directly into `onDrop`'s `wasDrag` check), so folding it into the same
shared helper as `StepList`/`TokenPicker` would have meant adding a branch
for a case that doesn't need one. Verified the same way as the document-
session fix: a full clean driver run (35/35 checks, `CONSOLE_ERRORS_COUNT=0`)
after the change, with no call-site changes needed anywhere outside the
five files actually touched. See
[phase-2/progress/architecture-drag-drop-protocol-collapse.md](./phase-2/progress/architecture-drag-drop-protocol-collapse.md) for the full file list.
The remaining item is still deliberately deferred:

- **Token/attachment vocabulary enumerated in several places - still open,
  deferred to Phase 4 task 32.** `TokenCategory` (`model/instruction.ts`) is
  hand-copied into `TOKEN_CATEGORIES` (`model/migrate.ts`) and
  `STEP_TOKEN_CATEGORIES` (`TokenPicker.tsx`), and `AttachmentKind`
  (`state/document.ts`) is a separate, narrower type covering just the two
  attachable categories. (A 2026-09-15 rework that folded "Add to token"
  into `TokenDetails` resolved one sub-instance of this: an
  `ATTACHMENT_CATEGORIES` array in the now-deleted `TokenAttachmentPicker.tsx`
  and an `ATTACHMENT_KINDS` array in `TokenDetails.tsx` used to list the same
  two values in reversed order - both arrays are gone now, since
  `TokenDetails`' Quantity/Warning rows are two fixed, hardcoded rows rather
  than a mapped list, so that particular drift can't recur.) This is
  unaffected by the quantity-representation fix below and remains deferred to
  Phase 4 task 32 (Formalize the Content-Pack Shape), per the 2026-09-14
  Phase 3/4 reprioritization (see
  [project-plan.md](./project-plan.md#implementation-plan)), not Phase 3. A
  2026-09-14 internal architecture review (see
  [phase-3/audits/2026-09-14-architecture-review.html](./phase-3/audits/2026-09-14-architecture-review.html))
  sharpened this further: `units.ts`'s and `instruction.ts`'s own comments
  ("a non-food domain can offer a different unit list without this file's
  shape needing to change," "kept generic so Phase 4 content packs can
  extend it without changing this interface") are each accurate about their
  own narrow scope, but neither warns that `TokenCategory` itself, or any of
  its hand-copied arrays above, are *not* part of that swappable surface - a
  real domain swap touches code in several places, not just a data file.
  Worth keeping in mind when task 32 is scoped, so it doesn't start from a
  rosier picture than what's actually there.
- **Quantity amount/unit representation - Resolved 2026-09-17, migration gap
  closed the same day.**
  `InstructionToken.quantity` is now a structured `QuantityAttachment`
  (`{ iconId, label, amount, unit }`, mirroring how `DurationAttachment`
  already carries its raw `seconds` alongside the formatted `label`), built
  and validated by a new `lib/quantity.ts` (mirroring `lib/duration.ts`) via
  `MIN_QUANTITY`/`MAX_QUANTITY`/`buildQuantity`. See
  [phase-3/progress/architecture-2026-09-17-collapsedfield-and-structured-quantity.md](./phase-3/progress/architecture-2026-09-17-collapsedfield-and-structured-quantity.md)
  for the full writeup, and
  [phase-3/reviews/check/audit-evaluation-2026-09-17.md](./phase-3/reviews/check/audit-evaluation-2026-09-17.md)
  for an independent same-day re-check confirming the fix in source.
  **Correction (later the same day):** that re-check, and this entry's own
  earlier wording, understated the exposure as "a pre-fix imported
  document" - a same-day whole-codebase audit
  ([phase-3/reviews/2026-09-17-whole-codebase-audit-evaluation.md](./phase-3/reviews/2026-09-17-whole-codebase-audit-evaluation.md),
  finding 6) traced via `git log`/`git show` that the live production
  deploy (`580d5e6`) saved this label-only shape for about 2 days 16 hours
  before the structured-quantity fix (`9ab8e64`) shipped, without
  `CURRENT_SCHEMA_VERSION` ever bumping - so real documents *autosaved* by
  the live app during that window (not just hand-crafted imports) carry this
  shape too, and were silently mishandled on load: `QuantityForm.tsx`'s
  `value?.amount ?? 1` / `value?.unit ?? EU_FOOD_UNITS[0].value` fallback
  meant opening such a token's Quantity for editing showed "1 g" instead of
  the real historical value. Closed by giving `migrate()` a real, tested
  repair step (`repairLegacyQuantity`, `src/model/migrate.ts`, covered by
  `src/model/migrate.test.ts`): every label in that window was always built
  as exactly `${amount} ${unit}` from a validated integer and a space-free
  unit, so splitting on the first space losslessly recovers the original
  value on both load and import, rather than needing a regression test to
  merely document the gap.
  <details><summary>History (the fused-string representation this replaced)</summary>

  Before this fix, a Quantity's amount and unit were fused into one display
  string at attach time (`` `${amount} ${unit}` `` in `TokenDetails.tsx`'s
  `QuantityRow`), stored only in that joined form - not as separate
  `amount`/`unit` fields on `TokenAttachment`. A 2026-09-15 rework made
  `QuantityRow` mirror `DurationField`'s collapsed/edit-toggle interaction,
  which closed two concrete gaps this used to describe (editing an attached
  value pre-filled the form via a `splitQuantity` helper that re-parsed the
  joined label, and Save replaced the old value in place without a remove
  first), but the underlying representation gap remained: `splitQuantity` was
  a best-effort re-parse of a display string, not a real inverse of a
  structured value, and silently fell back to defaults for anything it didn't
  recognize (e.g. a value from an older schema or a future unit list change).
  A fresh architecture audit
  ([phase-3/audits/2026-09-17-canvas-tokenchip-and-field-shape-review.html](./phase-3/audits/2026-09-17-canvas-tokenchip-and-field-shape-review.html))
  re-surfaced this candidate - despite its own prior assessment rating it
  weaker than the others - once `TimeAndQuantityRow`'s mutual-exclusion
  coupling (added by the 2026-09-15 rework above) made `QuantityRow` a less
  isolated place for it to keep living, which is what prompted the fix above.
  `splitQuantity` was deleted once `QuantityAttachment` shipped.
  </details>
- **First noted:** 2026-09-13.

## One accessibility gap deliberately left for a later pass

Raised and scoped with the user before task 22 (Add Accessibility
Features) started; both items below were explicitly out of scope for that
task, which shipped keyboard alternatives for step reordering and token
*selection* only - see
[phase-2/progress/task-22-accessibility-features.md](./phase-2/progress/task-22-accessibility-features.md).

- **No keyboard way to reorder a token within a step, or move it to a
  different step.** Both are drag-and-drop only (task 9). Step reordering
  got Move up/down buttons this task specifically because the project plan
  called it out by name; token movement didn't, and doing it well (moving
  *to* a specific step, not just up/down within one) needs its own small
  design pass rather than reusing the step pattern as-is.
- **`TokenPicker`'s category switcher didn't implement real keyboard
  navigation - Resolved 2026-09-17.** It used to be `role="tablist"`/
  `role="tab"` without the WAI-ARIA APG Tabs pattern's roving tabindex +
  arrow-key navigation - keyboard-operable via Tab/Enter/Space, but not the
  idiomatic Left/Right-arrow-to-switch convention some screen reader users
  expect once they hear `role="tab"` announced. Fixed by re-modeling it as
  `role="radiogroup"`/`role="radio"` instead of fixing the tabs pattern in
  place - a closer semantic match, since it filters one grid rather than
  showing independent tabbed content - which gets correct roving-tabindex +
  wrapping arrow-key behavior as a property of the pattern itself. See
  [phase-3/reviews/2026-09-17-external-audit-evaluation.md](./phase-3/reviews/2026-09-17-external-audit-evaluation.md)
  for the evaluation that scoped this fix, and
  [`TokenPicker.tsx`](../src/components/TokenPicker/TokenPicker.tsx)'s own
  doc comment for the shipped shape. Covered by a new
  `TOKEN_CATEGORY_ARROW_KEY_NAV_WORKS` driver check.
- **First noted:** 2026-09-14.

## Full canvas re-render on any edit anywhere in the document

- **What it is:** `InstructionCanvas.tsx` reads `document.value.steps`
  directly in its component body, so editing one step (typing a title,
  attaching a warning, moving a token) re-renders the *entire* canvas -
  every step, not just the one that changed. This is the one place this
  app's `@preact/signals`-based "fine-grained reactivity" (see
  [project-plan.md](./project-plan.md#technology-stack)) isn't actually
  exercised; `selectedStep`/`selectedToken` (`state/document.ts`) get this
  right via `computed()` + referential stability, `InstructionCanvas`
  doesn't. (This used to also apply to a separate `StepList.tsx`; a
  2026-09-15 rework deleted it and moved step management onto the canvas
  itself - see
  [phase-3/progress/step-management-moved-to-canvas.md](./phase-3/progress/step-management-moved-to-canvas.md) -
  so the finding is now about one component, not two.)
- **Why it's not fixed:** raised and investigated during task 24
  (Optimize Performance) - see
  [phase-2/progress/task-24-performance.md](./phase-2/progress/task-24-performance.md#investigated-not-fixed-whole-document-signal-subscription).
  The seemingly-obvious fix (split each component into a per-step child
  that reads the relevant signals directly) doesn't actually work today:
  `lib/canvas-layout.ts`'s `computeCanvasLayout` recomputes every step's
  `cardY` from scratch on every edit (each step's vertical position
  depends on every step above it), so per-step layout objects have no
  referential stability to split components around - a per-step split
  would still re-render every step after the edited one, just via a
  different mechanism. A real fix needs `computeCanvasLayout` reworked for
  incremental per-step stability first - a real change to an
  already-tested layout module, deferred because the re-render cost it
  would save is small at this app's actual scale (dozens of DOM nodes,
  where Preact's diffing is already cheap without memoization).
- **Revisit if:** a real document grows far beyond "a handful of steps,
  each with a handful of tokens" (the scale this app and its testing are
  built around), or if `computeCanvasLayout` ever needs reworking for
  another reason (e.g. the radial-layout idea in
  [planned-additions.md](./planned-additions.md#2-radial-steps-point-to-a-center-goal-canvas))
  and per-step stability could be picked up as a side effect of that work
  rather than its own isolated cost.
- **First noted:** 2026-09-14.

## Mobile layout order buries the canvas below an empty Token details placeholder - Resolved 2026-09-18

- **What it was:** at the 390px mobile stacking order, `Token details` (an
  empty "Select a step, then click one of its tokens..." placeholder until
  a token is actually picked) and the entire instruction canvas sat between
  `Step details` and `Add to step`. A first-time mobile user scrolled past a
  placeholder with nothing in it before reaching the canvas that actually
  shows what they've built - the one view that's the whole point of the
  app.
- **Why it stayed open as long as it did:** found during a 2026-09-14
  pre-launch UI review (see
  [phase-3/progress/pre-launch-file-and-ui-audit.md](./phase-3/progress/pre-launch-file-and-ui-audit.md))
  alongside 6 other findings; the user asked for the smaller, purely
  visual/CSS items to ship immediately and this one - a mobile-only
  reorder - to be tracked instead, since it looked like it touched more of
  the stacking order than a small CSS tweak. The 2026-09-18 codebase
  health review
  ([phase-3/audits/2026-09-18-architecture-review.html](./phase-3/audits/2026-09-18-architecture-review.html))
  raised it from that implied low priority to S3 on one argument: this is
  the first thing every mobile tester meets, and mobile testing was about
  to start - so it was worth doing *before* the tablet round rather than
  after it, so the feedback would be about the real layout.
- **How it was fixed:** no DOM reorder was needed after all, which is what
  made it small. `TokenDetails`' empty branch now carries a
  `token-details--empty` modifier, `display: none` by default and re-shown
  inside `global.css`'s existing `@media (min-width: 800px)` block -
  collapsing the placeholder already leaves the stacking order reading
  Step details -> canvas -> Add to step. Deliberately **not** a third media
  query: this stylesheet has exactly two (`print` and `min-width: 800px`),
  and that discipline is what makes "which layout am I looking at?"
  answerable. Covered by the driver's new
  `MOBILE_LAYOUT_COLLAPSES_EMPTY_TOKEN_DETAILS` check, which asserts both
  sides of the breakpoint (collapsed at 768px with the canvas reached
  before "Add to step"; still shown at 1024px).
- **First noted:** 2026-09-14.

## Canvas token icons and labels are small at 390px

- **What it is:** `.instruction-canvas__svg`'s `clamp(480px, 100%, 960px)`
  minimum means the canvas card scrolls sideways on a phone by design
  rather than shrinking to fit, so a token's icon and label are small at
  390px. Flagged as a known area of active work in
  `.claude/skills/run-instruction-builder/SKILL.md`'s own troubleshooting
  table.
- **Why it's not fixed:** split out of the mobile-layout entry above when
  that one was resolved on 2026-09-18 - the two were tracked together
  because both are about the mobile canvas experience, but only the
  stacking-order half was cheap. Changing the clamp trades legibility
  against how much of a step fits on one screen, which is a judgement
  better made with real tester feedback than guessed at beforehand.
- **Revisit when:** task 30's tablet/phone round reports back on it, or in
  task 31 (Refine UX). Graded S4 by the 2026-09-18 codebase health review,
  which recommended bundling it with the mobile layout reorder; that half
  shipped without it for the reason above.
- **First noted:** 2026-09-14 (as part of the entry above); tracked
  separately from 2026-09-18.

## PDF pagination selector fix has no driver regression test yet - Resolved 2026-09-17 (same day, by removing the DOM read entirely)

- **What it was:** `pdf-export.ts`'s `readStepBounds()` was selecting
  `[data-step-id]`, an attribute both step groups and token groups carry,
  so token groups could be read as spurious "step" entries and corrupt PDF
  pagination on some documents - fixed earlier the same day by switching to
  `[data-step-index]` (step groups only). See
  [fixed-issues/pdf-pagination-step-bounds-selector-collision.md](./fixed-issues/pdf-pagination-step-bounds-selector-collision.md)
  for that fix's full root cause. What was missing at that point was an
  automated regression test proving this specific bug couldn't come back -
  this entry originally explained why that test looked hard to write.
- **Why it looked hard to fix (now moot):** the obvious approach -
  strengthen the driver's existing multi-page PDF check
  (`.claude/skills/run-instruction-builder/driver.mjs`'s
  `PDF_EXPORT_PRODUCES_MULTIPLE_PAGES`, which imports an 18-step/
  4-tokens-per-step throwaway document) - didn't work with that document as
  it stood: maximally uniform (every step the same height, evenly spaced),
  so the corrupted token entries the bug introduced got absorbed into page
  1's packing slack without ever shifting a real page-break boundary. A
  same-day whole-codebase audit
  ([phase-3/reviews/2026-09-17-whole-codebase-audit-evaluation.md](./phase-3/reviews/2026-09-17-whole-codebase-audit-evaluation.md),
  candidate 3) traced the real blocker to the driver's single fixed 390px
  viewport, not document uniformity: at that width, mobile layout forces
  exactly one row per step regardless of token count, so even a
  varying-token-count test document would still produce uniform step
  heights.
- **How it was actually resolved:** a follow-up remediation grill on that
  same audit's item 6 concluded the real fix wasn't a better test around
  `readStepBounds()` - it was deleting that function. `pdf-export.ts` now
  takes its `canvasWidth`/`cardY`/`height` numbers directly from the
  `CanvasLayout` `computeCanvasLayout` already produces (threaded through
  from `app.tsx`'s `exportLayout`), rather than regex-parsing them back off
  the rendered SVG's `transform`/rect attributes. With no DOM read left to
  test, the "convention that DOM-touching export code is covered by the
  real-browser driver, not Vitest" objection this entry originally raised no
  longer applies to pagination specifically: it's now pure, DOM-free
  arithmetic. See
  [`pdf-pagination.test.ts`](../src/lib/pdf-pagination.test.ts)'s
  "paginateSteps against real computeCanvasLayout output (non-uniform
  document)" tests for the resulting regression coverage - built with a
  desktop-layout (6-chips-per-row) document specifically, since desktop
  wrapping (unlike mobile's forced single row) is what actually gives a
  varying-token-count document varying step heights to paginate against.
  This same remediation also fixed the *product* issue underneath the old
  bug's reach: exports and Preview now always render at a fixed desktop
  layout regardless of the exporting device's real viewport, instead of
  silently mirroring it.
- **First noted:** 2026-09-17.

## Persistence: an edit within ~200ms of closing/reloading the tab can be lost

- **What it is:** `state/persistence.ts` (task 12) debounces saves to
  IndexedDB by 200ms so a burst of keystrokes coalesces into one write. If
  the tab is reloaded or closed within that window, the pending write is
  lost - the page's JS realm is torn down before the debounce timer fires.
- **Why it's not fully fixed:** a `visibilitychange`/`pagehide` listener
  attempts to flush the pending save immediately, but this turned out not
  to reliably survive a same-tab `reload()` in Chromium either - the async
  IndexedDB write gets abandoned mid-flight once navigation commits, which
  is a browser limitation (`pagehide` guarantees synchronous cleanup can
  run, not that async work started there completes), not something fixable
  from page script. Found via an automated test that reordered a step and
  reloaded immediately with no pause - a real user closing a tab seconds
  (not milliseconds) after their last keystroke does not hit this.
- **Mitigation in place:** the debounce is kept short (200ms, down from an
  initial 500ms) specifically to shrink this window to something no
  realistic usage pattern hits, and the flush listeners still help for
  legitimate backgrounding (switching tabs, mobile app-switching), where
  the browser keeps the page process alive briefly rather than tearing it
  down instantly.
- **First noted:** 2026-09-13.

## Documentation debt from the 2026-09-18 codebase health review

- **What it is:** a whole-codebase review on 2026-09-18 (see
  [phase-3/audits/2026-09-18-architecture-review.html](./phase-3/audits/2026-09-18-architecture-review.html))
  produced 14 findings and re-graded every issue already tracked in this
  file. Six of those findings have since been fixed - the
  `CollapsedField` controlled-state write, the field popover's missing
  vertical flip, its `aria-modal`/Tab-trap contradiction, the driver
  knowing only two viewport widths, every export's same-task object-URL
  revoke (finding 9), and the confirm dialogs being modal in behaviour
  only (finding 7). The remaining eight exist only inside that one HTML
  file, in a report's prose rather than as tracked items anyone would find
  by reading this doc.
- **What the cleanup pass is:** fold the genuinely-deferred findings from
  that report into proper sections in this file, each with the same
  What it is / Why it's not fixed / Revisit when shape as everything else
  here, and drop the ones that turn out to be neither deferred nor real.
  Two documentation corrections the report identified belong in the same
  pass.
- **The `docs/adr/` half of this is done (2026-09-18).** The report's own
  recommendation to start recording declined decisions shipped ahead of the
  rest of this cleanup, as [adr/](./adr/README.md) with three entries:
  [0001](./adr/0001-keep-collapsedfield-dual-mode.md) keeps
  `CollapsedField`'s dual controlled/uncontrolled mode (previously recorded
  only as a comment at the guard in `CollapsedField.tsx`),
  [0002](./adr/0002-no-shared-no-op-guard.md) declines consolidating the
  three no-op guards in `state/document.ts` behind a shared abstraction -
  written specifically so a future architecture review stops re-suggesting
  it, since two successive reviews already have - and
  [0003](./adr/0003-no-component-test-environment.md) parks component-level
  unit testing (the report's finding 10) on the grounds that a simulated
  DOM is worst at exactly this app's hardest behaviour. Note that it does
  **not** rest on the Vite major upgrade above: an earlier draft claimed a
  DOM environment would force that upgrade, which is false - `vitest@2.1.9`
  and its already-accepted `@vitest/mocker` advisory are installed today,
  so adding `jsdom` changes this project's exposure not at all. The ADR
  records and corrects that error in place.
- **A correction to the report itself, recorded here because it exists
  nowhere else (2026-09-18).** Finding 5 ("the PDF export chunk ships
  ~230 kB of libraries the app never runs") **overstates the cost**, and
  the numbers should not be quoted from the report as they stand. jsPDF
  4.2.1 imports `html2canvas` and `dompurify` **dynamically**
  (`import("html2canvas")`), not statically as the report claims. Rollup
  emits them as separate chunks with an empty preload-deps array, so they
  sit on the CDN and are never requested. Driven against a real production
  build, an Export PDF click fetches exactly `jspdf.es.min` (391 kB),
  `svg2pdf.es.min` (87 kB) and `_commonjsHelpers` (0.24 kB) - **478 kB raw
  / ~155 kB gzipped**, not the report's 858 kB / 265 kB. `index.es`
  (151 kB) is not fetched either; the report counted it as downloaded. So
  the real cost is roughly 381 kB of dead chunks *deployed* that no user
  ever downloads - a deploy-size issue, not the mobile-data issue the
  report framed it as, which is why it was requeued as ordinary work
  rather than fixed before the tablet round. There is also a risk the
  report missed: aliasing `dompurify` to a stub module means that if jsPDF
  ever reaches for it on a path this app *does* use, it fails at runtime
  rather than at build time.
- **Why it's not fixed now:** deliberately scoped out of the
  field-placement change that fixed the first batch of those findings, to
  keep a placement fix from turning into a documentation pass. Deciding what is truly deferred versus merely
  unscheduled is its own judgement call, and better made once the tablet
  testing currently underway has had its say on several of the same items
  (the mobile layout order and the small-tokens-at-390px items in this
  file are both in that group).
- **Revisit when:** task 30's tablet round is finished and this change has
  been exercised on real devices.
- **First noted:** 2026-09-18.

## `inert` is the only thing containing focus in a confirm dialog, and it is not feature-detected

- **What it is:** since 2026-09-18 the confirm dialogs' modality rests
  entirely on one mechanism. `app.tsx` marks the background `inert` while a
  dialog is open, and the hand-written Tab cycle that used to keep focus
  between Cancel and Confirm was deleted in the same change (see
  [`lib/dialog-focus.ts`](../src/lib/dialog-focus.ts) for the argument: two
  mechanisms enforcing one rule is the shape that was just removed from
  `FieldPopover`, and the cycle only ever knew about two buttons). There is
  no fallback and no feature detection, so on a browser without `inert`
  `aria-modal="true"` becomes a promise nothing keeps.
- **Why it's not fixed:** the practical risk is low. `inert` is Baseline
  (Chrome 102 and Safari 15.5, both May 2022; Firefox 112, April 2023), and
  this app targets current European desktop and tablet browsers. Re-checking
  that support claim is part of revisiting this, not something to take from
  this entry on trust.
- **The part that is actually worth acting on is documentation, not code.**
  The 2026-09-18 review's finding 7 asked to add `aria-modal="true"` *and*
  set `inert` on the app root; it did not ask for the Tab trap to be
  removed, and its finding 8 records the opposite preference for the
  analogous `FieldPopover` case ("modal is the honest answer: set
  `aria-modal="true"` and keep the trap"). Deleting the trap was a
  deliberate, well-argued deviation from the written solution - but it is
  argued only in commit `b40d2d6`'s message, which is the one place a future
  reader will not look. This is exactly what [`adr/`](./adr/README.md) was
  created for in the same batch of work.
- **Revisit when:** the deviation is either recorded as ADR 0004 or
  reversed. That decision was deliberately left un-made rather than rushed
  in before the branch was pushed, because the commit message already argues
  one side of it well and it deserves to be argued against properly.
- **First noted:** 2026-09-18.

## `inert` is applied to four enumerated siblings rather than to one background subtree

- **What it is:** [`app.tsx`](../src/app.tsx) sets `inert={backgroundInert}`
  on four elements individually - `.app__toolbar`,
  `.app__persistence-warning`, `.app__toast` and `<main>`. `CONTEXT.md`'s
  "Confirm dialog" section promises "Everything outside it is `inert`"; the
  code implements "these four are". A fifth top-level sibling added later
  becomes a silent hole in the `aria-modal="true"` guarantee, and nothing
  fails to make that visible.
- **Why the driver only partly covers it:** the dedicated assertion
  (`backgroundInertWhileDialogOpen`) queries that same hard-coded list of
  four selectors, so it cannot notice a fifth. The Tab walk beside it would
  catch a fifth sibling only if it contains a focusable element reached
  within the six Tab presses - and not at all if the sibling is
  unfocusable-but-readable, which is precisely the case `aria-modal` exists
  to cover.
- **Why it's not fixed:** the structural fix is to wrap the non-dialog
  subtree and inert it in one place - the same "enforce it where it cannot
  be forgotten" move [ADR 0001](./adr/0001-keep-collapsedfield-dual-mode.md)
  chose for `CollapsedField`. That changes `app.tsx`'s top-level DOM
  structure and therefore the CSS that depends on it, which is more than a
  pre-push tidy-up: it deserves its own pass rather than being folded into a
  batch of mechanical fixes.
- **Revisit when:** a fifth top-level sibling is added for any reason, or
  the next architecture pass touches `app.tsx`'s layout - whichever comes
  first. Adding a sibling without inerting it is the failure mode.
- **First noted:** 2026-09-18.

## Confirm-dialog focus return has one path the driver never asserts

- **What it is:** [`lib/dialog-focus.ts`](../src/lib/dialog-focus.ts)
  records the opener by listening for `focusin` on the whole document while
  the dialog is closed, because marking the toolbar `inert` blurs the real
  opener before any effect can read `document.activeElement`. Both confirm
  dialogs are always mounted ([`app.tsx`](../src/app.tsx)), so each
  instance runs its own document-wide listener and both log every focus move
  in the page for the lifetime of the app - two listeners recording one
  global fact.
- **The residual risk is narrower than it first looks.** Import's only entry
  point is clicking the Import button, which re-records the correct opener,
  so the dialogs do not steal each other's. What is genuinely unasserted is
  that Chromium may focus the `visually-hidden` file input after the native
  file picker closes; that would make the input the last-focused element,
  and closing the dialog would then return focus to something invisible.
- **Why it's not fixed:** it is a plausible, unconfirmed browser behaviour
  rather than an observed bug, and the cheap first step is evidence, not a
  code change. The driver asserts
  `CONFIRM_DIALOG_RETURNS_FOCUS_TO_OPENER` for the New-document case only.
- **Revisit when:** the driver grows the same assertion for the Import path;
  if it turns out to be real, collapsing the two always-mounted listeners
  into one shared opener record is the natural fix for both halves at once.
- **First noted:** 2026-09-18.

## ADR 0002 does not meet the bar `docs/adr/README.md` sets for an ADR

- **What it is:** [`adr/README.md`](./adr/README.md) gates what earns an ADR
  on decisions that are hard to reverse, saying that otherwise a code
  comment is enough.
  [ADR 0002](./adr/0002-no-shared-no-op-guard.md) declines a one-line shared
  no-op guard - trivially reversible - and its reasoning now *also* lives as
  a comment on `setSteps`, which is the alternative the gate points to.
- **Why it's not fixed:** the ADR still does real work: two successive
  architecture reviews have suggested that consolidation, and 0002 exists
  specifically so a third stops re-suggesting it. "Costly to re-litigate
  repeatedly" is a defensible reading of the gate, it just is not what the
  gate says. The honest options are to widen the gate's wording or to drop
  0002 back to a comment, and picking between them is a judgement about what
  `adr/` is for - worth making deliberately, one week into the directory's
  existence rather than on day one.
- **Revisit when:** the next ADR is written, since that is when the gate
  gets read and applied again.
- **First noted:** 2026-09-18.
