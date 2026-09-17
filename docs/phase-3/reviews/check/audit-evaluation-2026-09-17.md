# External audit evaluation and milestone realignment

**Date:** 2026-09-17  
**Repository:** `P-Leidel/instruction_builder`  
**Scope:** Current worktree code, the two latest Phase 3 architecture audits, the 2026-09-17 code review, `docs/known-issues.md`, `docs/milestones.md`, and the related Phase 3 progress records.

No project files were changed while producing this report. This report is stored outside the project workspace.

## Executive assessment

The project is broadly on track for its stated Phase 3 goal: a recipe-focused MVP is live, the core editing model is coherent, exports and persistence exist, and the current work is being driven by real-user feedback rather than by speculative generalization.

The latest audits are substantially accurate. Their strongest criticism is valid: `InstructionCanvas.tsx` has become the highest-churn, highest-risk interaction surface and still contains two meaningful inline modules:

- step-card management and step reordering;
- token-chip rendering plus token selection/drag outcome handling.

The recommendation to extract `StepCard` and `TokenChip` is not merely aesthetic. It would create testable seams around the most interaction-sensitive code and reduce the cost of accepting manual-tester feedback. However, it should be done as a bounded refactor, not as a broad canvas redesign during the current feedback window.

The project should **not** pull Phase 4 generalization forward. The current domain-specific vocabulary is a real architectural limitation, but it is not blocking recipe validation. Pulling content-pack abstraction forward now would increase surface area while testers are still exposing basic UX and interaction issues.

The agenda should change in one important way: reserve a short, explicit “feedback-safe architecture hardening” slice inside Task 30/31 for the canvas seams and a small number of accessibility and mobile fixes. Do not spend that slice on speculative performance work, radial layout, per-connection metadata, or a generalized field framework.

## Evidence and reliability notes

The documents are useful but not authoritative. I checked claims against the current source rather than accepting their “resolved” or “deferred” labels.

The current worktree has no installed `node_modules`; `npm test`, `npm run lint`, and `npm run typecheck` could not run because `vitest`, `eslint`, and `tsc` were unavailable. Dependency installation was not authorized, so this report distinguishes source verification from executable validation.

The repository history shows the latest audit work is in the current revision (`f4efaeb`), with the preceding feedback and architecture commits immediately before it. The worktree status was checked before reporting; no report file was placed in the project.

## Findings from the latest audits

### 1. `TokenChip` and `StepCard` extraction — confirmed, highest priority

The latest audits identify this as the strongest recommendation. The source confirms the reasoning:

- [InstructionCanvas.tsx](D:/websites/instruction_builder.worktrees/audit-evaluation-and-task-realignment/src/components/InstructionCanvas/InstructionCanvas.tsx) still owns SVG rendering, step controls, token rendering, pointer-drag setup, drop-target updates, selection decisions, and mutation dispatch.
- The token pointer handler still closes over step/token selection state and directly calls `beginPointerDrag`, `resolveTokenDropTarget`, `resolveTokenPointerOutcome`, `selectStep`, `selectToken`, and `moveToken`.
- The step-management block still owns the reorder drag handle, move-up/down controls, remove control, incomplete flag, and associated geometry.
- The `SvgButton` extraction reduced duplicated keyboard activation, but it did not create a seam around the step or token behavior. This is why the audit correctly says the canvas has not materially shrunk.

**Criticism of the audit:** “Overdue” is somewhat stronger than the evidence warrants. The code is not currently shown to be functionally broken because of the monolithic component, and the existing pure geometry module already removed one major architectural risk. The case for extraction is therefore maintainability and testability, not an urgent production bug.

**Recommendation:** move this ahead of unrelated architecture cleanup, but implement it as:

1. `TokenChip` owns markup, badges, selection affordance, and token pointer outcome wiring.
2. `StepCard` owns step chrome and step-management controls.
3. `InstructionCanvas` remains responsible for layout calculation, SVG grouping, shared drag state, and mutation callbacks.
4. Preserve the existing DOM data attributes and callback behavior.
5. Add focused pure tests for the token outcome-to-callback mapping; retain Playwright coverage for actual pointer behavior.

Do not combine this with an incremental layout rewrite or a renderer abstraction.

### 2. Collapsed-field unification — mostly resolved, not a current priority

The same-day code review correctly confirms that `CollapsedField`, `DurationForm`, `QuantityForm`, and the structured quantity model shipped as intended. The current code has a real shared `CollapsedField` seam, and `TimeAndQuantityRow` provides a legitimate controlled editing contract.

The remaining duplicated Save/Cancel markup in `DurationForm.tsx` and `QuantityForm.tsx` is a code smell, but not a defect. Moving those buttons into `CollapsedField` would couple a generic field shell to form-specific validation and save semantics. The audit is right to label this “worth reconsidering,” not required.

**Recommendation:** defer further field abstraction until a third field type appears or manual testing finds inconsistent field behavior. Do not generalize merely to remove two short button blocks.

### 3. Structured quantity — code resolved; documentation status is stale or confusing

The audit’s proposed fix is present in the current code:

- [instruction.ts](D:/websites/instruction_builder.worktrees/audit-evaluation-and-task-realignment/src/model/instruction.ts) defines `QuantityAttachment` with `amount` and `unit`.
- [quantity.ts](D:/websites/instruction_builder.worktrees/audit-evaluation-and-task-realignment/src/lib/quantity.ts) builds and validates the structured value.
- [QuantityForm.tsx](D:/websites/instruction_builder.worktrees/audit-evaluation-and-task-realignment/src/components/TokenDetails/QuantityForm.tsx) edits the structured fields directly.
- No `splitQuantity` implementation remains.

The historical paragraph in [known-issues.md](D:/websites/instruction_builder.worktrees/audit-evaluation-and-task-realignment/docs/known-issues.md) does eventually say “Resolved 2026-09-17,” but it first describes the old fused representation at length. That is understandable as history, but it is easy for a planner or tester to read it as an open issue. The report recommendation is to reclassify this as a fixed issue or shorten the active issue entry; this report does not edit it.

The fix itself should be considered complete, subject only to migration compatibility testing for imported documents containing legacy quantity labels. The current migration validation is intentionally shallow, so legacy quantity shape deserves a targeted test before Phase 3 is closed.

**2026-09-17 correction (later the same day, post-remediation):** the exposure this section describes is broader than "imported documents." `git log`/`git show` confirmed the live production deploy (`580d5e6`) saved `quantity` as this label-only shape for about 2 days 16 hours before the structured-quantity fix (`9ab8e64`) shipped, without `CURRENT_SCHEMA_VERSION` ever bumping - so any document autosaved during that window and loaded normally (not imported) carried this shape too, sitting in real users' IndexedDB. `migrate()` has since been given a real repair step (`repairLegacyQuantity`, `src/model/migrate.ts`) that recovers `amount`/`unit` from the label on load or import, rather than leaving it as a documentation-only gap - see [`2026-09-17-whole-codebase-audit-evaluation.md`](../2026-09-17-whole-codebase-audit-evaluation.md) finding 6 for the full trace. (That document cites this correction as "item 5" of this report; at the time it was written this was item 3 under "Findings from the latest audits" - noted here in case the numbering is ever a point of confusion.)

### 4. Free-text mutator consolidation — accurate but low leverage

The four functions in [document.ts](D:/websites/instruction_builder.worktrees/audit-evaluation-and-task-realignment/src/state/document.ts) are structurally repetitive and all pass the same coalescing option. The audit accurately identifies duplication.

However, a generic field updater would trade visible repetition for a dynamic field selector or callback API. That can weaken type safety and make invalid updates easier to express. The current explicit functions are clear and safe.

**Recommendation:** defer. If changed later, use typed field-specific helpers rather than a stringly-typed `field` parameter. This is not appropriate to prioritize while testers are exercising editing behavior.

### 5. `StepDetails` reset seam — accurate observation, low urgency

The current [StepDetails.tsx](D:/websites/instruction_builder.worktrees/audit-evaluation-and-task-realignment/src/components/StepDetails/StepDetails.tsx) keys `DurationField` and the token disclosure independently. The duplicated comments explain two distinct stateful children and the keys are behaviorally meaningful.

The audit’s proposed single wrapper key is conceptually tidy, but it is not automatically safer: changing the wrapper identity can reset more local state than intended, and the current two keys document the two state boundaries explicitly.

**Recommendation:** do not move this ahead of tester-facing work. Keep the current behavior unless a manual test demonstrates state leakage. If revisited, add a regression test first and use a keyed wrapper only if the desired reset scope is explicitly confirmed.

### 6. “Untitled” default centralization — speculative, correctly deferred

The default title and “Untitled step” display are repeated in a few places. This is harmless today and does not justify a shared constants module. A future localization or domain-label system could make centralization useful, but that is not a current milestone risk.

## Deferred known issues: independent verification

### Dev-tool vulnerabilities — deferral is reasonable, but the rationale needs operational guardrails

The [known issue](D:/websites/instruction_builder.worktrees/audit-evaluation-and-task-realignment/docs/known-issues.md) correctly limits the cited Vite/esbuild/Vitest risks to development tooling and Vitest UI/server scenarios rather than the static production bundle.

The deferral is reasonable while the app is being manually tested, but “dev-only” does not mean “irrelevant.” The risk is material when the dev server is exposed to an untrusted network or when a developer browses untrusted content while the server is running.

**Recommendation:**

- keep the major Vite upgrade deferred;
- document that the dev server must bind to localhost and not be exposed on a shared network;
- never run `vitest --ui` for this project;
- schedule the Vite/Vitest upgrade at the next deliberate tooling maintenance point, not as an emergency Phase 3 interruption.

Do not spend manual-testing downtime on a major toolchain migration.

### Token/attachment vocabulary duplication — real, but correctly a Phase 4 concern

The current code still has separate vocabulary representations:

- `TokenCategory` in the model;
- `TOKEN_CATEGORIES` in migration;
- `STEP_TOKEN_CATEGORIES` in `TokenPicker`;
- a separate `AttachmentKind` type in state.

The known issue is accurate. The fact that quantities and warnings are now structured does not solve domain vocabulary duplication.

The stated Phase 4 rationale is sound: this is tied to content-pack shape and domain generalization. Pulling it into Phase 3 would be premature unless a second domain is actually being prototyped.

**Recommendation:** keep deferred, but make Task 32 start with a vocabulary ownership decision and compile-time/data-driven tests. Avoid a quick “single array” patch now that could hard-code Phase 4’s eventual design incorrectly.

### Keyboard token movement — should move ahead of broad UX polish

The current app has keyboard paths for token selection through Step Details, but token movement remains drag-only. This is a genuine functional accessibility gap, not merely an APG convention issue.

The known-issues rationale is fair: moving to a specific step/index needs a small interaction design. Nonetheless, this is more important than the tab arrow-key behavior because it blocks an editing operation for keyboard users.

**Recommendation:** add a focused Phase 3/Task 31 item:

- provide a keyboard-visible “Move token” action or menu;
- support moving within the current step and to another step;
- preserve token order and selection;
- announce completion through existing status/toast infrastructure;
- test with keyboard-only interaction.

Do not attempt to make drag-and-drop itself keyboard-emulated; provide a deliberate command path.

### TokenPicker tab roving focus — valid but lower priority

The current [TokenPicker.tsx](D:/websites/instruction_builder.worktrees/audit-evaluation-and-task-realignment/src/components/TokenPicker/TokenPicker.tsx) uses `role="tab"` and `role="tablist"` but leaves every tab in normal tab order. The known issue is accurate: Enter/Space works, but Left/Right arrow navigation and roving `tabindex` are absent.

This should be fixed if the project continues to advertise the APG tab semantics. The alternative is to use ordinary buttons and remove the tab roles. Either is better than a partially implemented tab pattern.

**Recommendation:** pair this with the keyboard token-movement work only if the accessibility pass has capacity. Otherwise, prefer the simpler alternative of changing the controls to ordinary buttons if the tab-panel semantics do not provide meaningful screen-reader value.

### Full canvas re-render — deferral is technically justified

The current canvas reads the document steps as a whole and computes layout globally. The known-issue reasoning is accurate: a naive per-step component split would not prevent downstream steps from receiving new positions, and a true fix requires incremental layout or stable prefix geometry.

At the stated scale (“a handful of steps and tokens”), this is not a user-facing performance priority. It becomes relevant if manual testers build large documents, but that should be measured rather than assumed.

**Recommendation:** keep deferred. Add a lightweight performance probe during manual testing: record interaction latency with a deliberately large document. Only redesign layout if the probe shows a problem or if a future second layout requires the same infrastructure.

### Mobile layout order — should move into Task 31, not remain indefinite

The current issue is user-facing and directly affects first-use comprehension: on mobile, an empty Token Details placeholder appears before the canvas. The reason for deferral (“larger than a small CSS fix”) is valid, but it is exactly the sort of issue the UX refinement milestone exists to address.

**Recommendation:** move this ahead of speculative architecture work in Task 31. Test two alternatives:

1. mobile order: Steps → Canvas → Token Details → Add to step;
2. conditionally collapse or remove the empty Token Details slot until a token is selected.

The second option may be less disruptive but needs careful layout testing when a token becomes selected. Pair this with the small-chip legibility concern at 390px.

### Persistence loss within ~200 ms — accepted boundary, but test messaging and recovery

The issue is a real consequence of debounced IndexedDB writes and browser lifecycle behavior. The current 200 ms window is small, and the visibility/pagehide flush is still useful for backgrounding, so the document’s rationale is credible.

It should not be described as fully solved. It is a data-loss edge case, even if uncommon.

**Recommendation:** keep the debounce, but add a manual-test case for immediate reload after an edit and ensure the persistence warning/recovery path is understandable. If the product later needs stronger guarantees, consider writing critical edits immediately and coalescing only high-frequency text input, rather than trying to make asynchronous pagehide writes reliable.

## Milestone realignment

### Keep the current phase structure

[Milestones](D:/websites/instruction_builder.worktrees/audit-evaluation-and-task-realignment/docs/milestones.md) correctly place the project in Phase 3, with Task 30 in progress and Task 31 not started. Phase 4 should remain not started.

### Recommended order for the remaining work

#### During the current manual-testing window (Task 30)

1. Continue collecting tester feedback without changing interaction semantics unnecessarily.
2. Fix clear correctness, data-loss, accessibility, and mobile discoverability issues that testers reproduce.
3. Extract `TokenChip` and `StepCard` only as a behavior-preserving refactor, preferably after the next feedback batch is recorded.
4. Add targeted tests around any newly fixed behavior, especially structured quantity import compatibility and selection/drag outcomes.

#### Task 31: Refine UX

Prioritize:

1. mobile stacking order and 390px canvas legibility;
2. keyboard token movement;
3. either a correct APG tab implementation or ordinary-button semantics;
4. immediate-reload persistence messaging/coverage;
5. only then small visual polish and low-risk component cleanup.

Do not make Task 31 a general architecture sprint.

#### Before declaring Phase 3 complete

- run the full available typecheck, lint, unit, and browser-driver suites in an environment with dependencies installed;
- perform a manual keyboard pass after any movement/tab changes;
- test mobile at 390px and a wider phone width;
- test import of legacy quantity data and export after editing a structured quantity;
- measure large-document interaction before considering canvas performance work;
- verify the production deployment after the final tester-driven changes.

#### Phase 4 / Task 32

Start with a design decision for content-pack ownership:

- categories and attachment kinds;
- sample tokens and labels;
- units and validation;
- icon availability;
- domain-specific UI affordances.

Then replace duplicated arrays through that design, rather than preemptively exporting constants from the current recipe-specific model.

## Alternative strategies considered

### Alternative A: implement every audit recommendation now

Rejected. This would mix component extraction, state mutator abstraction, field-shell generalization, vocabulary redesign, and layout optimization. It would make manual-test results harder to attribute and increase regression risk at the exact point where real user input is most valuable.

### Alternative B: freeze architecture until all user testing ends

Also rejected. The canvas is the main interaction hotspot, and a small behavior-preserving `TokenChip`/`StepCard` extraction is likely to make tester-driven fixes safer. Waiting indefinitely lets more behavior accumulate inside the same component.

### Alternative C: prioritize only visible UX defects

Insufficient. Mobile ordering and keyboard movement are important, but the canvas seam has unusually high leverage for implementing and testing the next wave of feedback. The right approach is a narrow architecture slice plus tester-visible fixes, not an architecture freeze.

## Final decision summary

| Area | Audit/issue judgment | Recommended timing |
|---|---|---|
| `TokenChip`/`StepCard` extraction | Confirmed, high leverage, not an emergency bug fix | Small behavior-preserving slice during Task 30/early Task 31 |
| Structured quantity | Already resolved in code; documentation should be clarified | Treat as closed; add legacy-import regression coverage |
| Collapsed field further abstraction | Valid smell, low risk, low leverage | Defer |
| Free-text mutator consolidation | Accurate duplication finding, type-safety tradeoff | Defer |
| StepDetails single reset seam | Plausible cleanup, behavior risk if changed casually | Defer unless leakage reproduced |
| Token vocabulary duplication | Real architectural debt | Phase 4 Task 32 |
| Keyboard token movement | Real accessibility/product gap | Move into Task 31 |
| TokenPicker tab semantics | Accurate lower-impact gap | Task 31 if capacity, otherwise simplify semantics |
| Full canvas re-render | Accurate but scale-dependent | Defer; measure first |
| Mobile order and canvas legibility | Real first-use UX problem | Move into Task 31 |
| Persistence lifecycle edge | Real but narrow browser limitation | Keep mitigation; test and communicate |
| Vite/Vitest advisories | Real dev-tool risk, not production bundle risk | Defer major upgrade; add operational guardrails |

## Bottom line

The project does not need a major agenda reset. It needs a sharper boundary between:

- **feedback-enabling work now:** mobile discoverability, keyboard movement, persistence edge coverage, and a bounded canvas decomposition;
- **feedback-driven fixes:** whatever manual testers reproduce;
- **Phase 4 design work:** content-pack vocabulary and domain generalization;
- **measured future optimization:** incremental canvas layout and performance.

That sequencing preserves momentum, reduces regression risk, and makes the codebase better prepared to absorb a large volume of tester input without prematurely turning the MVP into a generalized framework.
