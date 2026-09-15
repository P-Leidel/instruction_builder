# "Add to token" folded into Token details

> 📌 **Doc status: CURRENT** — one file in the
> [Phase 3 Progress Log](./README.md).

Date: 2026-09-15

A `/mattpocock-skills:grill-with-docs` session (`grilling` + `domain-modeling`)
settled the shape of a second UX rework the same day as the step-management
one: the standalone `TokenAttachmentPicker` panel ("Add to token", right
column) is deleted outright, and its Quantity/Warning attaching behavior
folds into
[TokenDetails.tsx](../../../src/components/TokenDetails/TokenDetails.tsx)'s
own "Attachments" section (renamed from "Attached").

## What shipped

- **`TokenAttachmentPicker.tsx` and its CSS are gone.** `app.tsx`'s right
  column now holds just `TokenPicker` ("Add to step").
- **`TokenDetails`'s "Attachments" section is two always-visible rows,
  Quantity then Warning** (Quantity first since it's adjusted most often) -
  not the old tab-switched panel. Each row shows its current value (if any,
  reusing the existing `.token-details__attachment` chip+remove styling)
  *and* its add/change control inline at the same time, rather than behind
  a tab or a collapse trigger:
  - **Quantity row**: the same amount+unit form `TokenAttachmentPicker` had
    (`QuantityRow`, moved and renamed from `QuantityForm`), still keyed by
    `token.id` so a draft amount/unit doesn't leak from one token to the
    next (docs/fixed-issues/quantity-form-draft-leaked-between-tokens.md's
    fix carried over unchanged).
  - **Warning row**: the same two presets (Hot!, Sharp!), with the
    currently-attached one now visually marked active
    (`.token-picker__button--active`) - a small addition the old tabbed
    panel had no need for, since only one row was ever visible at a time.
- **Attaching a new value always replaces the old one in place, without
  removing first** - this was already how the data model worked
  (`InstructionToken.quantity`/`.warning` hold at most one attachment each;
  see instruction.ts), but the old tabbed UI made it easy to attach a
  *different* value directly too. Keeping the add/change control visible
  even while a kind is already attached (rather than hiding it once
  attached, which would have forced remove-then-re-add) was a deliberate
  design decision in the grilling session, not an accident of the merge.
- **The attachment-remove button's `aria-label` stayed dynamic**
  (`` `Remove ${label}` ``, e.g. "Remove Sharp!") rather than a generic
  "Remove warning" - caught and fixed during implementation, since a static
  label would have been a real accessibility regression from what
  `TokenAttachmentPicker` already had.
- **The tab-selection signal is gone.** `activeAttachmentCategory` (a
  second, separate signal from `TokenPicker`'s own `activeTokenCategory`)
  is deleted from `state/ui.ts` - there's nothing left to switch between,
  since both kinds render as their own row at once.
- **CSS classes moved namespace**: `.token-attachment-picker__form/__field/
  __error/__attach` became `.token-details__quantity-form/__quantity-field/
  __quantity-error/__quantity-attach`; `.token-details__attachment-list`
  (the old shared `<ul>` wrapper for both kinds together) was removed in
  favor of a new `.token-details__attachment-row` per kind.  Shared classes
  that `TokenPicker` still uses (`.token-picker__tabs/__tab/__grid/
  __button/__label`) were left alone.

## Verification

- `npm run lint` / `typecheck` / `test` (128 tests, unchanged - this was a
  UI-only reorganization of already-tested state mutators, not new domain
  logic) / `build` all pass cleanly.
- Full Playwright driver run against the dev server: 45 checks (up from 44
  - a new `ATTACHED_VALUE_CHANGEABLE_WITHOUT_REMOVING` check exercises the
  grilling session's "no remove-first" decision directly: attaches a
  Quantity, then attaches a different one without removing, and confirms
  it replaced in place rather than producing a second attachment), all
  true/0/0. The driver itself dropped every `.token-attachment-picker`
  selector and tab-switch call in favor of scoping through
  `page.locator(".token-details")` directly, since there are no tabs left
  to switch.
- Read actual screenshots from that run confirming the merged layout: the
  right column is a single balanced panel (`TokenPicker` alone, no leftover
  gap), and Token details shows both attachment rows inline with the
  currently-selected token's actual values.

## What's next

See [README.md](./README.md) for Phase 3's overall status.
