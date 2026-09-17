# Task 30: ninth user feedback pass

> 📌 **Doc status: CURRENT** — one file in the
> [Phase 3 Progress Log](./README.md).

Date: 2026-09-17

A same-day follow-up to the
[eighth feedback pass](./task-30-user-feedback-fixes-8.md). Settled via
`/mattpocock-skills:grill-with-docs`, which ran both `grilling` (two rounds,
seven questions total) and `domain-modeling` - the first pass in this
project's history to add a *new* term to `CONTEXT.md` (it previously held
only the pre-existing "Document session" entry) rather than just reading it
for vocabulary.

## What was reported

"Users requested the ability to copy and paste tokens."

## What shipped

A new **token clipboard** (see `CONTEXT.md`'s own entry): a single-slot,
in-memory `copiedToken` signal on the document session (`state/
document.ts`), alongside the existing `selectedStepId`/`selectedTokenId`.
Two new session actions:

- `copyToken(stepId, tokenId)` - writes a full copy of that token (label,
  note, quantity, warning, time) into the clipboard, with a fresh id.
  Doesn't touch `document`, undo/redo history, or selection - copying isn't
  a document mutation.
- `pasteToken()` - appends a further fresh-id copy of whatever's in the
  clipboard onto the currently selected step, reusing
  `addTokenToSelectedStepCore`'s existing "wherever's selected" convention
  exactly. A no-op with nothing copied or no step selected. Repeatable:
  pasting the same clipboard twice produces two independent tokens with
  distinct ids. `replaceDocument` (New/Import) clears the clipboard, the
  same way it resets selection - a copied token from a since-replaced
  document would be a surprising thing to have survive.

Two trigger paths, both grilled explicitly:

- **Buttons**, deliberately split across two panels rather than both living
  next to each other: a Copy button in `TokenDetails`' header (needs a
  selected *token*) and a Paste button in `StepDetails`' header (needs only
  a selected *step*, so it stays reachable even when pasting into a freshly
  added empty step with no token selected yet - the case that would break
  if both buttons sat in `TokenDetails` alongside each other).
- **Keyboard**: `Ctrl/Cmd+C`/`Ctrl/Cmd+V`, wired globally in `app.tsx`
  (`useTokenClipboardKeyboardShortcuts`, alongside the existing undo/redo
  listener) - but skipped entirely while focus is in a text
  input/textarea/contenteditable, so typing in a Title/Notes field keeps
  the browser's own native text copy/paste instead of this shortcut
  hijacking it.

Copy shows a one-line info-tone toast (`"Copied <label>"`) via the existing
`toast` signal, since copying changes nothing visible on the canvas.
Pasting shows no toast - the new chip appearing is its own confirmation,
matching how every other canvas mutation already works.

Two decisions were deliberately scoped out, both recorded in the grilling
round rather than silently assumed: whole-*step* copy/paste (only tokens
were requested; today's model has no multi-select to extend to steps
cleanly anyway), and a real system clipboard via `navigator.clipboard`
(this clipboard never needs to survive a reload or leave the tab, so the
added complexity - permission prompts, JSON serialization, import-style
validation on paste - would serve a request nobody made).

## Verification

- `npx tsc -b`, `npm run lint`, and `npm run build` all pass cleanly.
- `npm test`: 141 tests (135 → 141, +6), all new - a `copyToken /
  pasteToken` describe block in `document.test.ts` covering the deep copy
  (including an existing attachment) with a fresh id, that copying alone
  touches neither the document nor history, that pasting is undoable and
  mints yet another fresh id distinct from both the source token's and the
  clipboard's own, that pasting the same clipboard twice yields two
  distinct tokens, the two no-op guards (nothing copied; no step selected),
  and that `replaceDocument` clears the clipboard.
- A live Playwright check against the dev server: added a token, selected
  it via `StepDetails`' accessible token list, confirmed the Copy button
  renders, clicked it, confirmed the toast read "Copied Chop" and the
  previously-disabled Paste button became enabled, clicked Paste and
  confirmed the step's token count went from 1 to 2. Re-selected the
  original token and repeated the same round-trip via `Ctrl+C`/`Ctrl+V`
  (count went to 3), then focused the step Title field, selected its text,
  and pressed `Ctrl+C` - confirmed no toast appeared, i.e. the shortcut
  correctly stayed out of the way of native text copy. Also confirmed zero
  console errors and no horizontal overflow at the 390px mobile
  regression-guard width; screenshots at both widths were read back to
  confirm the Copy/Paste buttons render correctly in each panel's header.
- Not done: `.claude/skills/run-instruction-builder/driver.mjs` (the
  project's comprehensive end-to-end regression script) was not extended
  with a copy/paste block. That script is long and tightly sequential -
  many of its later checks depend on exact token/step counts established
  earlier - and adding to it safely would need care beyond this pass's
  scope. The feature is fully covered by the unit tests and the live
  browser check above; extending the driver is left as follow-up work,
  not silently skipped.

## What's next

See [README.md](./README.md) for Phase 3's overall status - task 30 (Test
Real Users) continues as more feedback comes in. If another interactive
feature lands the same way, extending `driver.mjs` for both it and this
pass together would amortize the risk of touching that long sequential
script.
