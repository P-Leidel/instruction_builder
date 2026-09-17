# Code Review — 2026-09-17

Produced with the `mattpocock-skills:code-review` plugin skill (two axes,
reviewed by independent parallel sub-agents that never see each other's
output: **Standards** - does the code follow this repo's conventions? -
and **Spec** - does it match what the project's own planning docs ask
for?). Findings from the two axes are reported separately below, per the
skill's own design, rather than merged or re-ranked against each other.

## Scope note

Requested fixed point was "our main branch on github.com" (`origin/main`).
`HEAD` is currently identical to `origin/main` (`git log origin/main..HEAD`
is empty) - all of the actual work under review is **uncommitted
working-tree changes**, not new commits. The diff reviewed is
`git diff origin/main`, captured with the untracked new files
(`src/components/CollapsedField/`, `DurationForm.tsx`, `QuantityForm.tsx`,
`src/lib/quantity.ts`, plus a few new docs) included via a temporary
`git add -N` that was reset immediately after capturing the patch, so the
working tree's staged/unstaged state is unchanged from before this review.
~3,500 lines across 28 files (21 tracked modifications + 7 new files).

There is still no formal `CONTRIBUTING.md`/coding-standards doc and no
issue tracker in this repo. Standards was checked against the codebase's
own established conventions plus the fixed Fowler smell baseline. Spec was
checked against
[2026-09-17-canvas-tokenchip-and-field-shape-review.html](../audits/2026-09-17-canvas-tokenchip-and-field-shape-review.html)
(the architecture audit the user said this diff follows up on) and the
project's own writeup of what it intended to ship from that audit,
[architecture-2026-09-17-collapsedfield-and-structured-quantity.md](../progress/architecture-2026-09-17-collapsedfield-and-structured-quantity.md),
plus the small same-day
[task-30-user-feedback-fixes-4.md](../progress/task-30-user-feedback-fixes-4.md)
label-rename follow-up.

## Standards

**Documented-standard compliance:** No hard violations found. The repo has
no formal style guide, but the diff adheres to the conventions already
established in this codebase: all new mutations (`attachToToken`,
`setTokenTime`, `removeTokenAttachment`) still route through
`state/document.ts`'s existing funnel - no new module writes to
steps/tokens directly. Comments throughout the new code
(`CollapsedField.tsx`, `FieldPopover.tsx`, `SvgButton.tsx`, `quantity.ts`)
are consistently rationale-only (e.g. `FieldPopover`'s `preventScroll: true`
comment explains *why*, not *what*); none of the new comments just restate
their adjacent code. The architecture doc's stated intent (`CollapsedField`'s
~9-prop surface, no `onOpen` hook, `value?.unit` fallback) matches the
shipped code exactly - no intent/execution drift.

**Baseline smells (judgement calls):**

1. **Duplicated Code** - `DurationForm.tsx` and `QuantityForm.tsx` each
   hand-roll an almost identical Save/Cancel action block
   (`class="collapsed-field__save" disabled={...} aria-label={...}
   onClick={save}` / `class="collapsed-field__cancel" ...
   onClick={onCancel}`). `CollapsedField` already owns the Edit/Remove
   button markup for the collapsed state; the Save/Cancel pair could have
   been hoisted the same way (e.g. `CollapsedField` renders Save/Cancel
   around whatever `renderForm` returns, taking `onSave`/`canSave` instead).
   The architecture doc explicitly discusses factoring the *chrome* but
   stops short of the form's own action buttons, so this is a reasonable,
   deliberate line - flagging as worth reconsidering, not a defect.
2. **Speculative Generality** - `state/document.ts`'s
   `setTokenAttachment`/`attachToTokenCore` widened their parameter type to
   `TokenAttachment | QuantityAttachment` (~line 217, ~line 502). Since
   `QuantityAttachment` (`{ iconId, label: string, amount, unit }`)
   already structurally satisfies `TokenAttachment` (`{ iconId, label?:
   string }`), the plain `TokenAttachment` parameter type already accepted
   `QuantityAttachment` values under structural typing - the union adds no
   accepted call site, just signature noise. Minor, easy to leave as
   defensive documentation of intent, but worth a second look.
3. **Feature Envy** (minor) - `FieldPopover`'s mount effect directly reads
   `anchorRef.current.getBoundingClientRect()` and mutates
   `popover.style.left/right` for edge-overflow flipping. Reasonable for a
   small positioning component, but it's DOM-measurement logic that could
   be a pure helper (`clampToViewport(anchorRect, width)`) if a third
   consumer shows up - not worth acting on now given the single current use.

No Shotgun Surgery, Message Chains, or Repeated Switches observed; the
`SvgButton`/`CollapsedField` extractions are textbook fixes for the
duplication they targeted, and the CSS consolidation
(`.duration-field__*`/`.token-details__quantity-*` → `.collapsed-field__*`)
is clean with no orphaned rules.

## Spec

**(a) Missing/partial**

One real gap - [`docs/known-issues.md`](../../known-issues.md) is
explicitly in candidate 3's own scope line
(`src/components/TokenDetails/TokenDetails.tsx's QuantityRow ·
docs/known-issues.md`) but is untouched by the diff. It still asserts
(lines 116-129) that "a Quantity's amount and unit are still fused into
one display string at attach time... not as separate `amount`/`unit`
fields" and that `splitQuantity` "silently falls back to defaults" - both
now false: `QuantityAttachment` has structured `amount`/`unit` and
`splitQuantity` is deleted. The architecture doc doesn't promise this
update itself, but the audit it's implementing explicitly ties the
candidate to that file, and the doc now contradicts the shipped code.

**(b) Scope creep**

None inside the CollapsedField/Quantity work itself. Candidate 1
(`TokenChip`) is correctly absent from source - only referenced in doc
prose, no `TokenChip.tsx` exists; it was the audit's own "Top
recommendation" but was deliberately deferred, not silently dropped. The
diff also carries unrelated bundled work (SvgButton extraction,
document-title cap, `scrollbar-gutter`, task-30 fixes 1-3), but each is
covered by its own progress doc already present in the same diff, not
undocumented creep against the three spec docs checked here.

**(c) Implementation correctness**

Verified line-by-line against the architecture doc's "What shipped"
section - all matched: `CollapsedField<T>` at the promised path with
exactly the described ~9-prop surface (`label`, `showLabel`, `value`,
`renderValue`, `renderForm`, `onRemove`, `editing`/`onEditingChange`,
`ariaLabels: {add?, edit?, remove?}`), no `onOpen` hook, thin
`DurationForm`/`QuantityForm` adapters extracted verbatim,
`QuantityAttachment {iconId, label, amount, unit}` in
`model/instruction.ts`, `lib/quantity.ts` with
`MIN_QUANTITY`/`MAX_QUANTITY`/`buildQuantity` mirroring `duration.ts`'s
shape, `attachToToken`/`setTokenAttachment` widened to `TokenAttachment |
QuantityAttachment`, CSS consolidated into `.collapsed-field__*` with each
form keeping its own classes, and `driver.mjs`'s locator rewrites
(`.collapsed-field`, `.nth(0)`/`.nth(1)` scoping) exactly as described. The
`task-30-user-feedback-fixes-4.md` label rename (`label="Time"`) is present
at both call sites - `StepDetails.tsx:74` and `TokenDetails.tsx`
(`TimeAndQuantityRow`'s `DurationField`) - with the derived aria-labels
("Add/Edit/Save time") also updated. No wrong prop names, file locations,
or type-shape mismatches found.

## Summary

- **Standards:** 3 findings, all judgement-call-level smells, no hard
  convention violations. Worst: the `DurationForm`/`QuantityForm`
  Save/Cancel duplication that `CollapsedField` could have absorbed but
  deliberately didn't.
- **Spec:** 1 finding, a documentation gap rather than a functional
  defect - `known-issues.md`'s entry for the `splitQuantity` reverse-parse
  now describes a data shape that no longer exists in the codebase, even
  though the audit that authorized this change explicitly scoped that file
  in. No scope creep, no incorrect implementation.
- No correctness bugs or security issues found on either axis.
