# Task 30: third user feedback pass

> 📌 **Doc status: CURRENT** — one file in the
> [Phase 3 Progress Log](./README.md).

Date: 2026-09-17

A follow-up report on the [second feedback pass](./task-30-user-feedback-fixes-2.md)
shipped the same day: putting "+ Quantity" inline next to "+ Time" fixed the
labels complaint but introduced a new one, plus surfaced a pre-existing bug
that pairing them together had been masking. Both findings were verified
against the running dev server (bounding-box measurements, screenshots)
before any design discussion, then the fix was settled via
`/mattpocock-skills:grilling` before implementation.

## What was reported, and what was actually true

1. **"Input fields for time and quantity are too big, they don't fit in one
   line."** Confirmed: with Token time's edit form open, its four
   day/hour/minute/second inputs wrapped to two rows ("0d 0h 0m" then "0s")
   inside the ~206px-wide half of the shared row. Quantity's Amount/Unit
   form wrapped similarly. Digging further, this turned out **not** to be
   specific to the shared row at all - Step details' own Token time field,
   at the sidebar's full (also ~206px) content width, showed the identical
   wrap. The row-sharing fix from the second pass hadn't caused this; it had
   just made an existing `DurationField` layout bug visible in a second
   place.
2. **"The buttons for time and quantity move in unexpected ways when either
   menu is expanded."** Confirmed via bounding-box tracking: "+ Quantity"
   sat at one position with both fields collapsed, then jumped to a new
   position the instant Token time's form opened (and vice versa for
   "+ Time" when Quantity opened). Root cause: both fields lived in one
   `flex-wrap` row (`TimeAndQuantityRow`, added by the second pass
   specifically so the two buttons could sit inline) - a height change in
   either one's inline edit form reflowed its still-collapsed sibling.

## What shipped

Both Token time (used by Step details and Token details) and Token
details' Quantity moved from expanding their edit form in place to opening
it in a small floating **popover** instead - settled after grilling through
several branches: inline-fit redesign vs. a dedicated popover (the popover
won: it removes the edit form from document flow entirely, so a sibling
field can never be pushed around by it, and it stops fighting a
column that's just genuinely too narrow for either form). Specifics
decided during grilling:

- **Same fields, just relocated.** No change to what's asked for or how
  it's validated (`buildDuration`/`splitDuration`, `EU_FOOD_UNITS`) - the
  popover just gives the same four day/hour/minute/second inputs, or the
  same Amount+Unit pair, enough width to lay out on one line.
- **Applies everywhere `DurationField` is used** - Step details' "Step
  time" and Token details' "Token time" both get the popover, not just the
  one pair a user happened to report on, since it's the same shared
  component and the same underlying bug.
- **Escape or an outside click discards the draft**, same effective
  behavior as Cancel - no separate "click away to save" path.
- **Mutual exclusion is preserved**: opening Token time's popover on a
  token still closes Quantity's if it was open, and vice versa - the
  original ask behind `TimeAndQuantityRow` wasn't a side effect of the old
  bug, it was a stated requirement.
- **Full keyboard trap inside whichever popover is open**, extending
  `useConfirmDialogFocusTrap`'s pattern (`lib/dialog-focus-trap.ts`) to
  more than its hard-coded two buttons - these forms have 4-6 focusable
  controls whose enabled state can also change (Quantity's Save disables
  while its amount is invalid), so the trap re-queries focusable
  descendants on every Tab press rather than holding fixed refs.

### The new `FieldPopover` component

`src/components/FieldPopover/FieldPopover.tsx` is the shared shell both
`DurationField` and `TokenDetails`' `QuantityRow` render into when
`editing` is true, replacing what used to be a third top-level branch
(`if (editing) return ...`) in each. It's rendered inside a new
`.field-popover-anchor` wrapper (`position: relative; display:
inline-block`) around exactly the trigger button that opened it - CSS
`top: 100%; left: 0` on `.field-popover` then lands it directly under that
button, not under the field's label or any other sibling content. No
portal to `document.body` was needed: `.app__main`'s grid/flex columns
have no `overflow: hidden` or internal scroll between the field and the
panel's own edge, confirmed before choosing this approach, so plain
in-DOM absolute positioning is enough.

It handles:
- Focusing the first focusable control on open, and returning focus to
  the trigger button on every close path (Save, Cancel, Escape, outside
  click) - both calls pass `{ preventScroll: true }`. Without it, focusing
  a field inside a popover that renders below the visible viewport (a
  realistic case - Token details sits fairly low in a populated panel)
  made the browser auto-scroll the page to reveal it, and that scroll
  persisted after the popover closed. On screen that looked exactly like
  the bug this popover exists to fix - everything above/around the field
  silently shifting - just caused by scroll instead of layout. Confirmed
  via a raw (non-Playwright-assisted) DOM `.click()` that this scroll came
  from focus, not from anything else, before fixing it this way.
- Escape and outside-click dismissal (`pointerdown` on `document`, ignoring
  clicks inside the popover or on its own trigger).
- A live Tab trap (queries `.field-popover`'s own focusable descendants on
  every Tab press, not fixed refs - see above).
- Horizontal viewport-overflow protection: after mount, if the
  default left-aligned position would run past the viewport's right edge,
  it flips to right-aligned. Verified at the app's own tested 390px mobile
  width (`document.documentElement.scrollWidth` stayed equal to
  `clientWidth` with a popover open).

## Verification

- `npm run lint` / `npm run typecheck` / `npm test` (131 tests, unchanged -
  no test exercised `FieldPopover` internals directly) / `npm run build`
  all clean.
- Full Playwright driver run against the dev server: all 46 checks
  `true`/`0`/`0`, including every existing Quantity/Duration check
  unmodified by this pass (`QUANTITY_EDIT_PREFILLS_FROM_CURRENT_VALUE`,
  `QUANTITY_SELECTS_VALUE_ON_FOCUS`, `QUANTITY_FORM_RESETS_PER_TOKEN`,
  `DURATION_SELECTS_VALUE_ON_FOCUS`, `TIME_WORKED_END_TO_END`,
  `DURATION_FIELD_RESETS_PER_TOKEN`, `DURATION_FIELD_RESETS_PER_STEP`) and
  the three accessibility scans at 0 violations each.
- Manual bounding-box verification (a scratch Playwright script, deleted
  after use, not part of the driver): the Token time/Quantity row's own
  bounding box was captured byte-identical across collapsed, Token-time-
  open, Quantity-open, and post-Escape states once the `preventScroll` fix
  landed - confirming the reflow bug (and the scroll-shift variant of it)
  is actually gone, not just less visible.
- Screenshots read directly to confirm: Token time's four inputs and
  Quantity's Amount+Unit both render on one line inside their popover, in
  both Token details and Step details; the popover floats over whatever
  else is below it (e.g. the Warning field) rather than pushing it down;
  at 390px mobile width the popover stays fully on-screen with no page
  horizontal overflow.

## What's next

See [README.md](./README.md) for Phase 3's overall status - task 30 (Test
Real Users) continues as more feedback comes in.
