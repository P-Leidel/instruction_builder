# Project plan and feedback preparation summary

**Date:** 2026-09-17  
**Repository:** `P-Leidel/instruction_builder`  
**Related report:** [External audit evaluation and milestone realignment](./audit-evaluation-2026-09-17.md)

No project files were changed while producing this summary. This document is stored outside the project workspace.

## Executive summary

The project plan is correctly sequenced: prove the recipe editor first, gather real usage feedback, stabilize the interaction model, and only then generalize it into a reusable instruction-builder skeleton.

The main planning gap is not the milestone order. It is that several future boundaries remain underspecified:

- what a content pack owns;
- what belongs to the generic instruction engine;
- how feedback becomes implementation work;
- when a recipe-specific request should become a generic capability;
- how schema and pack compatibility will work.

The current codebase can handle quick UI/UX changes, especially in panels and CSS. Canvas interaction changes are riskier because [InstructionCanvas.tsx](D:/websites/instruction_builder.worktrees/audit-evaluation-and-task-realignment/src/components/InstructionCanvas/InstructionCanvas.tsx) still concentrates rendering, selection, drag/drop, step management, and mutation dispatch.

The recommended approach is not to generalize immediately. Keep the model stable, classify feedback consistently, make small behavior-preserving refactors, and record repeated cross-domain needs. Define the content-pack contract only after recipe usage and a small second-domain prototype reveal the actual requirements.

## What remains fuzzy in the project plan

### 1. Content-pack scope

Task 32 says it will formalize a content-pack shape, but the plan does not say whether packs provide only data or also behavior and UI configuration.

Potential pack-owned concerns include:

- token categories and ordering;
- labels and vocabulary;
- icons;
- units and presets;
- warning types;
- attachment availability;
- default document metadata;
- validation rules;
- export wording;
- domain-specific help text.

The safest initial definition is a **data-oriented pack**. It should not provide arbitrary UI components or interaction logic until a real second domain proves that this is necessary.

### 2. Generic model versus domain semantics

The current model is structurally generic, but the UI still assumes recipe-shaped semantics:

- action/object/tool are the main step-token categories;
- quantity and warning behave as attachments;
- time has special behavior on both steps and tokens;
- validation and picker behavior are recipe-oriented;
- `meta.domain` is currently just a string, not a pack registry.

The plan should distinguish between:

> A model that can represent multiple domains

and:

> A complete multi-domain product.

The project currently has the former, intentionally. Phase 4 is meant to establish the latter.

### 3. Isolation claims are ahead of implementation

The plan describes icons, sample tokens, and units as swappable modules. That is directionally true, but category and attachment vocabulary is still distributed across the model, migration, state, and UI.

This is acceptable in Phase 3. It means Task 32 should begin with a dependency map and ownership decision, not simply extract constants into a new file.

### 4. Feedback workflow is underspecified

Tasks 30 and 31 do not define:

- what qualifies as a bug;
- how conflicting tester feedback is resolved;
- which changes are immediate;
- when a request is out of scope;
- when a UI request becomes a model/schema change;
- how feedback is linked to regression tests.

Without a classification process, Task 30 can become an unbounded stream of ad hoc changes.

## Feedback handling model

Every tester report should be assigned one category:

| Feedback type | Recommended action |
|---|---|
| Correctness bug | Fix immediately if reproducible |
| Data-loss or persistence issue | Highest priority |
| Accessibility barrier | Prioritize ahead of visual polish |
| Mobile/layout issue | Task 31 unless severe |
| Interaction confusion | Confirm with multiple testers, then fix |
| Domain-specific request | Record as content-pack input |
| New feature request | Defer unless it supports the core workflow |
| Architecture smell | Fix now only if it reduces feedback implementation risk |

Each item should record:

- reproduction steps;
- affected viewport and input method;
- expected versus actual behavior;
- whether existing documents are affected;
- whether the document model changes;
- whether migration is required;
- expected regression-test coverage.

## Can the codebase handle quick UI/UX changes?

### Yes, for bounded changes

The current structure supports fast iteration because:

- Preact components are direct and relatively small outside the canvas;
- CSS is centralized in [global.css](D:/websites/instruction_builder.worktrees/audit-evaluation-and-task-realignment/src/styles/global.css);
- state mutations are funneled through [document.ts](D:/websites/instruction_builder.worktrees/audit-evaluation-and-task-realignment/src/state/document.ts);
- geometry is separated into [canvas-layout.ts](D:/websites/instruction_builder.worktrees/audit-evaluation-and-task-realignment/src/lib/canvas-layout.ts);
- model/state/pure-library tests exist;
- the Playwright driver covers important end-to-end flows;
- most layout and wording changes do not require schema changes.

### Main risk areas

#### Canvas concentration

`InstructionCanvas.tsx` still combines:

- SVG rendering;
- step controls;
- token rendering;
- selection behavior;
- drag/drop behavior;
- accessibility attributes;
- layout consumption;
- mutation dispatch.

The latest audit’s `TokenChip` and `StepCard` recommendation is valuable mainly because it makes future tester-driven changes safer and more testable.

#### Distributed vocabulary

Changing categories, attachments, or domain behavior requires checking multiple files. This is manageable for recipe feedback but becomes risky when introducing a second domain.

#### Model changes are deliberately more expensive

Adding a semantic field requires coordinated review of:

- the model;
- state actions;
- migration and validation;
- import/export;
- undo/redo;
- tests;
- UI.

That is a feature, not a flaw: model changes should be slower and more deliberate than CSS changes.

#### Persistence and migration are still shallow

The schema version exists, but nested attachment compatibility is not deeply migrated or validated. Additive changes are currently manageable; cross-domain compatibility will require stronger migration tests before Phase 4 is complete.

## Preparation strategy

### 1. Separate UI changes from model changes

#### Feedback-safe UI changes

Examples:

- spacing;
- labels;
- empty states;
- panel ordering;
- mobile stacking;
- focus behavior;
- visual emphasis.

These should normally avoid changing the document model.

#### Semantic/model changes

Examples:

- new attachment types;
- new ordering semantics;
- changing what a quantity means;
- branching;
- changing export interpretation;
- moving a field between step and token scope.

These require schema impact analysis, migration decisions, state actions, tests, and import/export review.

### 2. Define a feedback-safe refactor boundary

During Task 30 and early Task 31, allow refactors that preserve:

- event semantics;
- existing data attributes;
- document shape;
- export output;
- keyboard behavior;
- mobile behavior.

The `TokenChip` and `StepCard` extractions fit this boundary if they remain behavior-preserving. Do not combine them with a layout rewrite, new drag protocol, content-pack work, or generalized field abstraction.

### 3. Extract canvas seams before more canvas feedback accumulates

Recommended sequence:

1. Extract `TokenChip`.
2. Preserve current callbacks and DOM data attributes.
3. Add focused tests for token selection/drag outcome mapping.
4. Extract `StepCard`.
5. Preserve existing SVG structure and step controls.
6. Apply larger canvas feedback after the seams exist.

The goal is not architectural perfection. It is reducing the regression cost of the next several tester-driven changes.

### 4. Use a regression matrix

For each tester-facing change, check:

#### Input methods

- mouse;
- touch/pointer;
- keyboard.

#### Viewports

- 390px mobile;
- normal desktop;
- wide desktop.

#### Application states

- empty document;
- one step;
- multiple steps;
- selected step;
- selected token;
- read-only preview/export canvas.

#### Data lifecycle

- new document;
- persisted document;
- imported document;
- undo/redo;
- export after editing.

### 5. Record generalization pressure

Do not generalize every tester request. Record whether a request indicates:

- a generic core capability;
- a recipe-only feature;
- a content-pack setting;
- a theme concern;
- a missing interaction primitive;
- a one-off preference.

Move a feature into the generic layer only when:

1. two domains need it;
2. multiple independent testers request the same capability;
3. the recipe implementation becomes awkward because the concept is domain-neutral; or
4. a second-domain prototype cannot be built without it.

## Recommended architecture for the skeleton goal

### Core instruction engine

Should eventually own:

- document schema;
- steps and token ordering;
- generic state transitions;
- undo/redo;
- persistence;
- schema migration;
- generic validation;
- export-independent semantics.

### Content pack

Should eventually own:

- domain ID and display name;
- token categories and ordering;
- token vocabulary;
- icon mapping;
- attachment availability;
- units and presets;
- default document metadata;
- domain-specific validation rules;
- optional labels and instructional hints.

### Product shell

Should own:

- canvas rendering;
- panel layout;
- drag/drop mechanics;
- responsive behavior;
- accessibility interaction patterns;
- export UI;
- dialogs and status feedback.

### Theme layer

Should remain separate from content packs. A furniture pack should not need to know whether the product uses light mode, dark mode, or high contrast.

## What Task 32 should explicitly decide

Before implementation, Task 32 should document decisions about:

1. Pack loading: statically bundled, dynamically loaded, or user-imported.
2. Pack API: plain data object, factory, or registry.
3. Category model: arbitrary IDs, fixed semantic categories, or capability-based categories.
4. Attachment model: whether time, quantity, materials, size, voltage, and safety attributes are core or pack-defined.
5. Validation: generic rules versus pack-provided rules.
6. Export: which labels and wording are generic versus pack-owned.
7. Schema compatibility: how documents identify packs and behave when a pack is unavailable.
8. UI customization: data and labels first; arbitrary pack-provided components only if proven necessary.

## Recommended agenda

### During Task 30

1. Continue collecting reproducible feedback.
2. Fix correctness, data-loss, accessibility, and mobile discoverability issues.
3. Record repeated cross-domain needs.
4. Permit only small behavior-preserving refactors.
5. Extract canvas seams if doing so does not obscure current feedback results.

### Task 31

Prioritize:

1. mobile canvas ordering and 390px legibility;
2. keyboard token movement;
3. correct tab semantics or ordinary-button semantics;
4. persistence edge-case coverage and messaging;
5. `TokenChip` and `StepCard` extraction if not already completed;
6. visual polish after interaction issues are stable.

Task 31 should not become a general architecture sprint.

### Before Phase 4

- inventory recipe-specific assumptions;
- review repeated tester requests;
- prototype the second domain at a small scale;
- define the content-pack contract;
- decide what must be schema-versioned;
- run full validation in an environment with dependencies installed.

### Phase 4

Use the second domain as an architectural test:

1. extract a pack interface;
2. move recipe content behind it;
3. build a small furniture or assembly pack;
4. identify remaining recipe leaks;
5. fix only proven leaks;
6. add domain switching afterward.

## Final decision summary

| Question | Answer |
|---|---|
| Is the milestone order wrong? | No; recipe-first remains the right strategy |
| Can the codebase handle quick UI/UX changes? | Yes, especially panel/CSS changes; canvas changes need more care |
| Should generalization start now? | No; record generalization pressure instead |
| What refactor has the best immediate leverage? | Behavior-preserving `TokenChip` and `StepCard` extraction |
| What should move ahead of broad polish? | Mobile discoverability and keyboard token movement |
| What is the largest planning gap? | The exact boundary and API of a content pack |
| When should the generic architecture be proven? | With a small second-domain prototype in Phase 4 |

## Bottom line

The project does not need a major agenda reset. It needs sharper boundaries and a disciplined feedback workflow.

The safest preparation is:

1. keep the document model stable;
2. classify tester feedback;
3. separate UI changes from semantic changes;
4. extract the canvas interaction seams;
5. record repeated cross-domain needs;
6. define content packs from evidence;
7. prove the design with a small second domain before adding switching and theming.

That preserves rapid iteration now while protecting the original goal: a reusable skeleton for recipe, furniture, repair, safety, and other visual instruction builders.
