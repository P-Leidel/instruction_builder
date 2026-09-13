# Fixed Issues

> 📌 **Doc status: CURRENT** — living doc, evergreen across phases. Add an
> entry here the moment a real bug (not a design decision, not a planned
> addition) is found and fixed; see
> [Milestones.md](./Milestones.md#documentation-status-conventions) for
> what CURRENT/HISTORICAL mean project-wide.

A log of defects that actually shipped (or were caught mid-session before
shipping) and how they were fixed - the resolved counterpart to
[Known-Issues.md](./Known-Issues.md), which tracks the opposite: issues
found and deliberately left unfixed. Fuller "what was being built when this
was found" narrative lives in [phase-2/Progress-Log.md](./phase-2/Progress-Log.md);
entries here are self-contained enough to read on their own, focused on
what broke, why, and how it was confirmed fixed.

## SVG canvas controls unreachable via keyboard (`tabindex` casing)

- **What broke:** the step-select badge and token remove control were
  meant to be keyboard-focusable (`role="button"`, task 6's accessibility
  requirement) but `Tab` skipped over them entirely, with no console error.
- **Root cause:** the JSX used `tabIndex={0}`, the HTML/React-conventional
  camelCase. Preact sets whatever case is written as the *literal* DOM
  attribute name on SVG elements - `tabIndex="0"` becomes an attribute the
  browser doesn't recognize, silently doing nothing. SVG elements need the
  all-lowercase `tabindex`.
- **Fix:** changed to `tabindex={0}` on both elements.
- **Verified by:** a dedicated Playwright check (`CANVAS_KEYBOARD_FOCUSABLE`
  in the project skill's driver) that focuses the badge and asserts
  `document.activeElement`'s role, added specifically as a regression test
  for this bug.
- **Found & fixed:** 2026-09-13.

## Token connector lines invisible despite correct markup

- **What broke:** the lines drawn between a step's tokens (in array order)
  had valid path coordinates and a correctly-applied `stroke`, confirmed via
  `getComputedStyle`/`getBBox()` - but were imperceptible in an actual
  screenshot.
- **Root cause:** the gap the line was drawn in was only 8 design units
  wide with a pale `#bbb` stroke, too subtle against the light chip/step
  backgrounds at the canvas's rendered scale. DOM/style inspection said
  "this is correct"; only a real screenshot showed it wasn't visible.
- **Fix:** widened the inter-chip gap (8 → 16 design units) and used a
  darker, thicker stroke.
- **Verified by:** a cropped/zoomed screenshot of the gap specifically, and
  a driver check that counts connector-line elements against the expected
  token-count-minus-one.
- **Found & fixed:** 2026-09-13.

## Row-wrap connectors reading as one continuous bar across several rows

- **What broke:** in a step wrapping across 3+ rows, the connector bends
  between rows visually merged into what looked like a single line running
  down the whole step, instead of distinct "end of row N → start of row
  N+1" hooks - reported from a screenshot.
- **Root cause:** the bend was routed through each row's own mid-height.
  Since every full row's last chip sits at the same x, consecutive wraps'
  vertical segments landed on that same x and chained together; the
  horizontal leg also overlapped the next row's own same-row connectors
  (both drawn at that row's mid-height).
- **Fix:** route the bend through the middle of the specific gap *between*
  the two rows it connects, not either row's mid-height - giving each wrap
  its own y-band with no overlap.
- **Verified by:** reproducing a 4-row/24-token step and confirming three
  visually distinct hooks in a screenshot.
- **Found & fixed:** 2026-09-13.

## Stale step selection after a persisted document loads

- **What broke:** after a page reload with a previously-saved document,
  nothing appeared selected in the canvas or side panels.
- **Root cause:** `selectedStepId` initializes at module load (synchronously,
  before persistence's async IndexedDB read resolves) against the
  throwaway default document's first step. Once the real saved document
  replaced it, `selectedStepId` still pointed at a step id that no longer
  existed in the loaded document.
- **Fix:** `initPersistence` now calls `selectStep` on the loaded document's
  first step once it resolves.
- **Verified by:** the persistence-across-reload driver check, extended to
  also confirm a step is selected post-reload.
- **Found & fixed:** 2026-09-13.

## Row-wrap connector's stub only existed on one end

- **What broke:** the row-wrap bend poked a short stub out past the *source*
  chip's border before curving, but landed flush against the *destination*
  chip's border on the other end - reported by the user as visually
  asymmetric.
- **Root cause:** the lead-out stub (added to keep the line visually
  distinct from the chip it leaves) was only ever computed for the source
  side; the destination side's approach was never given the same treatment.
- **Fix:** mirrored the stub - the destination side now gets an equal-length
  stub before a final straight run into the chip, confirmed via the raw SVG
  path data (`M 656 60 L 664 60 ...` mirrored by `... L -8 132 L 0 132`).
  The canvas's reserved margin was doubled so the new destination-side stub
  can never overflow a step card's edge.
- **Verified by:** inspecting the generated path's exact coordinates for
  both ends of a wrap.
- **Found & fixed:** 2026-09-13.

## Row-wrap bends looked inconsistently "tight" between wraps

- **What broke:** the user reported that different row-wrap bends in the
  same document didn't look the same, specifically in curve tightness.
- **Root cause:** *not* a geometry bug - two wraps' path data, dumped and
  compared directly, were mathematically identical (one was exactly the
  other translated down by one row height). The real cause was rendering at
  scale: the 8-design-unit corner radius amounted to only a handful of
  actual screen pixels once the canvas was scaled down for a wide/tall
  document, small enough that rasterization made otherwise-identical curves
  read as inconsistently rounded.
- **Fix:** raised `CONNECTOR_CORNER_RADIUS` and `CONNECTOR_LEAD_OUT` from 8
  to 12 (kept equal, so the stub and curve read as one shape) - large
  enough to render as an unambiguous, consistent curve at any canvas scale.
- **Verified by:** re-rendering a 3-row wrapped step and visually comparing
  both bends side by side.
- **Found & fixed:** 2026-09-13.

## DurationField showed a stale, unsaved edit after switching tokens or steps

- **What broke:** if you clicked "Edit" (or "+ Time") on one token's or
  step's time, changed a value, and then selected a *different* token or
  step **without** saving or cancelling, the newly-selected token/step's
  Time field stayed stuck showing the previous one's unsaved editing form -
  reported by the user as time "not properly being displayed above the
  token."
- **Root cause:** `DurationField` keeps its own local `editing`/`draft`
  state. `StepDetails`/`TokenDetails` rendered it with no `key` prop, so
  Preact reused the *same component instance* across a token/step switch
  (same position in the render tree) - its internal state carried over
  instead of resetting for the newly-selected entity. Every other field in
  those panels (Title, Notes) is a plain controlled input with no local
  state of its own, which is why only this component could exhibit this
  class of bug.
- **Fix:** added `key={token.id}` / `key={step.id}` to the two
  `DurationField` usages, forcing Preact to mount a fresh instance (with
  reset state) whenever the selected token or step changes.
- **Verified by:** two dedicated Playwright regression checks
  (`DURATION_FIELD_RESETS_PER_TOKEN`, `DURATION_FIELD_RESETS_PER_STEP`) that
  reproduce exactly this sequence - start an edit, switch selection without
  saving, assert the new selection shows its own (unedited) state, not the
  old one's leftover form.
- **Found & fixed:** 2026-09-13.

## Forward drag-reorder overshot by one position (tokens and steps)

- **What broke:** dragging a token forward within a step's row, or a step
  forward in the step list, landed the dragged item one slot past where it
  was actually dropped. Dragging *backward* (toward the front of the list)
  always worked correctly, which is why the project's own Playwright driver
  never caught it - its only reorder checks dragged backward.
- **Root cause:** both `moveToken`'s same-step branch and `reorderSteps`
  (`src/state/document.ts`) hit-test the drop point against the *currently
  rendered, pre-removal* list to get a "drop-before" target index, then
  filter/splice the dragged item out and reinsert it at that same raw
  numeric index. Removing the dragged item shifts everything after its
  original position back by one, so reinserting at the unadjusted index
  lands one slot too far whenever the target sits after the source.
- **Fix:** both functions now compare the dragged item's original index to
  the target index before removing it, and decrement the target by one when
  the move is forward (target after source) - `moveToken`'s same-step
  branch via a `fromIndex`/`adjustedIndex` comparison, `reorderSteps` via an
  equivalent `adjustedToIndex`.
- **Verified by:** two dedicated Playwright regression checks
  (`FORWARD_TOKEN_DRAG_LANDS_AT_DROP_POINT`,
  `FORWARD_STEP_DRAG_LANDS_AT_DROP_POINT`) that drag an item forward into a
  slot strictly between two others (not just "to the very end," which
  happens to clamp to the same result either way and wouldn't have caught
  this) - confirmed both fail on the pre-fix code and pass after.
- **Found & fixed:** 2026-09-13 (via code review, `reviews/2026-09-13-1516-review.md`).

## `descriptionFor` helper duplicated verbatim across two components

- **What broke:** nothing user-visible - an identical 3-line helper
  (`SAMPLE_TOKENS.find((s) => s.iconId === iconId)?.description`) was
  copy-pasted between `StepDetails.tsx` and `TokenDetails.tsx`, a latent
  drift risk rather than a bug.
- **Root cause:** the helper was written locally in each component instead
  of being added to `data/sample-tokens.ts`, which already exports the
  `SAMPLE_TOKENS`/`CATEGORY_LABELS` data it reads.
- **Fix:** moved `descriptionFor` into `data/sample-tokens.ts` (exported
  alongside `SAMPLE_TOKENS`/`CATEGORY_LABELS`) and imported it from both
  components instead of redefining it.
- **Verified by:** `npm run lint`/`typecheck`/`build` passing with no
  duplicate-definition or unused-import errors.
- **Found & fixed:** 2026-09-13 (via code review, `reviews/2026-09-13-1516-review.md`).

## Unreachable `"note"` token category shared a name with an unrelated field

- **What broke:** nothing user-visible - `TokenCategory` included a `"note"`
  value with no sample tokens behind it, so `TokenPicker`'s
  samples-only-category filter silently made it unreachable (no tab ever
  rendered for it). Its name also collided, in name only, with the
  unrelated `InstructionToken.note` free-text field.
- **Root cause:** the category was added to the `TokenCategory` union and to
  `TokenPicker`'s `STEP_TOKEN_CATEGORIES` list without ever adding matching
  content to `SAMPLE_TOKENS`.
- **Fix:** dropped `"note"` from `TokenCategory` and from
  `STEP_TOKEN_CATEGORIES`, since it was dead - the type already documents
  that new categories can be added later once there's real content for one.
- **Verified by:** `npm run lint`/`typecheck`/`build` passing, and a grep
  confirming no other code referenced the `"note"` category value.
- **Found & fixed:** 2026-09-13 (via code review, `reviews/2026-09-13-1516-review.md`).

## Attachment remove button labeled with the category name, not the actual value

- **What broke:** the "×" button removing a Quantity or Warning from a
  token was labeled (for screen readers) "Remove Warnings" / "Remove
  Quantities" - the plural category name - regardless of which specific
  item it removed, so a token with only one attachment of a kind had no way
  to know *which value* a remove button referred to from its label alone.
- **Root cause:** the label was built from `CATEGORY_LABELS[kind]` (a
  fixed, category-level string) rather than the attachment's own value.
- **Fix:** label now reads `Remove ${attachment.label ?? CATEGORY_LABELS[kind]}`
  - e.g. "Remove Sharp!" or "Remove 250 g" - falling back to the category
  name only if an attachment somehow has no label of its own.
- **Verified by:** the Playwright driver's attachment-removal step, updated
  to locate the button by its new, specific accessible name.
- **Found & fixed:** 2026-09-13.

## Duration value wrapped awkwardly next to its Edit/Remove buttons

- **What broke:** in the narrow side panels, a duration like
  "02d-00h-00m-00s" wrapped mid-string onto two lines while sharing a row
  with the Edit and Remove buttons, cramped and hard to read.
- **Root cause:** the value, its Edit button, and its Remove button were
  laid out in a single flex row with no wrap handling suited to a long,
  unbreakable value string in a narrow container.
- **Fix:** the value now sits on its own line (`white-space: nowrap` so it
  never breaks internally) with Edit/Remove grouped in a row beneath it.
- **Verified by:** a screenshot comparison before and after the change.
- **Found & fixed:** 2026-09-13.
