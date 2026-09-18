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

## Mobile layout order buries the canvas below an empty Token details placeholder

- **What it is:** at the 390px mobile stacking order, `Token details` (an
  empty "Select a step, then click one of its tokens..." placeholder until
  a token is actually picked) and the entire instruction canvas sit between
  `Step details` and `Add to step`. A first-time mobile user scrolls past a
  placeholder with nothing in it before reaching the canvas that actually
  shows what they've built - the one view that's the whole point of the
  app.
- **Why it's not fixed now:** found during a 2026-09-14 pre-launch UI
  review (see
  [phase-3/progress/pre-launch-file-and-ui-audit.md](./phase-3/progress/pre-launch-file-and-ui-audit.md))
  alongside 6 other findings; the user asked for the smaller, purely
  visual/CSS items to ship immediately and this one - a mobile-only
  reorder - to be tracked instead, since it touches more of the stacking
  order than a small CSS tweak.
- **Related:** the canvas's token icon/label chips are also fairly small
  at 390px width - already flagged as a known area of active work in
  `.claude/skills/run-instruction-builder/SKILL.md`'s own troubleshooting
  table (`.instruction-canvas__svg`'s scale clamp). Worth revisiting
  together, since both are about the mobile canvas experience.
- **Revisit when:** task 31 (Refine UX) or a dedicated mobile-layout pass -
  reordering `.app__main`'s mobile (< 800px) stacking so canvas follows
  Steps, and collapsing `Token details` until a token is selected instead
  of reserving its slot unconditionally.
- **First noted:** 2026-09-14.

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
  file. Three of those findings have since been fixed - the
  `CollapsedField` controlled-state write, and the field popover's missing
  vertical flip and its `aria-modal`/Tab-trap contradiction. The remaining
  eleven exist only inside that one HTML file, in a report's prose rather
  than as tracked items anyone would find by reading this doc. Nothing
  below the three fixed ones has an entry here yet.
- **What the cleanup pass is:** fold the genuinely-deferred findings from
  that report into proper sections in this file, each with the same
  What it is / Why it's not fixed / Revisit when shape as everything else
  here, and drop the ones that turn out to be neither deferred nor real.
  Two documentation corrections the report identified belong in the same
  pass. Separately, start a `docs/adr/` directory with two entries: the
  decision to keep `CollapsedField`'s dual controlled/uncontrolled mode
  rather than deleting it (recorded for now only as a comment at the guard
  in `CollapsedField.tsx`), and the decision *not* to consolidate the
  three no-op guards in `state/document.ts` behind a shared abstraction -
  the latter specifically so a future architecture review stops
  re-suggesting it.
- **Why it's not fixed now:** deliberately scoped out of the change that
  fixed the three findings above, to keep a placement fix from turning
  into a documentation pass. Deciding what is truly deferred versus merely
  unscheduled is its own judgement call, and better made once the tablet
  testing currently underway has had its say on several of the same items
  (the mobile layout order and the small-tokens-at-390px items in this
  file are both in that group).
- **Revisit when:** task 30's tablet round is finished and this change has
  been exercised on real devices.
- **First noted:** 2026-09-18.
