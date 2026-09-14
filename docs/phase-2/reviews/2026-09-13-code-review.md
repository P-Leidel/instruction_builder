# Code Review — 2026-09-13

Produced with the `mattpocock-skills:code-review` plugin skill (two axes,
reviewed by independent parallel sub-agents that never see each other's
output: **Standards** - does the code follow this repo's conventions? -
and **Spec** - does it match what the project's own planning docs ask
for?). Findings from the two axes are reported separately below, per the
skill's own design, rather than merged or re-ranked against each other.

## Scope note

This repo's git history is unusual: its root commit (`8dea9e1`, "Initial
commit") already contained the entire application as one snapshot, so there
is no earlier point to diff against the normal way. Both sub-agents instead
reviewed the whole current codebase - `git diff` against git's fixed
empty-tree hash to `HEAD` (56 files, ~10,187 lines - effectively all of
`src/` and `docs/`), plus the uncommitted working-tree changes on top of
that (the `persistence.ts` schema-mismatch fix and this session's doc
updates - see [fixed-issues/README.md](../../fixed-issues/README.md) and
[known-issues.md](../../known-issues.md)). This is a full-codebase review, not
a PR-sized diff review.

There is no formal `CONTRIBUTING.md`/coding-standards doc and no issue
tracker in this repo, so each sub-agent was pointed at the closest
substitutes: the codebase's own consistent internal conventions plus a
fixed Fowler smell baseline for Standards, and
[project-plan.md](../../project-plan.md) /
[milestones.md](../../milestones.md) / [phase-1/architecture.md](../../phase-1/architecture.md)
for Spec.

## Previously flagged (cross-referenced against `known-issues.md`)

Three of the four Standards findings below substantially overlap with
design debt already logged in [known-issues.md](../../known-issues.md) from
the external architecture audit reviewed earlier this session
([2026-09-13-external-architecture-audit.html](../audits/2026-09-13-external-architecture-audit.html)):
the `TokenDropTarget`/`DropTarget` duplicate types and the twice-declared
`justDragged` flag are already tracked there ("Drag-and-drop protocol
duplicated across four modules"), and the `InstructionCanvas` layout/render
mixing is already the confirmed rationale behind folding candidate 3 into
Task 15 (see [planned-additions.md](../../planned-additions.md) item 2). They
are still listed below (this review found them independently, via a
different mechanism) but should not be read as new backlog - they're the
same items, already scheduled/deferred. The `y2` naming nitpick and the
Spec-axis validation-rule finding are genuinely new.

## Standards

**Convention violations — none found.** The codebase's core rules hold up
consistently: all shared state lives in signals under `src/state/*.ts` with
named mutator funnels (`setSteps` in `document.ts` is the single choke
point for every document mutation); rationale-only commenting (never
restating *what* code does) is upheld throughout.

**Baseline smells (judgement calls):**

1. **Duplicated Code** — [`src/lib/pointer-drag.ts:71-75`](../../../src/lib/pointer-drag.ts#L71-L75)
   (`TokenDropTarget`) and [`src/state/drag.ts:16-20`](../../../src/state/drag.ts#L16-L20)
   (`DropTarget`) are two separately declared interfaces with identical
   shape and near-identical doc comments. *(Already tracked — see above.)*
2. **Duplicated Code / Shotgun Surgery** — the `justDragged` module-level
   flag and its "swallow the compatibility click after a real drag" branch
   is copy-pasted verbatim in
   [`StepList.tsx:15,55-59`](../../../src/components/StepList/StepList.tsx#L15)
   and [`TokenPicker.tsx:22,67-71`](../../../src/components/TokenPicker/TokenPicker.tsx#L22).
   StepList's own comment acknowledges the duplication without extracting
   it. *(Already tracked — see above.)*
3. **Mysterious Name** (new, minor) —
   [`InstructionCanvas.tsx:489-504`](../../../src/components/InstructionCanvas/InstructionCanvas.tsx#L489-L504)
   names the pointer-move/drop y-coordinate parameter `y2` in `onMove`/
   `onDrop`, while the structurally identical callback in
   `TokenPicker.tsx`/`StepList.tsx` calls the same value `y`. Nothing in
   scope requires disambiguation here, so `y2` reads as an unexplained
   leftover rather than a deliberate choice.
4. **Divergent Change** (judgement call, not flagged strongly) —
   `InstructionCanvas.tsx` (591 lines) mixes pure layout/geometry math with
   rendering, badge components, and drag-event wiring in one file.
   Internally well-organized and well-commented, so this is a soft
   candidate for splitting rather than a clear violation. *(Already the
   confirmed rationale for folding the layout-lift into Task 15.)*

No eslint/tsc-catchable issues reported (out of scope for this axis).

## Spec

**(a) Gap in a task marked done, undocumented rather than wrong**

[`phase-1/architecture.md` §2.4](../../phase-1/architecture.md) specifies three
validation rules for Task 14, including *"A `quantity` token's `metadata`
should include a numeric amount when present (warn, don't block)."*
[`src/model/validate.ts`](../../../src/model/validate.ts) implements only the
other two. [milestones.md](../../milestones.md) marks Task 14 ✅ noting "the two
rules already covered by the Phase 1 stub turned out to be the full
applicable rule set," but doesn't state *why*: Quantity is no longer a
standalone token with a numeric `metadata.amount` field — it's a
`TokenAttachment` on another token with a pre-formatted, fused
`"${amount} ${unit}"` label (`TokenAttachmentPicker.tsx:29`), so there is no
longer a numeric field the rule could validate. The data model changed
underneath the rule without the Architecture doc or Milestones stating the
connection — a reader checking §2.4 against `validate.ts` would otherwise
conclude a rule was simply dropped. **Suggested fix:** a one-line note in
either doc tying Task 14's reduced rule set to the Quantity
attachment-model change. **Resolved 2026-09-13:** added directly to
[milestones.md](../../milestones.md)'s Task 14 row rather than to
`phase-1/architecture.md`, which is a frozen HISTORICAL doc per this
project's own conventions and isn't edited after its phase closes.

**(b) Unplanned but already disclosed**

Token/step time attachments, connector lines, the drag insertion marker,
two-stage selection, and the CSS refresh are scope additions beyond the
numbered task list — but `milestones.md` already lists these explicitly as
"product additions beyond the original task list." Not a new finding.

**(c) Everything else checked matched spec**

Verified against the Plan/Architecture docs with no mismatch: Task 4 CI
(`.github/workflows/ci.yml`) and strict TS config; Task 7 icon
licensing/local-bundling; Tasks 9/10 shared Pointer-Events drag; Task 12
Safari private-mode probe + banner; Task 13 bounded, coalescing undo/redo;
Tasks 18/19 JSON round-trip via `migrate()` with confirm-before-replace; and
the uncommitted `persistence.ts` fix, which correctly routes a
schema-mismatched IndexedDB load through the same `migrate()` the import
flow uses, matching Architecture §2.3's single-migration-path design.

## Summary

- **Standards:** 4 findings, all judgement-call-level smells, no hard
  convention violations. Worst: the `justDragged`/drag-type duplication
  (already tracked, scheduled as backlog cleanup).
- **Spec:** 1 finding, a documentation gap rather than a functional defect
  (Task 14's reduced rule set wasn't explained where a reader would look for
  it) - resolved the same day, in milestones.md.
- No correctness bugs, security issues, or scope mismatches were found
  beyond what this session's external-audit remediation already covered.
