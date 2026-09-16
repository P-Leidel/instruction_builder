# Title/description max length limits

> 📌 **Doc status: CURRENT** — one file in the
> [Phase 3 Progress Log](./README.md).

Date: 2026-09-16

On request, capped the length of the app's four free-text authoring fields:
a step's Title and a token's Title at 50 characters, a step's Details and a
token's Notes at 249 characters.

## What shipped

- [StepDetails.tsx](../../../src/components/StepDetails/StepDetails.tsx):
  new `TITLE_MAX_LENGTH` (50) and `DESCRIPTION_MAX_LENGTH` (249) constants,
  passed as `maxLength` on the step Title `<input>` and Details `<textarea>`
  respectively.
- [TokenDetails.tsx](../../../src/components/TokenDetails/TokenDetails.tsx):
  the same pair of constants (`TITLE_MAX_LENGTH` 50, `NOTE_MAX_LENGTH` 249),
  local to this file alongside the existing `MIN_QUANTITY`/`MAX_QUANTITY`
  pair, applied to the token Title `<input>` and Notes `<textarea>`.
- Each pair is a plain local constant per file (not a shared cross-file
  module) - the same convention `MIN_QUANTITY`/`MAX_QUANTITY` already used
  in `TokenDetails.tsx`, since each field only needs its own component to
  know its own limit.
- The limit is enforced by the native HTML `maxlength` attribute, which
  Preact's `maxLength` prop maps to - the browser itself refuses to accept
  further typed or pasted characters once the field is at its cap, so no
  change was needed to `state/document.ts`'s mutators or the `model/
  instruction.ts` types (neither `InstructionStep.title`/`.description` nor
  `InstructionToken.label`/`.note` gained any length constraint - this is a
  UI-only cap, not a document-schema one).

## Verification

- `npm run lint`, `npm run typecheck`, `npm test` (131 tests, unchanged -
  no new logic, just a `maxLength` prop on four existing inputs), and
  `npm run build` all pass cleanly.
- Verified in a real browser (dev server, via a one-off Playwright script):
  selected a step, typed an 80-character string into its Title field and a
  300-character string into its Details field, then added and selected a
  token and did the same to its Title/Notes fields. All four fields
  truncated to exactly their limit (50/249/50/249 characters
  respectively) rather than accepting the full input.

## What's next

See [README.md](./README.md) for Phase 3's overall status.
