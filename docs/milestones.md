# Milestones

> 📌 **Doc status: CURRENT** — this is the single living, canonical status
> tracker for the whole project. Update it in the same edit that changes
> any task's status; see "Documentation status conventions" below for how
> this doc relates to every other doc in `docs/`.

**Current status (2026-09-14): Phase 2 (MVP) is complete.** Phase 1
(Concept Validation) is complete, and all 20 of Phase 2's tasks (5–24) are
done - tasks 18/19 (JSON Export, Import) were deliberately pulled ahead of 15–17
(SVG/PNG/Print export) on request, since a working JSON round-trip makes
both automated and manual testing of everything else easier. Task 15
(SVG Export) picked the original order back up and also folded in an
external audit's recommended prep work (lifting the canvas's layout math
into its own module, `lib/canvas-layout.ts`, before building export on top
of it); task 16 (PNG Export) reused that same SVG pipeline, rasterized via
an offscreen `<canvas>`; task 17 (Print/PDF Export) shipped the plan's
baseline tier (`window.print()` + a `@media print` stylesheet), reusing
that same hidden export canvas as the print source and deferring the
vector-PDF stretch tier to Phase 4 as planned. Task 20 (Automated Testing)
was preceded by two `/improve-codebase-architecture` passes it was
explicitly blocked on (a constructable document session, and a drag-and-
drop protocol collapse), then shipped 107 Vitest unit tests covering the
instruction model, the document session's undo/redo, and pure `lib/` logic
- deliberately not the export pipeline/persistence/components, which stay
covered by the existing Playwright driver instead (see
[phase-2/plans/task-20-automated-testing-plan.md](./phase-2/plans/task-20-automated-testing-plan.md)
for the full scope reasoning) - and wired `npm test` into CI. Task 21
(Build Responsive Layouts) was run as an audit first - a lot of mobile
handling had already landed opportunistically in earlier tasks - and found
and fixed three real narrow-viewport overflow bugs, plus reclaimed canvas
room right above the desktop breakpoint (see
[phase-2/progress/task-21-responsive-layouts.md](./phase-2/progress/task-21-responsive-layouts.md)).
Task 22 (Add Accessibility Features) was also run audit-first (an axe-core
scan plus a manual keyboard walkthrough, scoped with the user beforehand)
and fixed a WCAG color-contrast failure, a missing form label, and two real
keyboard-reachability gaps - no keyboard way to reorder a step, and no
keyboard way to select a token at all - the latter found by reading the
code before the audit even started, not by either the plan or axe-core
(see [phase-2/progress/task-22-accessibility-features.md](./phase-2/progress/task-22-accessibility-features.md)).
Task 23 (Convert to PWA) added a hand-written offline service worker (no
new dependency, per the minimal-dependency groundwork Phase 1 already
committed to) and the app icons the manifest had been waiting on since
Phase 1 - and, verified against a real production build rather than just
the dev server, caught and fixed two real service-worker bugs (a reload
that crashed outright, and a cache that silently never wrote anything)
before either ever shipped (see
[phase-2/progress/task-23-pwa.md](./phase-2/progress/task-23-pwa.md)).
A 2026-09-14 `/improve-codebase-architecture` review then surfaced four more
candidates against that same task 23 work; all four were validated against
the actual source and resolved the same day - an intent-level
`moveStepUp`/`moveStepDown` seam replacing a leaky splice-index primitive in
`state/document.ts`, a Vitest guardrail catching future drift between the
exported SVG's style-baking allowlist and the stylesheet it describes, and
splitting `public/sw.js`'s routing policy out from its cache-mechanics glue
(the fourth candidate, `InstructionCanvas.tsx`, needed no remediation - see
[phase-2/progress/architecture-2026-09-14-review-remediation.md](./phase-2/progress/architecture-2026-09-14-review-remediation.md)).
Task 24 (Optimize Performance) ran the same audit-first way: the production
bundle (66.86 kB JS / 21.70 kB gzip) was already trivially under the plan's
load-time criterion, so that needed no work, and a source-grounded hot-spot
survey found and fixed one real issue - the drag-and-drop pointer-event
path did an unthrottled DOM hit-test and signal write on every raw
`pointermove`, forcing a full canvas re-render even while hovering the same
slot - via `requestAnimationFrame`-batching in the shared `lib/
pointer-drag.ts` tracker plus a drop-target equality guard. A second
finding (the canvas/step list re-rendering wholesale on any edit anywhere
in the document) was investigated further and found to need a real rework
of the canvas layout algorithm to fix properly, for a saving judged
negligible at this app's actual scale - deferred, not fixed; see
[phase-2/progress/task-24-performance.md](./phase-2/progress/task-24-performance.md)
and [known-issues.md](./known-issues.md#full-canvasstep-list-re-render-on-any-edit-anywhere-in-the-document).
With task 24 done, all 20 of Phase 2's tasks (5-24) are complete.

**Phase 3 was reprioritized and scoped with the user on 2026-09-14** (see
the note in [project-plan.md](./project-plan.md#implementation-plan)).
Phase 3 is no longer "Generic Instruction Framework" - it's now "Recipe
Content & Launch": build the recipe domain out fully (a much larger icon
library, aligned sample content, a UI polish pass) and get it in front of
real users, before investing in generalizing to a second domain. The
original Phase 3 work (content packs, a theme system, second-domain
validation) moves to Phase 4, now "Generalize," alongside its own original
stretch/optional tasks. Per this file's own "Documentation status
conventions" below, [phase-2/progress/README.md](./phase-2/progress/README.md)
is frozen as HISTORICAL as of this edit, and
[phase-3/progress/README.md](./phase-3/progress/README.md) takes over as
the CURRENT progress log. Tasks 25-27 shipped the same day: the icon
library grew from 12 recipe icons to a curated "v1" list of 55 (18 actions,
28 objects, 9 tools), verified with a real browser-driven check of
`TokenPicker`'s category tabs (see
[phase-3/progress/tasks-25-26-icon-library.md](./phase-3/progress/tasks-25-26-icon-library.md));
and an inline document-title field in the toolbar closed the
every-export-collides-on-filename gap tracked in known-issues.md since
task 18, also syncing the browser tab title so Export PDF's "Save as PDF"
dialog suggests a matching filename (see
[phase-3/progress/task-27-document-title-ui.md](./phase-3/progress/task-27-document-title-ui.md)).
Task 28 (UI Polish Pass) was scoped with the user first, then shipped a
"New document" action (there was previously no way to start fresh short of
clearing browser storage), a plainer toolbar tagline, and a general
audit-first visual/responsive sweep - deliberately excluding the two
accessibility gaps already tracked in known-issues.md, kept deferred. The
new confirm dialog this needed was built by extracting a shared
`useConfirmDialogFocusTrap` hook out of the existing `ImportConfirmDialog`
rather than duplicating its keyboard-focus logic a second time (see
[phase-3/progress/task-28-ui-polish-pass.md](./phase-3/progress/task-28-ui-polish-pass.md)).
A same-day `/mattpocock-skills:improve-codebase-architecture` review (see
[phase-3/audits/2026-09-14-architecture-review.html](./phase-3/audits/2026-09-14-architecture-review.html))
surfaced five candidates; discussed with the user before acting, three
were fixed the same day - `app.tsx`'s export/import orchestration moved
to `lib/document-actions.ts` (keeping this codebase's existing convention
that `lib/` modules never write UI state directly, and picking up 3 new
Vitest tests along the way), `useConfirmDialogFocusTrap` tightened from
raw refs to ready-to-spread prop bags, and a known-issues.md entry
sharpened - one (collapsing the tab-strip duplicated across `TokenPicker`
and `TokenAttachmentPicker`) was deliberately deferred to Phase 4 task 32
with that concrete trigger recorded rather than left vague, since it's a
pure internal-cohesion change with zero effect on the recipe builder real
users are about to test. Verifying the `app.tsx` extraction also caught
and fixed a genuine, unrelated flaky check in the Playwright driver itself
(see
[phase-3/progress/architecture-2026-09-14-review-remediation.md](./phase-3/progress/architecture-2026-09-14-review-remediation.md)).
A final pre-launch pass (also 2026-09-14, ahead of task 29) audited the
whole repo's file/docs hygiene - a stale root README still describing
Phase 1 was rewritten to point at this file instead, and a vestigial
`tests/` folder was removed - and ran a critical UI review, shipping six
polish fixes: a CSS grid layout bug that left "Add to token" stranded
below a large empty gap (and the canvas panel artificially tall) is fixed,
the toolbar's 5 export/import buttons now read as one visually grouped
tray, durations display as "1h 30m" instead of "01h-30m-00s" everywhere
one shows (including exported files), the incomplete-step "!" badge no
longer appears on an untouched step before the user has added anything,
and the document-title field has stronger contrast. Two further
mobile-only findings were tracked rather than fixed - see
[phase-3/progress/pre-launch-file-and-ui-audit.md](./phase-3/progress/pre-launch-file-and-ui-audit.md)
and [known-issues.md](./known-issues.md#mobile-layout-order-buries-the-canvas-below-an-empty-token-details-placeholder).
Task 29 (Publish MVP) shipped the same day: the Vercel CLI was installed
and authenticated (`vercel whoami` confirmed the account independently,
not just the CLI's own success message), a
[vercel.json](../vercel.json) added a Content-Security-Policy plus 5 other
security headers scoped to what the app actually needs - grep-verified
against the source first rather than guessed, e.g. `'unsafe-inline'` in
`style-src` only because `DragGhost` sets one inline `style` attribute,
and `blob:` in `img-src` only because PNG export loads its serialized SVG
through an `<img>` via `URL.createObjectURL` (`lib/svg-export.ts`). The
project was linked (`p-leidel/instruction_builder`) and deployed via
`vercel deploy` - Vercel assigns a brand-new project's first deployment to
production automatically, so this went live immediately rather than as a
preview - at <https://instructionbuilder-seven.vercel.app>. Verified
against the live URL in a real headless browser, not just a 200 response:
all 6 headers confirmed present via `curl -I`, zero console/CSP-violation
errors, the service worker registers and activates, the manifest loads,
and - the one path that specifically exercises the CSP's `blob:`
allowance - Export PNG completes end-to-end (a real downloaded file, not
just a click). Git-based push-to-deploy is also connected now - a GitHub
Login Connection alone wasn't sufficient (Vercel's separate GitHub App
also needed repo access, installed via the dashboard's Connect Git
Repository flow) - confirmed by querying the Vercel API directly for the
project's `link` object rather than trusting the CLI's "already
connected" message alone. Every push to `main` now triggers an automatic
production deployment. A same-day follow-up (2026-09-15) ran a fresh,
unbiased architecture review scoped specifically to the canvas
(`InstructionCanvas.tsx`/`lib/canvas-layout.ts`), deliberately ignoring
everything already tracked as deferred, and reconsidering whether
`InstructionCanvas.tsx` (cleared with no remediation on 2026-09-14) still
held up. It deepened `canvas-layout.ts`: `computeCanvasLayout` is now the
module's whole interface - each step's chip positions, connector paths,
and centering offset all come back on its `StepLayout`, so
`InstructionCanvas` never calls a geometry primitive directly mid-render -
while deliberately keeping `insertionMarkerPosition` as its own seam,
since it depends on live drag state at a much higher rate than the
document itself. See
[phase-3/progress/architecture-2026-09-15-canvas-deepening.md](./phase-3/progress/architecture-2026-09-15-canvas-deepening.md).
A further same-day UX rework, worked through via
`/mattpocock-skills:grilling`, moved step management off the standalone
`StepList` side panel entirely and onto the canvas: `StepList` is deleted,
and each step card in `InstructionCanvas.tsx` now shows its own title, a
left-edge drag-to-reorder handle plus click-only move up/down buttons, a
remove button, and a dashed "+ Add step" row rendered inside the SVG past
the last step. See
[phase-3/progress/step-management-moved-to-canvas.md](./phase-3/progress/step-management-moved-to-canvas.md).
A second same-day rework, via `/mattpocock-skills:grill-with-docs`, folded
the standalone `TokenAttachmentPicker` ("Add to token", right column) into
`TokenDetails`'s own "Attachments" section the same way: the panel is
deleted, and Quantity/Warning now render as two always-visible rows (no
tabs), each letting an already-attached value be changed directly without
removing it first. See
[phase-3/progress/token-attachments-folded-into-token-details.md](./phase-3/progress/token-attachments-folded-into-token-details.md).
A further `/mattpocock-skills:improve-codebase-architecture` pass
(2026-09-16) targeted what those two reworks grew - `InstructionCanvas.tsx`
and `state/document.ts` - and, via `/mattpocock-skills:grilling`, picked
two of its four candidates: `resolveTokenPointerOutcome`, a new function in
`lib/pointer-drag.ts` naming the two-stage select/drag decision that used
to be hand-rolled inline (and duplicated) across two of
`InstructionCanvas.tsx`'s `onDrop` closures, and deleting
`attachToSelectedToken` from `state/document.ts`, a wrapper whose only
callers already had `step`/`token` in scope. See
[phase-3/progress/architecture-2026-09-16-review-remediation.md](./phase-3/progress/architecture-2026-09-16-review-remediation.md).
The same day, on request, a step's Title and a token's Title were capped at
50 characters and a step's Details and a token's Notes at 249, via a plain
`maxLength` prop on each field. See
[phase-3/progress/title-and-description-max-length.md](./phase-3/progress/title-and-description-max-length.md).
While task 30 (Test Real Users) is underway, a 2026-09-17 pass picked up
the 2026-09-15 canvas-followup review's other candidate - the six
hand-rolled keyboard-activatable SVG `<g role="button">` blocks in
`InstructionCanvas.tsx` - deliberately choosing it over the mobile-layout
known-issue also on the table, since it's a zero-UI-impact refactor safe
to ship while real users are mid-session. All six now share one new
`SvgButton` component, and the Playwright driver gained Enter/Space
keyboard coverage for the four sites it previously only clicked. See
[phase-3/progress/architecture-svgbutton-extraction.md](./phase-3/progress/architecture-svgbutton-extraction.md).
The same day, task 30 produced its first real batch of user feedback: five
items settled via `/mattpocock-skills:grilling` before any code changed -
the document title gained a 50-char cap it never had, Token Title's cap
dropped from 50 to 18, a step's own duration moved from an external
reserved gap above its card to inline before its title (removing that
reservation entirely, so the canvas gets more compact rather than just
visually rearranged), Token details' read-only icon-description line was
removed as redundant with the user's own Notes field and deleted as dead
code, and a scrollbar-triggered desktop layout shift was fixed with a
`scrollbar-gutter: stable` scoped to the same `min-width: 800px` breakpoint
as the `vw`-based grid columns it protects (an unscoped first attempt broke
the existing mobile-overflow regression guard). See
[phase-3/progress/task-30-user-feedback-fixes.md](./phase-3/progress/task-30-user-feedback-fixes.md).
A second same-day feedback batch targeted Token details' Token time/Quantity
pair: their "TOKEN TIME"/"QUANTITY" labels were removed as redundant with
the fields' own controls, and "+ Quantity" moved inline next to "+ Time" in
a new `TimeAndQuantityRow` wrapper that also makes the two fields mutually
exclusive while editing (opening one closes the other, via a single
`openField` state lifted above both). See
[phase-3/progress/task-30-user-feedback-fixes-2.md](./phase-3/progress/task-30-user-feedback-fixes-2.md).
A third same-day pass followed up: putting Token time and Quantity in one
row had introduced a reflow bug (opening either one's inline edit form
shoved the other's collapsed button around) and surfaced a pre-existing
`DurationField` bug (its four day/hour/minute/second inputs don't fit on
one line at the sidebar's actual width - also true of Step details' own
Token time, not just the paired row). Both moved to a new `FieldPopover` -
a small floating panel anchored below their trigger button, extending
`useConfirmDialogFocusTrap`'s keyboard pattern - instead of expanding in
place, removing the edit form from document flow entirely. See
[phase-3/progress/task-30-user-feedback-fixes-3.md](./phase-3/progress/task-30-user-feedback-fixes-3.md).
A same-day architecture pass then deepened two of that work's own
follow-on candidates together, via `/mattpocock-skills:grilling`:
`DurationField`/`QuantityRow`'s duplicated collapsed/popover chrome moved
into one shared `CollapsedField<T>` module (each field now supplies only
its own value display and a small `DurationForm`/`QuantityForm`), and
`QuantityRow`'s best-effort `splitQuantity` reverse-parse was replaced by a
new `QuantityAttachment` storing `amount`/`unit` as structured fields,
mirroring how `DurationAttachment` already carries its raw `seconds`
alongside its formatted label. See
[phase-3/progress/architecture-2026-09-17-collapsedfield-and-structured-quantity.md](./phase-3/progress/architecture-2026-09-17-collapsedfield-and-structured-quantity.md).
A fourth same-day feedback pass followed immediately: the collapsed
button's text, now driven uniformly by `CollapsedField`'s `label` prop,
read "+ Token time" - shortened back to "+ Time" (`StepDetails`/
`TokenDetails` now pass `label="Time"` to `DurationField`, matching its
own doc comment), which also let "+ Time" and "+ Quantity" fit on one line
in `TimeAndQuantityRow` without wrapping, fixing a second report for free.
See
[phase-3/progress/task-30-user-feedback-fixes-4.md](./phase-3/progress/task-30-user-feedback-fixes-4.md).
A fifth same-day pass, settled via `/mattpocock-skills:grill-me`, covered
three reports about the canvas heading: it now mirrors
`document.value.meta.title` read-only (matching the browser tab) instead of
a static "Instructions" label, gained a document-level total time
(`sumDurations` over every step's `stepDisplayedTime`) rendered as
`{time} - {title}` the same way a step's own duration already renders next
to its title, and the canvas backdrop was capped to the SVG's actual width
at wide viewports instead of overflowing to its right - catching and fixing
a CSS Grid shrink-to-fit sizing bug in the first cap attempt during
verification, before the user ever saw it. See
[phase-3/progress/task-30-user-feedback-fixes-5.md](./phase-3/progress/task-30-user-feedback-fixes-5.md).
A sixth same-day pass, also grilled first, made `StepDetails`' "Tokens in
this step" list - kept only as a keyboard-accessibility affordance, since
the canvas's own token chips are pointer/touch-only - collapse into a
native `<details>`/`<summary>`, collapsed by default and resetting per
step, so live-adding tokens to a step no longer pushes Token details down
the column. See
[phase-3/progress/task-30-user-feedback-fixes-6.md](./phase-3/progress/task-30-user-feedback-fixes-6.md).
A same-day external audit evaluation (two documents dropped into
`phase-3/reviews/check/` from a source external to this project) was
independently re-verified against source rather than trusted at face
value - no incorrect claims found, two small doc-only fixes applied
directly, and a big/medium/small remediation plan produced; see
[phase-3/reviews/2026-09-17-external-audit-evaluation.md](./phase-3/reviews/2026-09-17-external-audit-evaluation.md).
Its first medium item was picked up the same day, scoped via
`/mattpocock-skills:grilling`: `TokenPicker`'s category switcher, a
half-implemented `role="tablist"`/`role="tab"` since 2026-09-14, is now
`role="radiogroup"`/`role="radio"` - a closer semantic fit than completing
the tabs pattern, since it filters one grid rather than showing
independent tabbed content - with real wrapping Left/Right arrow-key
navigation. Running the full Playwright driver for this (the first full
run in a while - see the audit evaluation's own note that dependencies
weren't installed to run it earlier) also surfaced and fixed an unrelated
stale check, `TOKEN_SELECTED_VIA_KEYBOARD`: a driver bug from the
`<details>` collapse rework in the paragraph above (it never opened the
`<summary>` before trying to focus content inside it), not a product
regression - confirmed by driving the real keyboard path directly. See
[phase-3/progress/accessibility-tokenpicker-radiogroup.md](./phase-3/progress/accessibility-tokenpicker-radiogroup.md).
A seventh same-day feedback pass, settled via `/mattpocock-skills:grill-me`
(a full 12-question design-tree interview across several rounds), covered
two unrelated reports: token time was inflating a step's size the same way
step time once did, fixed the same way - `canvas-layout.ts`'s per-row
time-label band is now reserved unconditionally instead of only for rows
with a timed token - and PDF export broke across multiple pages (a step
could be cut in half at a page boundary, and a stray blank page could
appear). A live diagnostic confirmed CSS pagination can't fix this: every
step is a `<g>` inside one shared `<svg>`'s own paint, never a block box in
document flow, so `break-inside`/`page-break-*` has no boundary to see.
The fix replaces `window.print()` with a real generated PDF - jsPDF +
svg2pdf.js, DIN A4 (this app's target audience is European), reusing the
same hidden export canvas SVG/PNG export already build - paginated by a
new pure `lib/pdf-pagination.ts` that greedily packs whole steps per page
and never splits one. This pulls Phase 4 task 37 (Add Vector PDF Export
(Stretch)) forward a full phase early, since no print-CSS fix could have
satisfied "never cut a step" for content painted inside one shared SVG.
Verified with 6 new pagination unit tests plus a live Playwright run
against an 18-step document (3 correctly-paginated pages, down from the
`window.print()` baseline's 4 with a blank leading page and two steps cut
mid-card). See
[phase-3/progress/task-30-user-feedback-fixes-7.md](./phase-3/progress/task-30-user-feedback-fixes-7.md).
An eighth same-day pass responded to a direct icon-library expansion
request (not a bug report): up to 12 new generic action tokens and up to
15 new ingredient tokens, using a placeholder icon where no relevant one
exists. Settled via `/mattpocock-skills:grill-me` after two rounds of
sub-agent fact-finding against Lucide's actual ~2,098-icon set (rather
than guessing which words would resolve to a real icon). 12 actions
shipped, all with distinct real icons: Add, Remove, Wait, Turn, Attach,
Detach, Repeat, Measure, Open, Close, Check, Adjust - generic instruction
verbs, not cooking techniques, distinct from the existing 18 `action.*`
tokens. 15 ingredients shipped too, but real icon coverage turned out thin
- only Cherry, Chicken, Ham, and Wheat (which reuses Flour's existing
`wheat` icon) had a literal Lucide match; Rice, Pasta, Butter, Honey,
Chocolate, Mushroom, Corn, Avocado, Cucumber, Cabbage, and Yogurt reuse the
same shared `genericFood` fallback already used for Garlic/Tomato/Potato/
Cheese/Bread/Salt/Pepper/Sugar, per the user's own explicit
"use placeholders" instruction, rather than substituting in prepared
dishes/drinks that happened to have better icon coverage. See
[phase-3/progress/task-30-user-feedback-fixes-8.md](./phase-3/progress/task-30-user-feedback-fixes-8.md).
A ninth same-day pass added copy/paste for tokens, settled via
`/mattpocock-skills:grill-with-docs` - the first pass to run
`domain-modeling` alongside `grilling`, adding a new "Token clipboard" entry
to `CONTEXT.md` (previously just the pre-existing "Document session" one). A
new `copiedToken` signal on the document session holds a full copy of one
token (fresh id, all attachments included); `copyToken`/`pasteToken` are two
new session actions, reachable via a Copy button in `TokenDetails`' header,
a Paste button in `StepDetails`' header (split across the two panels since
Paste targets the selected step, not the selected token, and must stay
reachable with no token selected), and global `Ctrl+C`/`Ctrl+V` shortcuts
that skip text inputs so native text copy/paste keeps working. See
[phase-3/progress/task-30-user-feedback-fixes-9.md](./phase-3/progress/task-30-user-feedback-fixes-9.md).
A tenth same-day pass gave `StepDetails`/`TokenDetails` a selected-state
border matching the canvas's own selected-step highlight (same
`var(--color-accent)` color, same 1px thickness): a `.step-details
--selected`/`.token-details--selected` modifier class, mutually exclusive
by construction - StepDetails carries it only while a step is selected
with no token also selected, TokenDetails' one "editing" render branch
only ever renders once a token is. See
[phase-3/progress/task-30-user-feedback-fixes-10.md](./phase-3/progress/task-30-user-feedback-fixes-10.md).
A 2026-09-18 whole-codebase health review then checked the six preceding
remediation commits for regressions (none found) and re-graded every issue
already tracked in known-issues.md on the same severity scale as its own
fourteen new findings, so the two lists can be read together - archived at
[phase-3/audits/2026-09-18-architecture-review.html](./phase-3/audits/2026-09-18-architecture-review.html).
Two of its recommendations were taken before task 30's tablet round starts,
settled via `/mattpocock-skills:grill-me` across five rounds: the Playwright
driver now also drives 768x1024 and 1024x768 (the band between phone and
desktop was never exercised, and 768px portrait gets the *mobile* layout
while 1024px landscape gets the desktop one), and the field popover's
placement arithmetic moved into a new pure `lib/field-placement.ts`. That
extraction also added the vertical flip the panel never had, re-placement on
resize/rotation, and - closing a contradiction the review named - dropped
the Tab trap that `aria-modal="false"` had always denied was there.
`CollapsedField` stopped writing local editing state while controlled in the
same pass. The tablet viewports were deliberately committed *first*, so a
pre-existing 768px problem could be told apart from one the placement change
introduced; that baseline came back clean. See
[phase-3/progress/architecture-2026-09-18-field-placement-and-tablet-viewports.md](./phase-3/progress/architecture-2026-09-18-field-placement-and-tablet-viewports.md).
A second batch from the same review followed, also before the tablet
round, this time working the review's ten open findings and the four
non-accepted items already in `known-issues.md` as **one** list on one
severity scale rather than two graded separately: `docs/adr/` now exists
with [three entries](./adr/README.md) (the review asked for it by name,
because its own consolidation suggestion had been re-raised by two
successive reviews with nothing recording the answer); every export defers
its object-URL revoke and attaches the download anchor, the one code path
behind all four formats and the likeliest way an iPhone tester reports
"nothing happens when I export"; the confirm dialogs became modal in
declaration as well as behaviour (`aria-modal`, `inert` behind them, focus
returned to the opener) with their hand-rolled two-button Tab cycle
deleted rather than kept alongside; and the mobile layout stopped burying
the canvas below an empty Token details placeholder. That batch also found
three problems the report hadn't: Escape silently stopped closing the
dialogs once focus could leave them, the opener can't be read from
`document.activeElement` because `inert` blurs it first, and the hidden
export canvas had been a keyboard tab stop on every page view since task
15. Eight findings and two documentation corrections remain, tracked in
[known-issues.md](./known-issues.md#documentation-debt-from-the-2026-09-18-codebase-health-review)
rather than only inside the report - along with a correction to the report
itself, whose finding 5 overstates the PDF chunk's download cost. See
[phase-3/progress/architecture-2026-09-18-modal-dialogs-and-mobile-layout.md](./phase-3/progress/architecture-2026-09-18-modal-dialogs-and-mobile-layout.md).

This file is the single source of truth for "what phase are we in" -
update it whenever a task's status changes, rather than letting that
information live only in scattered per-file mentions (which is exactly
what made an earlier independent review's status hard to pin down before
this file existed).

## Phase 1: Concept Validation — ✅ Complete

| # | Task | Status |
|---|---|---|
| 1 | Define Instruction Model | ✅ |
| 2 | Design User Experience | ✅ |
| 3 | Create Wireframes | ✅ |
| 4 | Build Project Foundation | ✅ |

Exit criterion met: an in-memory clickable prototype validated the
interaction model. See [phase-1/status-report.md](./phase-1/status-report.md).

## Phase 2: MVP — ✅ Complete (20 of 20 tasks)

| # | Task | Status |
|---|---|---|
| 5 | Create UI Layout | ✅ |
| 6 | Implement Instruction Canvas | ✅ |
| 7 | Build Icon Library | ✅ |
| 8 | Create Live Preview | ✅ |
| 9 | Add Drag-and-Drop System | ✅ |
| 10 | Implement Touch Support | ✅ |
| 11 | Add Tap-to-Insert System | ✅ (carried over from Phase 1's `TokenPicker`, never needed rework) |
| 12 | Build Data Persistence | ✅ |
| 13 | Implement Undo/Redo | ✅ |
| 14 | Implement Visual Validation | ✅ (the two rules already covered by the Phase 1 stub turned out to be the full applicable rule set; [phase-1/architecture.md](./phase-1/architecture.md)'s third rule, a numeric quantity `metadata` check, is superseded - not simply dropped - now that Quantity is a `TokenAttachment` with a fused display label rather than a token with numeric metadata - see below) |
| 15 | Develop SVG Export | ✅ (also lifted the canvas's layout math into `lib/canvas-layout.ts`, per an external audit - see below) |
| 16 | Develop PNG Export | ✅ (rasterizes the same SVG pipeline via an offscreen `<canvas>`, 2x pixel density) |
| 17 | Implement Print/PDF Export | ✅ (baseline tier shipped as `window.print()` + `@media print`, per plan; **superseded 2026-09-17** by task 37's vector PDF pulled forward early, once fixing a real multi-page bug report required it - see below) |
| 18 | Implement JSON Export | ✅ (built ahead of 15–17, on request) |
| 19 | Create Import System | ✅ (built ahead of 15–17, on request) |
| 20 | Add Automated Testing | ✅ (Vitest, 107 tests over the instruction model/document session/pure `lib/` logic; export pipeline/persistence/components deliberately left to the Playwright driver - see [phase-2/plans/task-20-automated-testing-plan.md](./phase-2/plans/task-20-automated-testing-plan.md)) |
| 21 | Build Responsive Layouts | ✅ (audit-first pass; found and fixed 3 real overflow bugs plus a desktop-breakpoint canvas-crowding improvement - see [phase-2/progress/task-21-responsive-layouts.md](./phase-2/progress/task-21-responsive-layouts.md)) |
| 22 | Add Accessibility Features | ✅ (audit-first pass with axe-core + a manual keyboard walkthrough; fixed a WCAG contrast failure, a missing form label, and keyboard-reachability gaps for step reorder and token select - see [phase-2/progress/task-22-accessibility-features.md](./phase-2/progress/task-22-accessibility-features.md)) |
| 23 | Convert to PWA | ✅ (hand-written service worker, no new dependency; app icons; caught and fixed 2 real SW bugs before shipping - see [phase-2/progress/task-23-pwa.md](./phase-2/progress/task-23-pwa.md)) |
| 24 | Optimize Performance | ✅ (audit-first; bundle size already well under the load-time criterion; fixed an unthrottled drag hit-test/re-render path, investigated and deferred a whole-document re-render finding - see [phase-2/progress/task-24-performance.md](./phase-2/progress/task-24-performance.md)) |

Exit criterion met: a complete instruction editor with saving, exporting,
and mobile support, per the plan's own definition of Phase 2 (see
[project-plan.md](./project-plan.md#implementation-plan)) - every task
audited/verified as it landed rather than assumed done, per this file's own
per-task notes above. This file's "Documentation status conventions"
section below calls for freezing
[phase-2/progress/README.md](./phase-2/progress/README.md) as HISTORICAL
and starting a `phase-3/progress/README.md` the day a phase's exit criteria
are met and the next phase is scoped - done in this edit, now that Phase 3
has been reprioritized and scoped with the user (see above).

See [phase-2/progress/README.md](./phase-2/progress/README.md) for what actually
shipped in tasks 5–24, plus product additions beyond the
original task list (step titles/details, per-token descriptions, two-stage
step/token selection, connector lines, the live drag insertion marker, a
CSS design-token visual refresh, and token/step attachments - a validated
Quantity amount+unit, a Warning, and an independent Step/Token duration
shown centered above each step). See [fixed-issues/README.md](./fixed-issues/README.md)
for bugs found and fixed along the way (none currently open against this
work) and [known-issues.md](./known-issues.md) for what's deliberately
deferred - including a new one from task 18: every export format downloads
as "untitled-instructions.\<ext\>" because no UI lets the user set
`meta.title` yet.

## Phase 3: Recipe Content & Launch — In progress (5 of 7 tasks)

| # | Task | Status |
|---|---|---|
| 25 | Expand Recipe Icon Library (curated v1) | ✅ |
| 26 | Expand Sample/Starter Tokens | ✅ |
| 27 | Add Document Title UI | ✅ |
| 28 | UI Polish Pass | ✅ |
| 29 | Publish MVP | ✅ (live at <https://instructionbuilder-seven.vercel.app>) |
| 30 | Test Real Users | In progress ([first](./phase-3/progress/task-30-user-feedback-fixes.md), [second](./phase-3/progress/task-30-user-feedback-fixes-2.md), [third](./phase-3/progress/task-30-user-feedback-fixes-3.md), [fourth](./phase-3/progress/task-30-user-feedback-fixes-4.md), [fifth](./phase-3/progress/task-30-user-feedback-fixes-5.md), [sixth](./phase-3/progress/task-30-user-feedback-fixes-6.md), [seventh](./phase-3/progress/task-30-user-feedback-fixes-7.md), [eighth](./phase-3/progress/task-30-user-feedback-fixes-8.md), [ninth](./phase-3/progress/task-30-user-feedback-fixes-9.md), and [tenth](./phase-3/progress/task-30-user-feedback-fixes-10.md) feedback passes shipped, plus a [2026-09-18 health review and the field-placement seam it recommended](./phase-3/progress/architecture-2026-09-18-field-placement-and-tablet-viewports.md) and [that review's second remediation batch](./phase-3/progress/architecture-2026-09-18-modal-dialogs-and-mobile-layout.md); testers work through [manual-testing-checklist.md](./manual-testing-checklist.md)) |
| 31 | Refine UX | Not started |

See [phase-3/progress/README.md](./phase-3/progress/README.md) for detail
as these tasks ship.

## Phase 4: Generalize — Not started

| # | Task | Status |
|---|---|---|
| 32 | Formalize the Content-Pack Shape | Not started |
| 33 | Build & Validate a Second Domain | Not started |
| 34 | Build In-App Domain Switcher UI | Not started |
| 35 | Create Theme System | Not started |
| 36 | Continue Icon Library Expansion | Not started |
| 37 | Add Vector PDF Export (Stretch) | ✅ (shipped early, from Phase 3 - see [phase-3/progress/task-30-user-feedback-fixes-7.md](./phase-3/progress/task-30-user-feedback-fixes-7.md)) |
| 38 | Add Basic Gamification (Optional) | Not started |
| 39 | Prepare Future Expansion | Not started |

---

Full task descriptions live in
[project-plan.md](./project-plan.md#step-by-step-project-tasks).
This file exists so "what phase are we actually in" has one answer instead
of needing to be reconciled across several docs.

## Documentation status conventions

Every doc in `docs/` carries a one-line status banner directly under its
title, using exactly one of two labels, so nobody has to read a doc's body
to find out whether it still describes the real app:

- **📌 CURRENT** — actively trusted. Either a *living* doc that gets
  updated in the same change that makes it stale (this file,
  [known-issues.md](./known-issues.md), [fixed-issues/README.md](./fixed-issues/README.md),
  [planned-additions.md](./planned-additions.md),
  [manual-testing-checklist.md](./manual-testing-checklist.md), and whichever
  `phase-N/progress/README.md` covers the in-progress phase), or a *reference*
  doc that doesn't change per-task but whose content is still accurate
  ([project-plan.md](./project-plan.md)).
- **🗄️ HISTORICAL — superseded** — a frozen snapshot of a completed phase.
  It stops being edited the day that phase closes out, is dated with the
  freeze date, and links back here for what's actually true now. Nothing
  under `phase-1/` is edited anymore for this reason.

**The rule going forward:** the day a phase's exit criteria are met, that
phase's `progress/README.md` gets its banner flipped from CURRENT to
HISTORICAL (dated), and a new `phase-N+1/progress/README.md` is created,
banner-marked CURRENT, and linked from the relevant phase table above in
the same edit that marks the old phase's tasks ✅ here. That keeps exactly
one Progress Log CURRENT at any time, instead of letting several
phase logs quietly go stale side by side.

## Documentation naming conventions

Every file and folder under `docs/` is lowercase kebab-case, named for what
it's for (e.g. `known-issues.md`, `fixed-issues/`, `phase-2/plans/`) - never
a generic label, and never the product name repeated in the filename. A doc
that's too big to read comfortably in one piece gets split into a folder
along whatever seam the content already has (one file per bug in
`fixed-issues/`, one file per task in each phase's `progress/`), with a
`README.md` in that folder acting as the index other docs link to. One-off
dated documents (a code review, an external audit) live in a subfolder named
for what kind of document it is (`phase-N/reviews/`, `phase-N/audits/`), not
loose in the phase folder. When a doc moves or is renamed, every link to it
- across `docs/`, source comments, and every other file in the repo - gets
updated in the same change, so links never go stale; nothing here is kept
around as a compatibility redirect.
