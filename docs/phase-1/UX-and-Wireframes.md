# Phase 1 UX Flow and Wireframes

> 🗄️ **Doc status: HISTORICAL — superseded.** Frozen 2026-09-13 when Phase 1
> closed out. Not edited further. For current status, see
> [Milestones.md](../Milestones.md); see its "Documentation status
> conventions" section for what CURRENT/HISTORICAL mean.

This document intentionally describes only the in-memory prototype. Projects,
canvas connections, persistence, export, accounts, settings, and drag-and-drop
belong to later phases.

## Interaction decision

Token categories remain in **flexible order**. The prototype does not block a
user from adding an object, tool, quantity, or warning before an action.

The sample vocabulary and category headings provide enough guidance for the
recommended flow without making the core model recipe-shaped:

1. Select a step.
2. Add an action.
3. Add an object or other relevant tokens.
4. Add a quantity when useful.
5. Optionally add a tool or warning.
6. Remove tokens to revise the step.
7. Add or select another step and repeat.

This supports recipes as well as future assembly and safety instructions. A
later content pack may add domain-specific guidance without changing the core
document model.

## Desktop wireframe

```text
+----------------------+--------------------------------+----------------------+
| Visual Instruction    | Phase 1 prototype              |                      |
| Builder               |                                |                      |
+----------------------+--------------------------------+----------------------+
| STEPS                | BUILD THIS STEP                | ADD TO STEP          |
|                      |                                |                      |
| [1] Empty step      | [ Empty step ]                | ACTIONS              |
| [2] Chop Onion      |                                | [Chop] [Stir] [Bake] |
|                      | Pick a token below to start.  |                      |
| [+ Add step]         |                                | OBJECTS              |
|                      |                                | [Onion] [Egg]        |
|                      |                                |                      |
|                      |                                | TOOLS                |
|                      |                                | [Pan] [Knife]        |
|                      |                                |                      |
|                      |                                | QUANTITIES           |
|                      |                                | [1 cup] [500 g]      |
|                      |                                |                      |
|                      |                                | WARNINGS             |
|                      |                                | [Hot] [Sharp]        |
+----------------------+--------------------------------+----------------------+
```

The existing Phase 1 components map directly to these regions:
`StepList`, `StepBuilder`, and `TokenPicker`.

## Mobile wireframe

```text
+--------------------------------+
| Visual Instruction Builder     |
+--------------------------------+
| STEPS                          |
| [1] Empty step                |
| [2] Chop Onion                |
| [+ Add step]                  |
+--------------------------------+
| BUILD THIS STEP               |
| [ Chop ] [ Onion ] [ x ]      |
| [ 1 cup ] [ x ]               |
+--------------------------------+
| ADD TO STEP                   |
| ACTIONS   [Chop] [Stir]       |
| OBJECTS   [Onion] [Egg]       |
| TOOLS     [Pan] [Knife]       |
| QUANTITY  [1 cup] [500 g]     |
| WARNINGS  [Hot] [Sharp]       |
+--------------------------------+
```

All controls remain buttons with touch-sized targets. Selecting a step updates
the builder and picker in place; there is no separate screen or navigation
state in Phase 1.

## Scope check

| Design idea from the reference images | Phase 1 decision |
|---|---|
| Step sequence | Keep as the `StepList`. |
| Selected step details | Keep as token chips in `StepBuilder`. |
| Categorized library | Keep as `TokenPicker` groups. |
| Connected canvas nodes | Defer to Phase 2 SVG canvas. |
| Dragging and snapping | Defer to Phase 2. |
| Time, temperature, and other parameters | Defer until the model and UX require them. |
| Save, export, accounts, settings | Defer to the planned phases. |
| Mobile stacked layout | Keep the current responsive layout. |

## Prototype review

`TokenPicker` already supports the flexible-order flow by appending any sample
token to the selected step. `StepBuilder` already shows the ordered result and
allows individual tokens to be removed. No category-order implementation
change is needed for Phase 1.

The Phase 1 exit check is now: create five steps, select each one, add sample
tokens, revise at least one step, and confirm incomplete steps remain visibly
and accessibly flagged.
