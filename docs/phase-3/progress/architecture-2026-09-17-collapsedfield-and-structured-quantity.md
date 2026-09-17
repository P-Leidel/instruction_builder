# Architecture: `CollapsedField` extraction and structured Quantity

> 📌 **Doc status: CURRENT** — one file in the
> [Phase 3 Progress Log](./README.md).

Date: 2026-09-17

A same-day follow-up to the
[third user feedback pass](./task-30-user-feedback-fixes-3.md)'s new
`FieldPopover` ran a fresh
`/mattpocock-skills:improve-codebase-architecture` pass scoped to the canvas
and Token/Step details (audit:
[2026-09-17-canvas-tokenchip-and-field-shape-review.html](../audits/2026-09-17-canvas-tokenchip-and-field-shape-review.html)).
Of its three candidates, two were picked to fix together via
`/mattpocock-skills:grilling` (deliberately deepened at the same time,
since fixing candidate 3 first would have meant writing the deepened
`QuantityForm` twice): deepening `DurationField`/`QuantityRow`'s duplicated
collapsed/popover chrome into one shared module, and replacing
`QuantityRow`'s best-effort `splitQuantity` reverse-parse with structured
data. The audit's own working name for the first, `CollapsibleField`, was
refined during grilling to `CollapsedField` (it never shows anything other
than collapsed - the popover floats above it rather than "expanding" it -
so "collapsed" better describes what the component's own state is). The
third candidate, `TokenChip` (extracting the canvas's six read-only chip
badges/pointer handlers into their own component), was left for later - it
touches an entirely disjoint set of files (the SVG canvas tree, not the
sidebar form tree) and shares no interface with either of these two, so
there was no sequencing reason to bundle it in.

## What shipped

**`CollapsedField<T>`** (`src/components/CollapsedField/CollapsedField.tsx`)
is the new shared module for the add/display/edit/remove/popover-anchor
chrome that `DurationField` and TokenDetails' `QuantityRow` used to each
hand-roll identically (a "+ `<label>`" button when unset, or a value with
Edit/Remove once set, with the actual edit form always floating in a
`FieldPopover`, not expanding in place - see the third feedback pass for
why). Settled on a ~9-prop surface optimized for the common caller rather
than the most configurable one: `label`, `showLabel`, `value`,
`renderValue`, `renderForm`, `onRemove`, `editing`/`onEditingChange`, and
one optional `ariaLabels: { add?, edit?, remove? }` override. Deliberately
no `onOpen` hook - `renderForm`'s children (a small `DurationForm`/
`QuantityForm` module per caller) mount fresh each time `editing` flips
true and unmount on close, so a plain `useState(() => splitDuration(...))`
initializer re-seeds the draft automatically, the same remount-to-reset
idiom this codebase already uses everywhere else (`key={token.id}`).
Default aria-labels (`Add/Edit/Remove ${label.toLowerCase()}`) cover
`DurationField` for free, since a step/token only ever has one time;
`QuantityRow` opts into `ariaLabels` because its text is genuinely
value-dependent (e.g. "Remove 3 kg").

`DurationField` and `QuantityRow` are now thin adapters: each supplies only
`renderValue` (the value's own display string) and its own small form
component - `DurationForm` (`src/components/DurationField/DurationForm.tsx`,
the four day/hour/minute/second inputs) and `QuantityForm`
(`src/components/TokenDetails/QuantityForm.tsx`, the amount+unit pair) -
extracted verbatim from what used to be each component's own inline popover
content. One user-visible side effect of unifying the two: the collapsed
"+ Add" button's text is now driven by the same `label` prop as everything
else (`+ Token time`, `+ Step time`, `+ Quantity`), rather than the
previously hand-picked, inconsistent `+ Time` both `DurationField` call
sites used regardless of their actual label.

**Structured Quantity**: `InstructionToken.quantity` changed type from the
generic `TokenAttachment` (`{ iconId, label? }`) to a new
`QuantityAttachment` (`{ iconId, label, amount, unit }`,
`model/instruction.ts`), mirroring how `DurationAttachment` already carries
its raw `seconds` alongside the formatted `label`. This replaces
`QuantityRow`'s old `splitQuantity` helper, which reverse-parsed the
formatted "3 kg" label back into an amount/unit pair by splitting on the
first space - a best-effort parse that silently fell back to `1`/the first
EU unit for anything it couldn't recognize (a unit containing a space, or
one no longer in `EU_FOOD_UNITS`). `QuantityForm` now reads `value.amount`/
`value.unit` directly to seed its draft, with the same fallback kept only
as a defensive default for a token with no quantity yet (or, unreachable
via this app's own UI, an older imported document whose quantity predates
these fields). A new `lib/quantity.ts` (mirroring `lib/duration.ts`) holds
`MIN_QUANTITY`/`MAX_QUANTITY` and `buildQuantity(amount, unit)`, which
validates and formats a `QuantityAttachment` the same way `buildDuration`
already does for time. `state/document.ts`'s `attachToToken`/
`setTokenAttachment` widened their attachment parameter from `TokenAttachment`
to `TokenAttachment | QuantityAttachment` to accept it - no schema version
bump was needed, since `migrate.ts`'s `isValidToken` was already documented
as not deep-validating per-token attachments like `quantity`.

`QuantityBadge` (`InstructionCanvas.tsx`'s canvas-chip pill) needed no
changes: it only ever reads `attachment.label`, which stays a required
string on `QuantityAttachment` - a structural superset of the generic
`TokenAttachment` it's typed against - so it keeps compiling and rendering
identically.

### CSS

The duplicated `.duration-field__*` and `.token-details__quantity-*` chrome
rules (add/display/value/edit/remove/save/cancel - pixel-identical between
the two) were consolidated into one `.collapsed-field__*` block in
`global.css`. Each field's own form markup keeps its own classes
(`.duration-field__inputs`/`__unit`/`__actions` for `DurationForm`,
`.token-details__quantity-form`/`__field`/`__error`/`__actions` for
`QuantityForm`), including their Save/Cancel buttons, which now use the
shared `.collapsed-field__save`/`__cancel` classes instead of duplicating
that styling under their own names.

### Test driver

`.claude/skills/run-instruction-builder/driver.mjs` scoped several
locators to the now-removed `.duration-field` wrapper class, and to
`.token-details__quantity-save`/`-value`/`-edit` (also removed - the
collapsed chrome they targeted moved to the shared `.collapsed-field__*`
classes). Since Token time and Quantity both render that same
`.collapsed-field` structure inside `.token-details`, a bare
`.collapsed-field` locator there is ambiguous; the driver now scopes by
each field's fixed position inside `.token-details__time-quantity-row`
(Time first, Quantity second - see `TokenDetails.tsx`'s
`TimeAndQuantityRow`) via `.nth(0)`/`.nth(1)`, which `.step-details` didn't
need since it only ever has one `.collapsed-field`.

## Verification

- `npm run lint` / `npm run typecheck` / `npm test` (131 tests, unchanged -
  this was a component/data-shape refactor with no new branchable logic
  worth a new test) / `npm run build` all clean.
- Full Playwright driver run against the dev server: all 46 checks
  `true`/`0`/`0`, including every Quantity/Duration-specific check
  (`QUANTITY_EDIT_PREFILLS_FROM_CURRENT_VALUE`,
  `QUANTITY_SELECTS_VALUE_ON_FOCUS`, `QUANTITY_FORM_RESETS_PER_TOKEN`,
  `ATTACHED_VALUE_CHANGEABLE_WITHOUT_REMOVING`,
  `DURATION_SELECTS_VALUE_ON_FOCUS`, `TIME_WORKED_END_TO_END`,
  `DURATION_FIELD_RESETS_PER_TOKEN`, `DURATION_FIELD_RESETS_PER_STEP`) and
  the three accessibility scans at 0 violations each, with 0 console
  errors.
- Screenshots read directly to confirm the collapsed chrome (the "+ Token
  time"/"250 g" + Edit/Remove pair) still lays out identically to before
  inside `TimeAndQuantityRow`, including the flex-wrap-to-two-lines
  behavior at the sidebar's narrow width.

## What's next

See [README.md](./README.md) for Phase 3's overall status - task 30 (Test
Real Users) continues, and the audit's third candidate (`TokenChip`,
extracting the canvas's chip rendering/pointer-drag handling) remains
available to pick up independently.
