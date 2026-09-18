# Phase 3 Code Reviews

> 🗄️ **Doc status: HISTORICAL — superseded.** Dated snapshots, not edited
> after they're written; see [../../milestones.md](../../milestones.md#documentation-status-conventions)
> for what CURRENT/HISTORICAL mean project-wide.

Dated code-review reports produced during Phase 3, mirroring
[phase-2/reviews/](../../phase-2/reviews/README.md)'s own folder. One file
per run (`YYYY-MM-DD-code-review.md`).

- [2026-09-17-code-review.md](./2026-09-17-code-review.md) was produced with
  the `mattpocock-skills:code-review` plugin skill, reviewing the
  uncommitted working-tree diff against `origin/main` that shipped the
  `CollapsedField`/structured-Quantity deepening plus several same-day task
  30 feedback passes. No hard Standards violations and no incorrect
  implementation found; its one real finding (a `known-issues.md` entry left
  describing the pre-`QuantityAttachment` data shape) was since resolved -
  see that file's "Resolved 2026-09-17" note.
- [2026-09-17-external-audit-evaluation.md](./2026-09-17-external-audit-evaluation.md)
  independently re-verified two documents from a source external to this
  project (archived as-received in [check/](./check/)) against the actual
  source rather than trusting their own claims of having done so. No
  incorrect claims found; produced a big/medium/small remediation plan and
  applied its two small, doc-only fixes directly (a `known-issues.md`
  clarity fix and a dev-server operational-guardrails note).
- [2026-09-17-whole-codebase-audit-evaluation.md](./2026-09-17-whole-codebase-audit-evaluation.md)
  did the same for a third external document (also archived in
  [check/](./check/)), a whole-codebase audit: all seven of its findings
  independently re-verified against source, one overclaim corrected and one
  finding found to be worse than reported, plus additional issues found
  during the evaluation itself. Produced the critical/high/medium/small
  remediation plan that commits `1862108` and `49ca8de` worked through.

Still accurate as a historical record of what each review found at the
time.
