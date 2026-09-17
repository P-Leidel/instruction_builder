# External Audit Evaluation — 2026-09-17

Evaluates two documents dropped into
[`docs/phase-3/reviews/check/`](./check/) from a source external to this
project: [`audit-evaluation-2026-09-17.md`](./check/audit-evaluation-2026-09-17.md)
and
[`project-plan-and-feedback-preparation-summary-2026-09-17.md`](./check/project-plan-and-feedback-preparation-summary-2026-09-17.md).
Both are themselves meta-reviews - they claim to have already checked prior
Phase 3 audits against source rather than trusting those audits' own
"resolved"/"deferred" labels. This review does the same thing one level up:
it does not take the check/ documents' claims on faith either, and
independently re-verifies the load-bearing ones against the actual working
tree (not the worktree paths the check/ documents cite, which don't exist in
this checkout).

## Scope note

Read-only verification pass plus two small documentation fixes (see
"Fixes applied" below); no other project source was changed. The check/
documents' own file links point at
`D:/websites/instruction_builder.worktrees/audit-evaluation-and-task-realignment/...`,
a worktree that isn't part of this repository - every claim below was
re-checked against this repo's actual `main`-branch working tree instead of
assumed correct from that path.

## Verification

No claim in either check/ document was found to be factually wrong. Each
load-bearing claim was checked directly:

- **`InstructionCanvas.tsx` is still monolithic (602 lines).** Confirmed.
  The token pointer-drag closure is still inlined at
  [`InstructionCanvas.tsx:451-497`](../../../src/components/InstructionCanvas/InstructionCanvas.tsx#L451-L497),
  and the full step-management block (reorder handle, move up/down, remove)
  at
  [`InstructionCanvas.tsx:365-432`](../../../src/components/InstructionCanvas/InstructionCanvas.tsx#L365-L432).
  The `SvgButton` extraction (`391a93c`) only pulled out keyboard-activation
  boilerplate, not behavior, so the check/ documents' "the canvas has not
  materially shrunk" is accurate, not overstated.
- **Structured quantity is genuinely done, not just documented as done.**
  Confirmed. `QuantityAttachment { iconId, label, amount, unit }` exists in
  [`model/instruction.ts`](../../../src/model/instruction.ts), `splitQuantity`
  is fully gone from source (it now survives only as a historical comment in
  that file), and
  [`QuantityForm.tsx:24-25`](../../../src/components/TokenDetails/QuantityForm.tsx#L24-L25)
  already has a defensive `value?.amount ?? 1` /
  `value?.unit ?? EU_FOOD_UNITS[0].value` fallback for a legacy import that
  only carries `label`. The check/ documents' recommendation to add a
  migration-compatibility test is valid, but the risk is lower than "should
  be considered complete, subject only to..." implies - the crash path is
  already guarded defensively in code; only the test is missing.
- **`migrate.ts` doesn't deep-validate `quantity`/`time`.** Confirmed at
  [`migrate.ts:52-55`](../../../src/model/migrate.ts#L52-L55), and by that
  file's own doc comment this is deliberate ("not enforcing a full schema"),
  not an oversight the check/ documents discovered.
- **Four structurally duplicated free-text mutators in `document.ts`.**
  Confirmed: `updateStepTitleCore`, `updateStepDescriptionCore`,
  `updateTokenLabelCore`, `updateTokenNoteCore` at
  [`document.ts:440-477`](../../../src/state/document.ts#L440-L477), each
  following the same `setSteps`/map/spread shape.
- **`StepDetails` keys two children independently (`DurationField` and the
  token disclosure) instead of one wrapper.** Confirmed at
  [`StepDetails.tsx:78-96`](../../../src/components/StepDetails/StepDetails.tsx#L78-L96),
  each `key={step.id}` use carrying its own comment explaining why.
- **`TokenPicker`'s tabs have `role="tab"`/`"tablist"` but no roving
  tabindex or arrow-key navigation.** Confirmed at
  [`TokenPicker.tsx:46-59`](../../../src/components/TokenPicker/TokenPicker.tsx#L46-L59) -
  plain buttons in normal tab order with ARIA tab roles added, Enter/Space
  only.
- **Vocabulary duplication, mobile layout order, keyboard token movement,
  the ~200ms persistence window, and the Vite/esbuild/vitest dev-only
  advisories** all match [`known-issues.md`](../../known-issues.md)
  verbatim. The check/ documents add no new facts here, only re-prioritization
  commentary (see below).

**Where this review pushes back on the check/ documents themselves:** they
are mostly a re-affirmation of this project's own `known-issues.md`,
presented as a fresh external review. The one genuinely new content is a
*sequencing* argument - pull a bounded `TokenChip`/`StepCard` extraction
into Task 30/31 rather than leaving it fully deferred, and promote mobile
layout order and keyboard token movement ahead of other Task 31 items. That
sequencing argument is sound and consistent with this project's existing
risk posture (small, behavior-preserving refactors are acceptable mid
user-feedback; broad rewrites aren't) - it is adopted below, not because the
check/ documents are authoritative, but because it independently checks out
against source.

## Remediation plan

### Big (multi-file, behavior-risk, needs its own test pass)

1. **Extract `TokenChip` and `StepCard` out of `InstructionCanvas.tsx`** -
   behavior-preserving only: same DOM data attributes, same callbacks, no
   layout rewrite. Do this as two separate passes (chip first, then step
   card), each verified against the existing Playwright driver before
   starting the next, per the check/ documents' recommended sequence.
2. **Keyboard token movement** (currently drag-and-drop only, tracked in
   [`known-issues.md`](../../known-issues.md#one-accessibility-gap-deliberately-left-for-a-later-pass)).
   Needs its own small interaction design (a "Move token" action/menu,
   moving within a step and to another step), not a mechanical refactor.

### Medium (bounded, single-area, but touches UX or accessibility)

3. **Mobile layout order** - reorder `.app__main`'s mobile stacking so the
   canvas follows Steps, and collapse/hide the empty Token Details
   placeholder until a token is selected. Tracked in
   [`known-issues.md`](../../known-issues.md#mobile-layout-order-buries-the-canvas-below-an-empty-token-details-placeholder).
4. **`TokenPicker` tab semantics** - either implement real roving-tabindex +
   arrow-key navigation, or drop `role="tab"`/`"tablist"` for plain buttons.
5. **Legacy quantity import regression test** - low code risk (the fallback
   already exists in `QuantityForm.tsx`), just needs a Vitest or Playwright
   case importing a pre-2026-09-17 document whose `quantity` is
   `{ iconId, label }` with no `amount`/`unit`.
6. **Persistence edge-case test** - add a "reload immediately after an edit"
   regression case and confirm the warning/recovery messaging reads clearly;
   no code change expected unless the test surfaces something new beyond
   what's already documented.

### Small (single file or doc, no interaction risk) - done in this pass

7. **`known-issues.md`'s structured-quantity entry re-clarified.** It
   previously narrated the old fused-string representation at length before
   its "Resolved 2026-09-17" note, which the check/ documents correctly flag
   as easy to misread as still-open. Split into two bullets - the still-open
   `TokenCategory` vocabulary duplication (deferred to Phase 4 task 32) and
   the now-resolved quantity representation, with the resolved status stated
   up front and the fused-string history moved into a collapsed `<details>`
   block for context rather than read-order-first.
8. **Dev-server operational guardrails documented.** Added a bullet to the
   `vite`/`esbuild`/`vitest` known issue: don't bind `npm run dev` to
   anything but localhost, and never run `vitest --ui` for this project -
   both directly address how the cited advisories are actually exploitable,
   without requiring the deferred major Vite upgrade.

### Explicitly deferred, not remediation debt right now

Collapsed-field Save/Cancel button dedup, free-text mutator consolidation,
token-vocabulary unification (Phase 4/Task 32), full canvas re-render
optimization, and "Untitled" default centralization. All independently
confirmed as correctly-deferred by source inspection - none are blocking
Task 30/31 or masking a live bug; forcing any of them now would trade
tester-feedback throughput for cleanup that isn't load-bearing yet.

## Summary

- **Big:** 2 items - canvas seam extraction, keyboard token movement.
- **Medium:** 4 items - mobile layout order, tab semantics, two regression
  tests (legacy quantity import, persistence reload edge case).
- **Small:** 2 items, both applied directly in this pass -
  `known-issues.md` clarity fix and dev-server guardrail documentation.
- No incorrect claims found in either check/ document; the main value-add
  identified was a sequencing recommendation (pull a bounded canvas-seam
  extraction and the two UX gaps forward into Task 30/31), which this review
  independently confirms is reasonable and folds into the plan above.
