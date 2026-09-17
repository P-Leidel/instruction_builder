// Playwright driver for the Visual Instruction Builder dev app.
// Usage: node driver.mjs <screenshot-output-dir> [devServerUrl]
//
// Assumes the Vite dev server is already running (see SKILL.md for the
// exact start/poll commands) - this script only drives the browser.
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const OUT = process.argv[2];
const URL = process.argv[3] ?? "http://localhost:5173/";

if (!OUT) {
  console.error("Usage: node driver.mjs <screenshot-output-dir> [devServerUrl]");
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on("console", (msg) => { if (msg.type() === "error") errors.push(`[console] ${msg.text()}`); });
page.on("pageerror", (err) => errors.push(`[pageerror] ${err.message}`));

// Task 22 (Add Accessibility Features): an axe-core scan at a few
// representative states, not just one at page load - a rule violation can
// be specific to a state that only exists after some interaction (the
// Import dialog, task 22's own color-contrast bug only showed up once a
// token category tab was active). `axe.min.js` is read once and injected
// fresh per scan via addScriptTag, matching how docs/fixed-issues/
// accent-color-failed-contrast-minimum.md and
// import-file-input-had-no-accessible-label.md were originally found.
// `fileURLToPath`, not `new URL(..., import.meta.url)` - this file's own
// top-level `URL` constant (the dev server URL, from argv) shadows the
// global URL constructor throughout this whole module.
const axeSource = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../node_modules/axe-core/axe.min.js"),
  "utf-8",
);
async function countAxeViolations(label) {
  await page.addScriptTag({ content: axeSource });
  const results = await page.evaluate(() => window.axe.run(document, { resultTypes: ["violations"] }));
  if (results.violations.length > 0) {
    errors.push(
      `[a11y:${label}] ` + results.violations.map((v) => `${v.id} (${v.nodes.length} node(s))`).join(", "),
    );
  }
  return results.violations.length;
}

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector(".instruction-canvas__svg");
await page.screenshot({ path: path.join(OUT, "01-desktop-initial.png"), fullPage: true });

// Task 15 (SVG Export) added a second, permanently-mounted, hidden,
// read-only InstructionCanvas purely for export to serialize (`App`'s
// `.app__export-canvas`) - every `.instruction-canvas__*` selector below
// would otherwise match it too (it renders the same document), so anything
// that isn't inherently unique to editing (drag insertion marker, editing
// controls that only exist when NOT read-only) is scoped through
// `editableCanvas` (`.app__main`, which the hidden export canvas lives
// outside of) rather than queried from `page` directly.
const editableCanvas = page.locator(".app__main");

// Task 13 (Undo/Redo): both buttons start disabled - a fresh document has
// nothing to undo and nothing has been undone yet to redo. Check this here,
// before the rest of the flow below makes any edits.
const undoButton = page.getByRole("button", { name: "Undo", exact: true });
const redoButton = page.getByRole("button", { name: "Redo", exact: true });
const historyButtonsDisabledInitially = (await undoButton.isDisabled()) && (await redoButton.isDisabled());

// Representative flow: name the first step, add tokens via the picker,
// select a step from the canvas badge, remove a token from the canvas.
await editableCanvas.locator(".instruction-canvas__badge").first().click();
await page.locator(".step-details__field input").fill("Chop the onion");
await page.locator(".step-details__field textarea").fill("Use a sharp knife on a stable board.");
await page.locator("body").click({ position: { x: 5, y: 5 } }); // blur the field

const picker = page.locator(".token-picker");
async function selectCategory(label) {
  await picker.getByRole("radio", { name: label, exact: true }).click();
}

// Category switcher: only the active category's tokens are in the
// DOM/visible at a time, so a real user (and this driver) must switch
// categories to reach tokens outside the default-active one ("Actions", the
// first one with samples).
const objectsTabCountBeforeSwitch = await picker.locator(".token-picker__grid").getByRole("button").count();
await picker.getByRole("button", { name: "Chop", exact: true }).click();
await selectCategory("Objects");
const objectsTabCount = await picker.locator(".token-picker__grid").getByRole("button").count();
const tabsFilterTokens = objectsTabCount !== objectsTabCountBeforeSwitch;
await picker.getByRole("button", { name: "Onion", exact: true }).click();
await selectCategory("Tools");
await picker.getByRole("button", { name: "Knife", exact: true }).click();
await selectCategory("Actions");

// Fixed 2026-09-17 (docs/known-issues.md's "TokenPicker tab roving focus"
// gap): the category switcher is role="radiogroup"/role="radio", not tabs -
// Left/Right arrow should move focus and selection together, wrapping at
// both ends, same as a native <input type="radio"> fieldset. Checked
// against real ARIA/focus state, not just a screenshot; ends back on
// "Actions" so it doesn't disturb the category the rest of this driver
// assumes is active (e.g. the "Boil" drag-and-drop below).
const actionsRadio = picker.getByRole("radio", { name: "Actions", exact: true });
const objectsRadio = picker.getByRole("radio", { name: "Objects", exact: true });
const toolsRadio = picker.getByRole("radio", { name: "Tools", exact: true });
async function isCheckedAndFocused(radio) {
  return (
    (await radio.getAttribute("aria-checked")) === "true" &&
    (await radio.evaluate((el) => el === document.activeElement))
  );
}
await actionsRadio.focus();
await page.keyboard.press("ArrowRight"); // Actions -> Objects
const arrowRightMovesSelection = await isCheckedAndFocused(objectsRadio);
await page.keyboard.press("ArrowRight"); // Objects -> Tools
await page.keyboard.press("ArrowRight"); // Tools -> wraps to Actions
const arrowRightWraps = await isCheckedAndFocused(actionsRadio);
await page.keyboard.press("ArrowLeft"); // Actions -> wraps to Tools
const arrowLeftWraps = await isCheckedAndFocused(toolsRadio);
await page.keyboard.press("ArrowLeft"); // Tools -> Objects
await page.keyboard.press("ArrowLeft"); // Objects -> Actions (restore)
const tokenCategoryArrowKeyNavWorks =
  arrowRightMovesSelection && arrowRightWraps && arrowLeftWraps && (await isCheckedAndFocused(actionsRadio));
await page.screenshot({ path: path.join(OUT, "02-desktop-after-edit.png"), fullPage: true });

// Connector lines: a plain line between each pair of consecutive tokens
// within a step (3 tokens in step 1 so far -> 2 connectors).
const connectorCount = await editableCanvas.locator(".instruction-canvas__connector").count();

// Two-stage select: add a second (unselected) step, then click one of its
// tokens - the FIRST click on an unselected step's token should select the
// step, not the token (token-details stays empty).
await editableCanvas.locator(".instruction-canvas__add-step").click();
await picker.getByRole("button", { name: "Bake", exact: true }).click();
await editableCanvas.locator(".instruction-canvas__badge").first().click(); // reselect step 1 (still has tokens)

const firstToken = editableCanvas.locator(".instruction-canvas__token").first();
await firstToken.click(); // step 1 already selected -> should select the TOKEN
const tokenTitleInput = page.locator(".token-details__field input");
const tokenSelectedAfterFirstClick = (await tokenTitleInput.count()) > 0 && (await tokenTitleInput.inputValue()) !== "";

await tokenTitleInput.fill("Chop finely");
await page.locator(".token-details__field textarea").fill("Small, even dice.");
await page.locator("body").click({ position: { x: 5, y: 5 } }); // blur
const tokenLabelUpdated = (await editableCanvas.locator(".instruction-canvas__chip-label").first().textContent()) === "Chop finely";
await page.screenshot({ path: path.join(OUT, "02b-token-details.png"), fullPage: true });

// Task 22: the canvas's own SVG token chips stay pointer/touch-only (see
// InstructionCanvas.tsx's doc comment) - StepDetails' "Tokens in this
// step" list is the keyboard-operable path to the same TokenDetails panel
// (it only renders once a step is already selected, so the canvas's
// two-stage select rule is automatically satisfied). The list lives inside
// a native <details>, collapsed by default (a same-day task 30 rework - see
// known-issues.md), so a real keyboard user reaches it by first Tab-ing to
// its <summary> and pressing Enter to open it - skipping that step used to
// make this whole check a false negative (content inside a closed
// <details> isn't focusable, so the button-focus below silently did
// nothing, `aria-current` never got set, and the flow's own actions never
// threw): confirmed by driving both paths directly before fixing this.
// Step 1 is already selected here, so its list is already present (closed);
// open it, then select its 2nd token (Onion) via keyboard and confirm
// TokenDetails opens for it and the button reflects `aria-current`, then
// click back to the 1st token (pointer) so the rest of the flow below
// continues to operate on `firstToken` as before.
const stepDetailsTokensSummary = page.locator(".step-details__tokens-disclosure summary");
await stepDetailsTokensSummary.focus();
await stepDetailsTokensSummary.press("Enter");
const secondStepDetailsTokenButton = page.locator(".step-details__token-button").nth(1);
await secondStepDetailsTokenButton.focus();
await secondStepDetailsTokenButton.press("Enter");
const tokenSelectedViaKeyboard =
  (await tokenTitleInput.count()) > 0 &&
  (await secondStepDetailsTokenButton.getAttribute("aria-current")) === "true";
await firstToken.click();

// "Attachments": Quantity and Warning attach to the selected token
// (firstToken, already selected above) - folded into Token details itself
// as two of its own fields, not a separate "Add to token" panel. Warning
// keeps its original always-visible preset-grid interaction; Quantity was
// later reworked to mirror DurationField's own collapsed/edit-toggle
// interaction instead (a "+ Quantity" button, or a value with Edit/Remove,
// expanding to a committed Save/Cancel form) - see TokenDetails.tsx's
// QuantityRow. Time is deliberately not here - see the DurationField block
// below. Verify the canvas chip grows the expected badges, Token details
// reflects both, and removing one via Token details drops it from both.
const tokenDetails = page.locator(".token-details");
// Token time and Quantity both render the shared CollapsedField chrome
// (see components/CollapsedField/CollapsedField.tsx) - `.collapsed-field`,
// `.collapsed-field__save`, etc. are ambiguous within `.token-details`
// alone, so these scope to their fixed position (Time first, Quantity
// second) within `.token-details__time-quantity-row` - see
// TokenDetails.tsx's TimeAndQuantityRow.
const tokenQuantityField = page.locator(".token-details__time-quantity-row").locator(".collapsed-field").nth(1);
await tokenDetails.getByRole("button", { name: "Sharp!", exact: true }).click();
await tokenDetails.getByRole("button", { name: "Add quantity", exact: true }).click();
const quantityAmountInput = tokenDetails.locator(".token-details__quantity-field input");
const quantityUnitSelect = tokenDetails.locator(".token-details__quantity-field select");
await quantityAmountInput.fill("250");
await quantityUnitSelect.selectOption("g");
await tokenQuantityField.locator(".collapsed-field__save").click();

const badgeCountAfterAttach = await firstToken.locator(".instruction-canvas__chip-badge").count();
const quantityAttachedAfterSave = (await tokenQuantityField.locator(".collapsed-field__value").textContent()) === "250 g";
const warningAttachmentCountAfterClick = await tokenDetails.locator(".token-details__attachment").count();
await page.screenshot({ path: path.join(OUT, "02c-token-attachments.png"), fullPage: true });

const accessibilityViolationsMainEditor = await countAxeViolations("main editor");

await tokenDetails.getByRole("button", { name: "Remove Sharp!" }).click();
const badgeCountAfterRemove = await firstToken.locator(".instruction-canvas__chip-badge").count();
const warningAttachmentCountAfterRemove = await tokenDetails.locator(".token-details__attachment").count();
const quantityStillAttachedAfterWarningRemove =
  (await tokenQuantityField.locator(".collapsed-field__value").textContent()) === "250 g";

const attachmentsWorkedEndToEnd =
  badgeCountAfterAttach === 2 &&
  quantityAttachedAfterSave &&
  warningAttachmentCountAfterClick === 1 &&
  badgeCountAfterRemove === 1 &&
  warningAttachmentCountAfterRemove === 0 &&
  quantityStillAttachedAfterWarningRemove;

// Regression test for the same bug class DurationField's `key={token.id}`
// already guards against (see DURATION_FIELD_RESETS_PER_TOKEN below):
// QuantityRow is the same component instance across a token switch (same
// position in the tree), so without a `key={token.id}` on it, starting an
// edit on one token (firstToken, which has "250 g" attached from above)
// and then switching to a *different* token without saving/cancelling
// would leave the new token's Quantity field stuck showing the old
// token's unsaved editing form instead of its own actual value (here,
// unset). Clicking Edit here also exercises the edit form pre-filling
// from the current value ("250"/"g"), same as DurationField's own
// `startEditing`.
await tokenQuantityField.locator(".collapsed-field__edit").click();
const quantityEditPrefillsFromCurrentValue =
  (await quantityAmountInput.inputValue()) === "250" && (await quantityUnitSelect.inputValue()) === "g";
await quantityAmountInput.focus();
const quantitySelectsValueOnFocus = await quantityAmountInput.evaluate(
  (el) => el.selectionStart === 0 && el.selectionEnd === el.value.length && el.value.length > 0,
);
await quantityAmountInput.fill("42");
await quantityUnitSelect.selectOption("kg");
// step 1 already selected -> selects its 2nd token (declared as `secondToken` later, reused there)
await editableCanvas.locator(".instruction-canvas__token").nth(1).click();
const quantityFormResetsPerToken =
  (await tokenDetails.locator(".token-details__quantity-form").count()) === 0 &&
  (await tokenDetails.getByRole("button", { name: "Add quantity", exact: true }).count()) === 1;
await firstToken.click(); // back to the first token for the rest of the flow

// Editing an already-attached Quantity replaces it in place (no duplicate,
// no need to Remove first) - the same "at most one of each kind, replacing
// on re-attach" invariant InstructionToken.quantity has always had (see
// model/instruction.ts), now expressed through the Edit/Save flow itself
// rather than an always-visible form. firstToken currently has "250 g"
// attached; the fresh QuantityRow mount just triggered by re-selecting it
// (above) reset back to its collapsed display, same as the token-switch
// check just above.
await tokenQuantityField.locator(".collapsed-field__edit").click();
await quantityAmountInput.fill("3");
await quantityUnitSelect.selectOption("kg");
await tokenQuantityField.locator(".collapsed-field__save").click();
const quantityValueCountAfterReplace = await tokenQuantityField.locator(".collapsed-field__value").count();
const replacedQuantityLabel = await tokenQuantityField.locator(".collapsed-field__value").textContent();
const attachedValueChangeableWithoutRemoving =
  quantityValueCountAfterReplace === 1 && // replaced in place, not a second attachment
  replacedQuantityLabel === "3 kg";

// Time: separate from Quantity/Warning - set via DurationField directly in
// Token details (a token's own time) and Step details (a step's own
// estimate, which takes precedence over its tokens' summed time when both
// are set - see stepDisplayedTime in InstructionCanvas.tsx). Verify the
// canvas's step-level duration header reflects both in turn.
const tokenDurationField = page.locator(".token-details__time-quantity-row").locator(".collapsed-field").nth(0);
await tokenDurationField.getByRole("button", { name: "Add time", exact: true }).click();
const tokenDurationInputs = tokenDurationField.locator(".duration-field__unit input");
// Select-on-focus: focusing a duration input should select its full
// contents (so overtyping doesn't require manually clearing it first) -
// checked on the still-zeroed "days" input before it's filled below.
await tokenDurationInputs.nth(0).focus();
const durationSelectsValueOnFocus = await tokenDurationInputs.nth(0).evaluate(
  (el) => el.selectionStart === 0 && el.selectionEnd === el.value.length && el.value.length > 0,
);
await tokenDurationInputs.nth(1).fill("1"); // 1 hour
await tokenDurationInputs.nth(2).fill("30"); // 30 minutes
await tokenDurationField.getByRole("button", { name: "Save time", exact: true }).click();

const stepTimeAfterTokenTime = await editableCanvas.locator(".instruction-canvas__step-time").first().textContent();
const tokenTimeMatchesSum = stepTimeAfterTokenTime === "1h 30m";

// Regression test for a bug found in manual testing: DurationField is the
// same component instance across a token switch (same position in the
// tree), so without a `key={token.id}` on it, starting an edit on one
// token and then clicking a *different* token (without saving/cancelling)
// left the new token's Time field stuck showing the old token's unsaved
// editing form instead of the new token's own value.
await tokenDurationField.getByRole("button", { name: "Edit time", exact: true }).click();
await tokenDurationInputs.nth(2).fill("59"); // change but deliberately don't save
const secondToken = editableCanvas.locator(".instruction-canvas__token").nth(1);
await secondToken.click(); // step 1 already selected -> selects its 2nd token (no time of its own)
const freshTokenDurationField = page.locator(".token-details__time-quantity-row").locator(".collapsed-field").nth(0);
const durationFieldResetsPerToken =
  (await freshTokenDurationField.locator(".duration-field__inputs").count()) === 0 &&
  (await freshTokenDurationField.getByRole("button", { name: "Add time", exact: true }).count()) === 1;
// Leave the first token re-selected and its time intact for the rest of the flow.
await firstToken.click();

const stepDurationField = page.locator(".step-details").locator(".collapsed-field");
await stepDurationField.getByRole("button", { name: "Add time", exact: true }).click();
const stepDurationInputs = stepDurationField.locator(".duration-field__unit input");
await stepDurationInputs.nth(0).fill("2"); // 2 days - an explicit step estimate
await stepDurationField.getByRole("button", { name: "Save time", exact: true }).click();

const stepTimeAfterStepTime = await editableCanvas.locator(".instruction-canvas__step-time").first().textContent();
const stepTimeOverridesTokenSum = stepTimeAfterStepTime === "2d";

// Same regression as above, for a step switch: edit step 1's time again
// without saving, then switch to step 2 - its own DurationField must show
// "Add time" fresh, not step 1's leftover unsaved edit.
await stepDurationField.getByRole("button", { name: "Edit time", exact: true }).click();
await stepDurationInputs.nth(0).fill("5"); // change but deliberately don't save
await editableCanvas.locator(".instruction-canvas__badge").nth(1).click(); // switch to step 2 (no time of its own)
const freshStepDurationField = page.locator(".step-details").locator(".collapsed-field");
const durationFieldResetsPerStep =
  (await freshStepDurationField.locator(".duration-field__inputs").count()) === 0 &&
  (await freshStepDurationField.getByRole("button", { name: "Add time", exact: true }).count()) === 1;
// Keyboard coverage (docs/phase-3/progress/architecture-svgbutton-extraction.md):
// activate via Enter/Space, not click - same SvgButton onActivate either
// way, so the resulting selection/action is identical to a click; only the
// input path differs.
async function activateViaKeyboard(locator, key) {
  await locator.focus();
  await locator.press(key);
}
await activateViaKeyboard(editableCanvas.locator(".instruction-canvas__badge").first(), "Enter"); // back to step 1 for the rest of the flow

await page.screenshot({ path: path.join(OUT, "02d-time.png"), fullPage: true });

const timeWorkedEndToEnd = tokenTimeMatchesSum && stepTimeOverridesTokenSum;

// Keyboard reachability check: Tab should be able to reach canvas controls
// (regression test for the tabindex="0" vs tabIndex="0" SVG casing bug).
const badge = editableCanvas.locator(".instruction-canvas__badge").first();
await badge.focus();
const canvasControlFocused = await page.evaluate(
  () => document.activeElement?.getAttribute("role") === "button",
);

const chipRemoves = editableCanvas.locator(".instruction-canvas__chip-remove");
if ((await chipRemoves.count()) > 0) {
  // Keyboard coverage: Space, not click - see the badge-select comment above.
  await activateViaKeyboard(chipRemoves.first(), " ");
  await page.screenshot({ path: path.join(OUT, "03-desktop-after-remove.png"), fullPage: true });
}

// Task 9 (Drag-and-Drop): drag a picker token straight onto step 2's canvas
// area - no need to pre-select it, the drop target says where it goes.
async function dragBoxToBox(fromBox, toBox) {
  await page.mouse.move(fromBox.x + fromBox.width / 2, fromBox.y + fromBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(toBox.x + toBox.width / 2, toBox.y + toBox.height / 2, { steps: 10 });
  await page.mouse.up();
}

const step1Tokens = editableCanvas.locator(".instruction-canvas__tokens").nth(0).locator(".instruction-canvas__token");
const step2Tokens = editableCanvas.locator(".instruction-canvas__tokens").nth(1).locator(".instruction-canvas__token");
const step2Bg = editableCanvas.locator(".instruction-canvas__step-bg").nth(1);

const step2CountBeforeAdd = await step2Tokens.count();
await dragBoxToBox(
  await picker.getByRole("button", { name: "Boil", exact: true }).boundingBox(),
  await step2Bg.boundingBox(),
);
const dragAddedTokenViaPicker = (await step2Tokens.count()) === step2CountBeforeAdd + 1;

// Drag an existing canvas token from step 1 onto step 2 (move between
// steps), checking the live insertion-point marker mid-drag (before
// release) - not just a whole-step highlight.
const step1CountBeforeMove = await step1Tokens.count();
const step2CountBeforeMove = await step2Tokens.count();
const moveFromBox = await step1Tokens.first().boundingBox();
const moveToBox = await step2Bg.boundingBox();
await page.mouse.move(moveFromBox.x + moveFromBox.width / 2, moveFromBox.y + moveFromBox.height / 2);
await page.mouse.down();
await page.mouse.move(moveToBox.x + moveToBox.width / 2, moveToBox.y + moveToBox.height / 2, { steps: 10 });
const insertionMarkerVisibleMidDrag = await page.locator(".instruction-canvas__insertion-marker").isVisible();
await page.mouse.up();
const tokenMovedBetweenSteps =
  (await step1Tokens.count()) === step1CountBeforeMove - 1 &&
  (await step2Tokens.count()) === step2CountBeforeMove + 1;
await page.screenshot({ path: path.join(OUT, "05-after-drag-drop.png"), fullPage: true });

// Regression test for a review finding: forward token reorder within a
// step used to overshoot by one slot, because the drop-target index (a
// pre-removal, "drop-before" position) was reinserted at that same numeric
// index after the dragged token had already been filtered out, shifting
// everything after it back by one. step2Tokens is now [Bake, Boil, "Chop
// finely"] (Bake original, Boil dragged in via the picker above, "Chop
// finely" just moved over from step 1) - drag Bake (index 0) forward onto
// "Chop finely"'s slot (index 2); drop-before semantics means Bake should
// land directly before it, i.e. [Boil, Bake, "Chop finely"], not
// [Boil, "Chop finely", Bake].
const step2LabelsBeforeForwardDrag = await step2Tokens.locator(".instruction-canvas__chip-label").allTextContents();
const forwardTokenDragFromBox = await step2Tokens.nth(0).boundingBox();
const forwardTokenDragToBox = await step2Tokens.nth(2).boundingBox();
await dragBoxToBox(forwardTokenDragFromBox, forwardTokenDragToBox);
const step2LabelsAfterForwardDrag = await step2Tokens.locator(".instruction-canvas__chip-label").allTextContents();
const forwardTokenDragLandsAtDropPoint =
  step2LabelsAfterForwardDrag.length === 3 &&
  step2LabelsAfterForwardDrag[0] === step2LabelsBeforeForwardDrag[1] && // Boil now first
  step2LabelsAfterForwardDrag[1] === step2LabelsBeforeForwardDrag[0] && // Bake lands just before "Chop finely"
  step2LabelsAfterForwardDrag[2] === step2LabelsBeforeForwardDrag[2]; // "Chop finely" unchanged, still last

// Drag step 2's canvas drag handle above step 1's card to reorder (task 9's
// step-management functionality moved from a standalone StepList panel onto
// the canvas itself - see InstructionCanvas.tsx). Drop near the TOP of step
// 1's card, not its center - the drop-index calculation compares against
// each step's vertical midpoint, so dropping exactly on a midpoint is a
// genuine boundary tie, not a realistic drag gesture.
const stepGroups = editableCanvas.locator("[data-step-index]");
// .instruction-canvas__step-title-text, not the outer __step-title text node
// itself: since the step-time relocation
// (docs/phase-3/progress/task-30-user-feedback-fixes.md), that outer node's
// textContent can include a "<time> - " prefix, which would otherwise leak
// into every title-equality check below.
const stepTitles = editableCanvas.locator(".instruction-canvas__step-title-text");
const firstSummaryBefore = await stepTitles.first().textContent();
const step2HandleBox = await stepGroups.nth(1).locator(".instruction-canvas__step-drag-handle").boundingBox();
const step1Box = await stepGroups.nth(0).boundingBox();
await page.mouse.move(step2HandleBox.x + step2HandleBox.width / 2, step2HandleBox.y + step2HandleBox.height / 2);
await page.mouse.down();
await page.mouse.move(step1Box.x + step1Box.width / 2, step1Box.y + 2, { steps: 10 });
await page.mouse.up();
let firstSummaryAfter = await stepTitles.first().textContent();
const stepsReordered = firstSummaryAfter !== firstSummaryBefore;

// Regression test for a review finding: forward step reorder used to
// overshoot by one slot for the same reason as the token reorder above,
// but only shows up when the drop target sits strictly *between* two other
// steps - "move to the very end" happens to clamp to the same result
// either way, which is why the backward-drag check above never caught it.
// Add a third step so there's a middle slot to drop into, then drag the
// first step ("Untitled step", from the backward drag just above) forward
// to land just before the third.
await editableCanvas.locator(".instruction-canvas__add-step").click();
await editableCanvas.locator(".instruction-canvas__badge").nth(2).click();
await page.locator(".step-details__field input").fill("Third step");
await page.locator("body").click({ position: { x: 5, y: 5 } }); // blur

const forwardDragSourceBox = await stepGroups.nth(0).locator(".instruction-canvas__step-drag-handle").boundingBox();
const forwardDragTargetBox = await stepGroups.nth(2).boundingBox();
await page.mouse.move(forwardDragSourceBox.x + forwardDragSourceBox.width / 2, forwardDragSourceBox.y + forwardDragSourceBox.height / 2);
await page.mouse.down();
await page.mouse.move(forwardDragTargetBox.x + forwardDragTargetBox.width / 2, forwardDragTargetBox.y + 2, { steps: 10 });
await page.mouse.up();
const summariesAfterForwardStepDrag = await stepTitles.allTextContents();
const forwardStepDragLandsAtDropPoint =
  summariesAfterForwardStepDrag.length === 3 &&
  summariesAfterForwardStepDrag[0] === "Chop the onion" && // former 2nd item now 1st
  summariesAfterForwardStepDrag[1] === "Untitled step" && // dragged item lands just before "Third step"
  summariesAfterForwardStepDrag[2] === "Third step";

// Remove the temporary third step so downstream counts (the persistence
// check below expects exactly 2 steps) stay accurate, and refresh
// firstSummaryAfter to reflect the resulting order.
// Keyboard coverage: Enter, not click - see the badge-select comment above.
await activateViaKeyboard(stepGroups.nth(2).locator(".instruction-canvas__step-remove"), "Enter");
firstSummaryAfter = await stepTitles.first().textContent();

// Task 22: Move up/down buttons are the keyboard-operable alternative to
// dragging a step's canvas handle to reorder it (the project plan calls this
// out by name specifically). Move step 1 down, confirm it swapped with
// step 2, then move it back up - a net no-op, so `firstSummaryAfter`
// above still matches the persistence check further below.
const summariesBeforeKeyboardReorder = await stepTitles.allTextContents();
const step0MoveDown = stepGroups.nth(0).locator(".instruction-canvas__step-move--down");
await step0MoveDown.focus();
await step0MoveDown.press("Enter");
const summariesAfterKeyboardMoveDown = await stepTitles.allTextContents();
const step1MoveUp = stepGroups.nth(1).locator(".instruction-canvas__step-move--up");
await step1MoveUp.focus();
await step1MoveUp.press(" ");
const summariesAfterKeyboardMoveUp = await stepTitles.allTextContents();
const stepReorderedViaKeyboard =
  summariesAfterKeyboardMoveDown[0] === summariesBeforeKeyboardReorder[1] &&
  summariesAfterKeyboardMoveDown[1] === summariesBeforeKeyboardReorder[0] &&
  JSON.stringify(summariesAfterKeyboardMoveUp) === JSON.stringify(summariesBeforeKeyboardReorder);

// Boundary check: the first step's Move up and the last step's Move down
// must be aria-disabled, not just unwired - there's nowhere for them to go.
// Not real `disabled` elements (these are SVG <g role="button">, not <button>)
// so the check reads aria-disabled directly rather than Playwright's
// `.isDisabled()`, which only understands native form controls.
const firstStepMoveUpDisabled =
  (await stepGroups.nth(0).locator(".instruction-canvas__step-move--up").getAttribute("aria-disabled")) === "true";
const lastStepIndex = (await stepGroups.count()) - 1;
const lastStepMoveDownDisabled =
  (await stepGroups.nth(lastStepIndex).locator(".instruction-canvas__step-move--down").getAttribute("aria-disabled")) === "true";
const stepMoveButtonsDisabledAtBoundaries = firstStepMoveUpDisabled && lastStepMoveDownDisabled;

// Task 13 (Undo/Redo): snapshot state first so this block can fully undo
// itself afterward, leaving the step count/order exactly as the
// persistence check below expects (it was captured just above, before this
// block runs).
const summariesBeforeHistoryTest = await stepTitles.allTextContents();

// Discrete action: adding a step is its own undo step.
// Keyboard coverage: Space, not click - see the badge-select comment above.
await activateViaKeyboard(editableCanvas.locator(".instruction-canvas__add-step"), " ");
const stepCountAfterAddForHistoryTest = await stepGroups.count();
await undoButton.click();
const stepCountAfterUndoingAdd = await stepGroups.count();
const discreteActionUndoes =
  stepCountAfterAddForHistoryTest === summariesBeforeHistoryTest.length + 1 &&
  stepCountAfterUndoingAdd === summariesBeforeHistoryTest.length;

// Continuous action: typing a whole title (several keystrokes) must
// coalesce into ONE undo step, not one character at a time - StepDetails'
// title field calls its mutator on every keystroke with no local draft
// state (see state/document.ts's COALESCE_WINDOW_MS comment), so without
// coalescing, undo would only ever remove the last-typed character.
const originalFirstTitle = summariesBeforeHistoryTest[0];
await editableCanvas.locator(".instruction-canvas__badge").first().click();
await page.locator(".step-details__field input").fill("");
await page.locator(".step-details__field input").pressSequentially("Renamed step", { delay: 20 });
await page.locator("body").click({ position: { x: 5, y: 5 } }); // blur
const titleAfterTyping = await stepTitles.first().textContent();
await undoButton.click(); // one click undoes the WHOLE typed title
const titleAfterOneUndo = await stepTitles.first().textContent();
const continuousEditCoalescesIntoOneUndo =
  titleAfterTyping === "Renamed step" && titleAfterOneUndo === originalFirstTitle;

// Redo restores the coalesced edit in one step.
await redoButton.click();
const redoRestoresCoalescedEdit = (await stepTitles.first().textContent()) === "Renamed step";

// Keyboard shortcuts: Ctrl+Z undoes, Ctrl+Shift+Z redoes.
await page.keyboard.press("Control+z");
const titleAfterCtrlZ = await stepTitles.first().textContent();
await page.keyboard.press("Control+Shift+z");
const titleAfterCtrlShiftZ = await stepTitles.first().textContent();
const keyboardShortcutsWork = titleAfterCtrlZ === originalFirstTitle && titleAfterCtrlShiftZ === "Renamed step";

// Undo the rename back out, leaving state exactly as this block found it.
await undoButton.click();
const summariesAfterHistoryTest = await stepTitles.allTextContents();
const historyTestLeftStateUnchanged =
  JSON.stringify(summariesAfterHistoryTest) === JSON.stringify(summariesBeforeHistoryTest);

const undoRedoWorkedEndToEnd =
  discreteActionUndoes &&
  continuousEditCoalescesIntoOneUndo &&
  redoRestoresCoalescedEdit &&
  keyboardShortcutsWork &&
  historyTestLeftStateUnchanged;

// Task 8 (Live Preview): toggling it swaps the editor for a read-only canvas.
// Waits for `.app__main--preview` specifically, not `.instruction-canvas--readonly`
// - since Task 15 (SVG Export) added a second, permanently-mounted, hidden,
// always-read-only InstructionCanvas (`App`'s `.app__export-canvas`), a
// `.instruction-canvas--readonly` element exists in the DOM from the very
// first page load, long before Preview mode is ever toggled, so waiting on
// it here would resolve immediately and this check would never actually
// wait for anything.
await page.locator(".app__preview-toggle").click();
await page.waitForSelector(".app__main--preview");
const previewHidesEditingControls =
  (await editableCanvas.locator(".instruction-canvas__chip-remove").count()) === 0 &&
  (await editableCanvas.locator(".instruction-canvas__step-remove").count()) === 0 &&
  (await editableCanvas.locator(".instruction-canvas__step-move").count()) === 0 &&
  (await editableCanvas.locator(".instruction-canvas__step-drag-handle").count()) === 0 &&
  (await editableCanvas.locator(".instruction-canvas__add-step").count()) === 0;
await page.screenshot({ path: path.join(OUT, "06-preview-mode.png"), fullPage: true });
await page.locator(".app__preview-toggle").click();
await page.waitForSelector(".instruction-canvas__add-step");

// Task 12 (Data Persistence): reload and confirm the document - including
// the step-reorder above - survived via IndexedDB, not just in-memory
// state. (Not the step-details title: the earlier reorder put the
// untitled step first, so an empty title field post-reload would be
// correct, not a bug - checking summaries covers both step count and order.)
// The save is debounced (200ms - see state/persistence.ts); wait past that
// before reloading, the same way a real user pauses before closing a tab -
// reloading with zero pause is a pathological race no real user hits, and
// is a documented, accepted limitation, not a bug (see persistence.ts).
await page.waitForTimeout(300);
await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector(".instruction-canvas__svg");
const summariesAfterReload = await stepTitles.allTextContents();
const persistedAcrossReload =
  summariesAfterReload.length === 2 && summariesAfterReload[0] === firstSummaryAfter;

// Mobile viewport - canvas tokens must stay legible and single-row per step.
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: path.join(OUT, "04-mobile.png"), fullPage: true });
const accessibilityViolationsMobile = await countAxeViolations("mobile 390px");

// Task 21 (Build Responsive Layouts) regression check: nothing should ever
// force the page wider than the viewport at mobile width. This bit twice
// during that task's own audit (see docs/fixed-issues/README.md) - a
// toolbar group with flex-shrink: 0 pinned at its full un-wrapped width,
// and a step-list item with no min-width: 0 refusing to shrink below an
// unbroken title's full length - both the same "flex item's automatic
// minimum size defaults to its content's un-wrapped size" pattern, caught
// only by actually measuring scrollWidth, not by looking at a screenshot
// of the default (short-title) document.
const mobileOverflow = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
const noHorizontalOverflowAtMobileWidth = mobileOverflow === 0;

// Task 18 (JSON Export): add a temporary empty step so there's something for
// task 14's validation to flag, then export and confirm the downloaded file
// is the current document plus a non-blocking warning toast (the export
// itself must still succeed either way - "non-blocking" per
// docs/fixed-issues/README.md's design intent, not enforced there but this is where
// it's actually exercised).
await editableCanvas.locator(".instruction-canvas__add-step").click();
// Reconstruct the true incomplete-step count from two DOM signals rather
// than trusting `.instruction-canvas__flag`'s count alone: that persistent
// badge is deliberately suppressed for an untouched, zero-token step (see
// model/validate.ts's shouldFlagIncompleteStep) even though it's still
// counted incomplete by this export warning, which checks `isComplete`
// directly and doesn't go through the badge at all. A step is incomplete
// for exactly one of two reasons - zero tokens (badge suppressed - counted
// directly below by checking each step's own token count) or tokens with no
// action among them (badge shown) - so the two counts together give the
// real total. At this point in the flow that's step 1 (its action token was
// removed earlier below) plus the empty step just added here.
const flaggedIncompleteCount = await editableCanvas.locator(".instruction-canvas__flag").count();
const stepTokenCounts = await Promise.all(
  (await stepGroups.all()).map((group) => group.locator(".instruction-canvas__token").count()),
);
const emptyStepCount = stepTokenCounts.filter((count) => count === 0).length;
const expectedIncompleteCount = flaggedIncompleteCount + emptyStepCount;
const [download] = await Promise.all([
  page.waitForEvent("download"),
  page.getByRole("button", { name: "Export JSON", exact: true }).click(),
]);
const exportSuggestedFilename = download.suggestedFilename();
const exportPath = path.join(OUT, "exported-document.json");
await download.saveAs(exportPath);
const exportedDoc = JSON.parse(fs.readFileSync(exportPath, "utf8"));
const exportToastText = await page.locator(".app__toast").textContent();
const exportWarnedAboutIncompleteSteps =
  expectedIncompleteCount > 0 &&
  (await page.locator(".app__toast--warning").count()) === 1 &&
  exportToastText.includes(String(expectedIncompleteCount));
const jsonExportDownloadsCurrentDocument =
  exportSuggestedFilename === "untitled-instructions.json" &&
  exportedDoc.steps.length === (await stepGroups.count());
await page.screenshot({ path: path.join(OUT, "07-export-warning-toast.png"), fullPage: true });
await page.locator(".app__toast-dismiss").click();
const toastGoneAfterDismiss = (await page.locator(".app__toast").count()) === 0;

// Task 15 (SVG Export): same temp incomplete step still in place, so this
// also re-exercises the task 14 warning-toast link for a second export
// format. Regression test for a real gap found while building this: a
// plain `XMLSerializer` dump of the canvas's `<svg>` node captures markup
// only, never the CSS classes (global.css) that give it any color/font at
// all - so the file would open as unstyled/invisible shapes anywhere but
// this app's own page. `exportCanvasAsSvg` (lib/svg-export.ts) bakes
// computed styles into inline `style` attributes on a clone before
// serializing - confirmed here by checking the downloaded file's raw text
// for `rgb(245, 246, 249)`, the computed value of the chip fill design
// token (--color-surface-sunken: #f5f6f9), which could only appear if the
// baking step actually ran.
const [svgDownload] = await Promise.all([
  page.waitForEvent("download"),
  page.getByRole("button", { name: "Export SVG", exact: true }).click(),
]);
const svgSuggestedFilename = svgDownload.suggestedFilename();
const svgExportPath = path.join(OUT, "exported-canvas.svg");
await svgDownload.saveAs(svgExportPath);
const svgContent = fs.readFileSync(svgExportPath, "utf8");
const svgToastText = await page.locator(".app__toast").textContent();
const svgExportWarnedAboutIncompleteSteps =
  expectedIncompleteCount > 0 &&
  (await page.locator(".app__toast--warning").count()) === 1 &&
  svgToastText.includes(String(expectedIncompleteCount));
const svgExportIsSelfContainedAndStyled =
  svgSuggestedFilename === "untitled-instructions.svg" &&
  svgContent.startsWith('<?xml version="1.0" encoding="UTF-8"?>') &&
  svgContent.includes("<svg") &&
  svgContent.includes("rgb(245, 246, 249)") && // baked chip fill (--color-surface-sunken)
  // exported from the read-only canvas, not the editable one - none of its
  // token- or step-level editing controls should ever appear in a download.
  !svgContent.includes("instruction-canvas__chip-remove") &&
  !svgContent.includes("instruction-canvas__step-remove") &&
  !svgContent.includes("instruction-canvas__step-move") &&
  !svgContent.includes("instruction-canvas__step-drag-handle") &&
  !svgContent.includes("instruction-canvas__add-step");
await page.screenshot({ path: path.join(OUT, "09-svg-export-toast.png"), fullPage: true });
await page.locator(".app__toast-dismiss").click();

// Task 16 (PNG Export): same temp incomplete step still in place, so this
// re-exercises the task 14 warning-toast link a third time. The real thing
// worth confirming isn't just "a PNG downloaded" - it's that rasterization
// actually happened *at the declared pixel density* (2x), not at the SVG's
// own 1x design-unit size. Reads the PNG's IHDR chunk directly (bytes 16-23
// are width/height as big-endian uint32, right after the 8-byte PNG
// signature + 4-byte length + 4-byte "IHDR" tag) rather than pulling in an
// image-decoding dependency just for this, and compares against the width/
// height this same SVG export just reported for the identical document -
// a genuine 2x-vs-1x check, not a guess at what the number "should" be.
const svgWidthMatch = svgContent.match(/<svg[^>]*\swidth="([\d.]+)"/);
const svgHeightMatch = svgContent.match(/<svg[^>]*\sheight="([\d.]+)"/);
const expectedSvgWidth = svgWidthMatch ? Number(svgWidthMatch[1]) : null;
const expectedSvgHeight = svgHeightMatch ? Number(svgHeightMatch[1]) : null;

const [pngDownload] = await Promise.all([
  page.waitForEvent("download"),
  page.getByRole("button", { name: "Export PNG", exact: true }).click(),
]);
const pngSuggestedFilename = pngDownload.suggestedFilename();
const pngExportPath = path.join(OUT, "exported-canvas.png");
await pngDownload.saveAs(pngExportPath);
const pngBuffer = fs.readFileSync(pngExportPath);
const pngToastText = await page.locator(".app__toast").textContent();
const pngExportWarnedAboutIncompleteSteps =
  expectedIncompleteCount > 0 &&
  (await page.locator(".app__toast--warning").count()) === 1 &&
  pngToastText.includes(String(expectedIncompleteCount));

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PIXEL_DENSITY = 2; // must match lib/png-export.ts's PIXEL_DENSITY
const isPngSignatureValid = pngBuffer.subarray(0, 8).equals(PNG_SIGNATURE);
const pngWidth = pngBuffer.readUInt32BE(16);
const pngHeight = pngBuffer.readUInt32BE(20);
const pngExportIsRasterizedAtPixelDensity =
  pngSuggestedFilename === "untitled-instructions.png" &&
  isPngSignatureValid &&
  expectedSvgWidth !== null &&
  expectedSvgHeight !== null &&
  pngWidth === Math.round(expectedSvgWidth * PIXEL_DENSITY) &&
  pngHeight === Math.round(expectedSvgHeight * PIXEL_DENSITY);
await page.screenshot({ path: path.join(OUT, "10-png-export-toast.png"), fullPage: true });
await page.locator(".app__toast-dismiss").click();

// Task 17 (Print/PDF Export), now the jsPDF + svg2pdf.js "Phase 4 stretch
// tier" (2026-09-17 remediation, replacing the `window.print()` baseline):
// the button downloads a real `.pdf` file directly, same mechanism as
// SVG/PNG export above, so it's checked the same way (`page.waitForEvent
// ("download")`) rather than the old `beforeprint`-event trick a
// dialog-only, no-download `window.print()` call needed. Only a
// single-page smoke check here, against the same small document SVG/PNG
// export just used - a dedicated multi-page document further down
// (PDF_EXPORT_PRODUCES_MULTIPLE_PAGES) is what actually exercises
// pagination.
const [pdfDownload] = await Promise.all([
  page.waitForEvent("download"),
  page.getByRole("button", { name: "Export PDF", exact: true }).click(),
]);
const pdfExportPath = path.join(OUT, "exported-canvas.pdf");
await pdfDownload.saveAs(pdfExportPath);
const pdfBuffer = fs.readFileSync(pdfExportPath);
const isPdfSignatureValid = pdfBuffer.subarray(0, 5).toString("latin1") === "%PDF-";
const pdfExportDownloadedValidPdf =
  pdfDownload.suggestedFilename() === "untitled-instructions.pdf" && isPdfSignatureValid;
const pdfToastText = await page.locator(".app__toast").textContent();
const pdfExportWarnedAboutIncompleteSteps =
  expectedIncompleteCount > 0 &&
  (await page.locator(".app__toast--warning").count()) === 1 &&
  pdfToastText.includes(String(expectedIncompleteCount));
await page.locator(".app__toast-dismiss").click();

// The @media print rules in global.css still exist even though the button
// above no longer uses `window.print()` - they're now a fallback purely
// for a native Ctrl+P/File>Print bypassing the button (left as-is,
// unsupported/undocumented - see the 2026-09-17 remediation grill's Q7).
// Checked directly via `emulateMedia`, with no dialog and independent of
// whatever the button does: the toolbar and editor grid hidden, and the
// hidden, always-mounted, read-only export canvas (the same one SVG/PNG/
// PDF export all read from) switched from a 0x0 clipped box back into
// normal, visible flow.
await page.emulateMedia({ media: "print" });
const printLayout = await page.evaluate(() => {
  const toolbar = document.querySelector(".app__toolbar");
  const main = document.querySelector(".app__main");
  const exportCanvas = document.querySelector(".app__export-canvas");
  const svg = exportCanvas?.querySelector(".instruction-canvas__svg") ?? null;
  return {
    toolbarHidden: getComputedStyle(toolbar).display === "none",
    mainHidden: getComputedStyle(main).display === "none",
    exportCanvasVisible: !!exportCanvas && getComputedStyle(exportCanvas).display !== "none" && exportCanvas.getBoundingClientRect().width > 0,
    svgStepCount: svg ? svg.querySelectorAll(".instruction-canvas__step-bg").length : 0,
    svgHasNoRemoveButtons: svg ? svg.querySelectorAll(".instruction-canvas__chip-remove").length === 0 : false,
    svgHasNoStepControls: svg
      ? svg.querySelectorAll(
          ".instruction-canvas__step-remove, .instruction-canvas__step-move, .instruction-canvas__step-drag-handle, .instruction-canvas__add-step",
        ).length === 0
      : false,
  };
});
await page.screenshot({ path: path.join(OUT, "11-print-preview.png"), fullPage: true });
await page.emulateMedia({ media: "screen" }); // restore normal rendering before the rest of the driver continues
const printStylesheetIsolatesReadOnlyCanvas =
  printLayout.toolbarHidden &&
  printLayout.mainHidden &&
  printLayout.exportCanvasVisible &&
  printLayout.svgStepCount > 0 &&
  printLayout.svgHasNoRemoveButtons &&
  printLayout.svgHasNoStepControls;

// Remove the temporary empty step so the step count is back to what it was.
await stepGroups.nth(2).locator(".instruction-canvas__step-remove").click();

// PDF pagination (2026-09-17 remediation): the smoke check above only
// proves Export PDF still downloads *a* valid PDF for a small document
// that happens to fit on one page - it says nothing about pagination
// itself. `lib/pdf-pagination.ts`'s `paginateSteps` (the actual page-break
// logic: pack whole steps per page, never split one) is already
// unit-tested in isolation (src/lib/pdf-pagination.test.ts), so this only
// needs to confirm the real end-to-end pipeline - DOM bounds in, jsPDF +
// svg2pdf.js out - genuinely produces more than one PDF page for a
// document long enough to need it, the same way a prior live diagnostic
// (before this fix) found an 18-step/4-tokens-per-step document produced
// broken, step-splitting, blank-page-including multi-page output. Imported
// as a throwaway document via the same hidden file input the real Import
// tests below use, then undone right after so it doesn't affect anything
// past this point.
const summariesBeforePaginationTest = await stepTitles.allTextContents();
const importFileInputForPagination = page.locator('input[type="file"]');
const manyStepsDoc = {
  schemaVersion: 1,
  meta: {
    title: "Pagination Test",
    domain: "recipe",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  steps: Array.from({ length: 18 }, (_, stepIndex) => ({
    id: `pagination-step-${stepIndex}`,
    title: `Step ${stepIndex + 1}`,
    tokens: Array.from({ length: 4 }, (_, tokenIndex) => ({
      id: `pagination-step-${stepIndex}-token-${tokenIndex}`,
      category: "action",
      iconId: "chop",
      label: `Token ${tokenIndex + 1}`,
    })),
  })),
};
await importFileInputForPagination.setInputFiles({
  name: "pagination-test-import.json",
  mimeType: "application/json",
  buffer: Buffer.from(JSON.stringify(manyStepsDoc)),
});
await page.locator(".confirm-dialog").waitFor();
await page.getByRole("button", { name: "Replace", exact: true }).click();
await page.locator(".app__toast-dismiss").click();

const [multiPagePdfDownload] = await Promise.all([
  page.waitForEvent("download"),
  page.getByRole("button", { name: "Export PDF", exact: true }).click(),
]);
const multiPagePdfPath = path.join(OUT, "exported-canvas-multipage.pdf");
await multiPagePdfDownload.saveAs(multiPagePdfPath);
const multiPagePdfText = fs.readFileSync(multiPagePdfPath).toString("latin1");
// jsPDF's page objects are uncompressed text in the raw PDF bytes (no
// stream compression enabled), so a plain regex over the whole file finds
// every `/Type /Page` object - excluding `/Type /Pages` (the one page-tree
// root object every PDF also has) via the negative lookahead.
const multiPagePdfPageCount = (multiPagePdfText.match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
const pdfExportProducesMultiplePages =
  multiPagePdfText.startsWith("%PDF-") &&
  multiPagePdfDownload.suggestedFilename() === "pagination-test.pdf" &&
  multiPagePdfPageCount > 1;
await page.screenshot({ path: path.join(OUT, "11b-pdf-export-multipage-doc.png"), fullPage: true });

await page.keyboard.press("Control+z");
const summariesAfterUndoingPaginationTest = await stepTitles.allTextContents();
const paginationTestUndoRestoredDocument =
  JSON.stringify(summariesAfterUndoingPaginationTest) === JSON.stringify(summariesBeforePaginationTest);

// Task 19 (Import): a small valid document, imported via the hidden file
// input (Playwright's setInputFiles fires the same `change` event a real
// file picker would, so the visually-hidden input - proxied by the visible
// "Import" button in normal use - doesn't need to actually be clicked open).
const summariesBeforeImportTest = await stepTitles.allTextContents();
const importFileInput = page.locator('input[type="file"]');
const validImportDoc = {
  schemaVersion: 1,
  meta: { title: "Driver Import Test", domain: "recipe", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  steps: [
    { id: "import-step-1", title: "Imported step", tokens: [{ id: "import-token-1", category: "action", iconId: "chop", label: "Chop" }] },
  ],
};
// Task 22 (Add Accessibility Features): an `alertdialog` needs to actually
// behave like a modal for keyboard/screen-reader users, not just carry the
// role - focus should land on Cancel (the safer default for a "replace
// everything" action) the instant it opens, Tab should stay trapped
// between its two buttons rather than escaping to whatever's underneath,
// and Escape should cancel exactly like clicking Cancel does. Exercised
// with a throwaway import first, so this cycle leaves the document
// untouched either way - the real Replace flow right after is unaffected.
await importFileInput.setInputFiles({
  name: "keyboard-test-import.json",
  mimeType: "application/json",
  buffer: Buffer.from(JSON.stringify(validImportDoc)),
});
await page.locator(".confirm-dialog").waitFor();
const accessibilityViolationsImportDialog = await countAxeViolations("import dialog");
const dialogFocusedCancelOnOpen = await page.evaluate(
  () => document.activeElement?.className === "confirm-dialog-cancel",
);
await page.keyboard.press("Tab");
const focusedReplaceAfterOneTab = await page.evaluate(() => document.activeElement?.className);
await page.keyboard.press("Tab");
const focusWrappedBackToCancel = await page.evaluate(
  () => document.activeElement?.className === "confirm-dialog-cancel",
);
await page.keyboard.press("Escape");
const escapeClosedDialogWithNoChange =
  (await page.locator(".confirm-dialog").count()) === 0 &&
  JSON.stringify(await stepTitles.allTextContents()) === JSON.stringify(summariesBeforeImportTest);
const importDialogTrapsFocusAndEscapeCloses =
  dialogFocusedCancelOnOpen &&
  focusedReplaceAfterOneTab === "confirm-dialog-confirm" &&
  focusWrappedBackToCancel &&
  escapeClosedDialogWithNoChange;

await importFileInput.setInputFiles({
  name: "import.json",
  mimeType: "application/json",
  buffer: Buffer.from(JSON.stringify(validImportDoc)),
});
const importDialogMentionsStepCount = (await page.locator(".confirm-dialog").textContent()).includes("1 step");
await page.screenshot({ path: path.join(OUT, "08-import-confirm-dialog.png"), fullPage: true });
await page.getByRole("button", { name: "Replace", exact: true }).click();
const summariesAfterImport = await stepTitles.allTextContents();
const importReplacedDocument = summariesAfterImport.length === 1 && summariesAfterImport[0] === "Imported step";
await page.locator(".app__toast-dismiss").click();

// Undo/redo must cover import too, same as every other mutation - an
// accidental "Replace" is one Ctrl+Z away from being reverted.
await page.keyboard.press("Control+z");
const summariesAfterUndoingImport = await stepTitles.allTextContents();
const undoRevertsImport = JSON.stringify(summariesAfterUndoingImport) === JSON.stringify(summariesBeforeImportTest);
await page.keyboard.press("Control+Shift+z");
const summariesAfterRedoingImport = await stepTitles.allTextContents();
const redoReappliesImport = summariesAfterRedoingImport.length === 1 && summariesAfterRedoingImport[0] === "Imported step";
await page.keyboard.press("Control+z"); // leave state back at the pre-import baseline

const importUndoRedoWorked = importReplacedDocument && undoRevertsImport && redoReappliesImport;

// Malformed file (unparseable JSON): must show an error toast and leave the
// document untouched - never a half-applied import, never a silent crash.
await importFileInput.setInputFiles({
  name: "bad.json",
  mimeType: "application/json",
  buffer: Buffer.from("not valid json"),
});
// `.count()` is a plain snapshot, not an auto-waiting assertion - the file
// read + parse + migrate happens in an async handler, so without waiting
// for the toast first, a read this fast reads the pre-toast DOM and gives a
// false negative even when the app behaves correctly.
await page.locator(".app__toast").waitFor();
const noDialogForUnparseableFile = (await page.locator(".confirm-dialog").count()) === 0;
const unparseableFileShowsErrorToast = (await page.locator(".app__toast--error").count()) === 1;
await page.locator(".app__toast-dismiss").click();

// Wrong-shaped file (valid JSON, but not an InstructionDocument): exercises
// `migrate`'s own shape validation specifically, not just JSON.parse - and
// not the incidental safety net of `validateDocument` throwing on badly
// shaped input, which is why the step below is *structurally* present
// (a real `tokens` array) with a garbage token inside, rather than missing
// `steps` outright: `validateStep`'s own checks (`tokens.length`,
// `.some(t => t.category === "action")`) don't throw on a garbage token
// shape, so this payload can only be caught by `migrate`'s `isValidToken`
// check - if that check regresses, this file would otherwise sail through
// to the confirm dialog instead of being rejected.
await importFileInput.setInputFiles({
  name: "wrong-shape.json",
  mimeType: "application/json",
  buffer: Buffer.from(
    JSON.stringify({
      schemaVersion: 1,
      meta: validImportDoc.meta,
      steps: [{ id: "bad-step", tokens: [{ notAValidToken: true }] }],
    }),
  ),
});
await page.locator(".app__toast").waitFor();
const noDialogForWrongShapeFile = (await page.locator(".confirm-dialog").count()) === 0;
const wrongShapeFileShowsErrorToast = (await page.locator(".app__toast--error").count()) === 1;
await page.locator(".app__toast-dismiss").click();

const importRejectsInvalidFile =
  noDialogForUnparseableFile &&
  unparseableFileShowsErrorToast &&
  noDialogForWrongShapeFile &&
  wrongShapeFileShowsErrorToast;

// Cancel: the dialog closes and the document is left exactly as it was.
await importFileInput.setInputFiles({
  name: "import2.json",
  mimeType: "application/json",
  buffer: Buffer.from(JSON.stringify(validImportDoc)),
});
await page.getByRole("button", { name: "Cancel", exact: true }).click();
const summariesAfterCancelingImport = await stepTitles.allTextContents();
const importCancelLeavesDocumentUnchanged =
  (await page.locator(".confirm-dialog").count()) === 0 &&
  JSON.stringify(summariesAfterCancelingImport) === JSON.stringify(summariesBeforeImportTest);

// Regression test for a live bug found in an external architecture audit
// (see docs/fixed-issues/README.md): a saved
// document whose schemaVersion didn't match CURRENT_SCHEMA_VERSION used to
// be silently discarded on load (state/persistence.ts previously did
// `saved.schemaVersion === CURRENT_SCHEMA_VERSION` with no `else`), and the
// autosave effect then overwrote it with the empty default ~200ms later -
// permanently destroying the old save with no warning, the moment the app
// loaded. Seed IndexedDB directly (bypassing the app, since there's no UI
// path that produces a mismatched-version record) with a document claiming a
// newer schema version, reload, and confirm: (1) an error toast explains the
// load failure, (2) the original record is still intact on disk immediately
// after reload - not yet clobbered - and (3) the very next real edit still
// autosaves normally, proving the fix only skips the one at-risk write
// rather than breaking autosave for the rest of the session.
async function readStoredDocument() {
  return page.evaluate(() => {
    return new Promise((resolve, reject) => {
      const openReq = indexedDB.open("keyval-store");
      openReq.onsuccess = () => {
        const db = openReq.result;
        const tx = db.transaction("keyval", "readonly");
        const getReq = tx.objectStore("keyval").get("instruction-builder:document");
        getReq.onsuccess = () => { db.close(); resolve(getReq.result); };
        getReq.onerror = () => reject(getReq.error);
      };
      openReq.onerror = () => reject(openReq.error);
    });
  });
}

// A pending debounced autosave (SAVE_DEBOUNCE_MS, state/persistence.ts) from
// an earlier action in this script (e.g. the Ctrl+Z a few steps up) can still
// be in flight here - if it fires *after* the IndexedDB seed below but
// *before* the reload, it silently overwrites the seeded corrupted doc with
// the app's own current (valid) document, and the reload then finds nothing
// wrong: the corrupted doc simply isn't there anymore. This isn't the bug
// this test exists to catch (see the comment below) - it's a race in this
// driver's own direct-IndexedDB-write technique against the app's real
// autosave - caught 2026-09-14 when it made VERSION_MISMATCH_HANDLED_SAFELY
// fail intermittently (roughly 1 run in 3) after an unrelated app.tsx
// refactor made no behavioral difference to this flow at all. Waiting out
// the debounce first, same pattern used elsewhere in this file, closes the
// window.
await page.waitForTimeout(300);

const corruptedSaveDoc = {
  schemaVersion: 2,
  meta: { title: "From the future", domain: "recipe", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  steps: [{ id: "future-step", title: "Future step", tokens: [] }],
};
await page.evaluate((doc) => {
  return new Promise((resolve, reject) => {
    const openReq = indexedDB.open("keyval-store");
    openReq.onsuccess = () => {
      const db = openReq.result;
      const tx = db.transaction("keyval", "readwrite");
      tx.objectStore("keyval").put(doc, "instruction-builder:document");
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
    openReq.onerror = () => reject(openReq.error);
  });
}, corruptedSaveDoc);

await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector(".instruction-canvas__svg");
await page.locator(".app__toast").waitFor();
const versionMismatchShowsErrorToast = (await page.locator(".app__toast--error").count()) === 1;

const storedRightAfterReload = await readStoredDocument();
const oldSaveNotClobberedOnLoad = storedRightAfterReload?.schemaVersion === 2;

await page.locator(".app__toast-dismiss").click();
await editableCanvas.locator(".instruction-canvas__add-step").click(); // a real edit - should autosave normally
await page.waitForTimeout(300);
const storedAfterRealEdit = await readStoredDocument();
const autosaveResumesAfterRealEdit =
  storedAfterRealEdit?.schemaVersion === 1 && storedAfterRealEdit?.steps?.length === 2;

const versionMismatchHandledSafely =
  versionMismatchShowsErrorToast && oldSaveNotClobberedOnLoad && autosaveResumesAfterRealEdit;

await browser.close();

console.log("SCREENSHOTS_DIR=" + OUT);
console.log("TABS_FILTER_TOKENS=" + tabsFilterTokens);
console.log("TOKEN_CATEGORY_ARROW_KEY_NAV_WORKS=" + tokenCategoryArrowKeyNavWorks);
console.log("TOKEN_SELECTED_AFTER_FIRST_CLICK=" + tokenSelectedAfterFirstClick);
console.log("TOKEN_LABEL_UPDATED=" + tokenLabelUpdated);
console.log("ATTACHMENTS_WORKED_END_TO_END=" + attachmentsWorkedEndToEnd);
console.log("QUANTITY_EDIT_PREFILLS_FROM_CURRENT_VALUE=" + quantityEditPrefillsFromCurrentValue);
console.log("QUANTITY_SELECTS_VALUE_ON_FOCUS=" + quantitySelectsValueOnFocus);
console.log("QUANTITY_FORM_RESETS_PER_TOKEN=" + quantityFormResetsPerToken);
console.log("ATTACHED_VALUE_CHANGEABLE_WITHOUT_REMOVING=" + attachedValueChangeableWithoutRemoving);
console.log("DURATION_SELECTS_VALUE_ON_FOCUS=" + durationSelectsValueOnFocus);
console.log("TIME_WORKED_END_TO_END=" + timeWorkedEndToEnd);
console.log("DURATION_FIELD_RESETS_PER_TOKEN=" + durationFieldResetsPerToken);
console.log("DURATION_FIELD_RESETS_PER_STEP=" + durationFieldResetsPerStep);
console.log("CONNECTOR_COUNT=" + connectorCount + " (expect 2 for 3 tokens)");
console.log("DRAG_ADDED_TOKEN_VIA_PICKER=" + dragAddedTokenViaPicker);
console.log("INSERTION_MARKER_VISIBLE_MID_DRAG=" + insertionMarkerVisibleMidDrag);
console.log("TOKEN_MOVED_BETWEEN_STEPS_VIA_DRAG=" + tokenMovedBetweenSteps);
console.log("FORWARD_TOKEN_DRAG_LANDS_AT_DROP_POINT=" + forwardTokenDragLandsAtDropPoint);
console.log("STEPS_REORDERED_VIA_DRAG=" + stepsReordered);
console.log("HISTORY_BUTTONS_DISABLED_INITIALLY=" + historyButtonsDisabledInitially);
console.log("UNDO_REDO_WORKED_END_TO_END=" + undoRedoWorkedEndToEnd);
console.log("FORWARD_STEP_DRAG_LANDS_AT_DROP_POINT=" + forwardStepDragLandsAtDropPoint);
console.log("PREVIEW_HIDES_EDITING_CONTROLS=" + previewHidesEditingControls);
console.log("PERSISTED_ACROSS_RELOAD=" + persistedAcrossReload);
console.log("NO_HORIZONTAL_OVERFLOW_AT_MOBILE_WIDTH=" + noHorizontalOverflowAtMobileWidth);
console.log("CANVAS_KEYBOARD_FOCUSABLE=" + canvasControlFocused);
console.log("JSON_EXPORT_DOWNLOADS_CURRENT_DOCUMENT=" + jsonExportDownloadsCurrentDocument);
console.log("JSON_EXPORT_WARNS_ABOUT_INCOMPLETE_STEPS=" + exportWarnedAboutIncompleteSteps);
console.log("TOAST_DISMISSIBLE=" + toastGoneAfterDismiss);
console.log("SVG_EXPORT_IS_SELF_CONTAINED_AND_STYLED=" + svgExportIsSelfContainedAndStyled);
console.log("SVG_EXPORT_WARNS_ABOUT_INCOMPLETE_STEPS=" + svgExportWarnedAboutIncompleteSteps);
console.log("PNG_EXPORT_IS_RASTERIZED_AT_PIXEL_DENSITY=" + pngExportIsRasterizedAtPixelDensity);
console.log("PNG_EXPORT_WARNS_ABOUT_INCOMPLETE_STEPS=" + pngExportWarnedAboutIncompleteSteps);
console.log("PDF_EXPORT_DOWNLOADED_VALID_PDF=" + pdfExportDownloadedValidPdf);
console.log("PDF_EXPORT_WARNS_ABOUT_INCOMPLETE_STEPS=" + pdfExportWarnedAboutIncompleteSteps);
console.log("PRINT_STYLESHEET_ISOLATES_READONLY_CANVAS=" + printStylesheetIsolatesReadOnlyCanvas);
console.log(
  "PDF_EXPORT_PRODUCES_MULTIPLE_PAGES=" + pdfExportProducesMultiplePages + " (page count: " + multiPagePdfPageCount + ")",
);
console.log("PAGINATION_TEST_UNDO_RESTORED_DOCUMENT=" + paginationTestUndoRestoredDocument);
console.log("IMPORT_DIALOG_MENTIONS_STEP_COUNT=" + importDialogMentionsStepCount);
console.log("IMPORT_UNDO_REDO_WORKED=" + importUndoRedoWorked);
console.log("IMPORT_REJECTS_INVALID_FILE=" + importRejectsInvalidFile);
console.log("IMPORT_CANCEL_LEAVES_DOCUMENT_UNCHANGED=" + importCancelLeavesDocumentUnchanged);
console.log("VERSION_MISMATCH_HANDLED_SAFELY=" + versionMismatchHandledSafely);
console.log("STEP_REORDERED_VIA_KEYBOARD=" + stepReorderedViaKeyboard);
console.log("STEP_MOVE_BUTTONS_DISABLED_AT_BOUNDARIES=" + stepMoveButtonsDisabledAtBoundaries);
console.log("TOKEN_SELECTED_VIA_KEYBOARD=" + tokenSelectedViaKeyboard);
console.log("IMPORT_DIALOG_TRAPS_FOCUS_AND_ESCAPE_CLOSES=" + importDialogTrapsFocusAndEscapeCloses);
console.log("ACCESSIBILITY_VIOLATIONS_MAIN_EDITOR=" + accessibilityViolationsMainEditor);
console.log("ACCESSIBILITY_VIOLATIONS_IMPORT_DIALOG=" + accessibilityViolationsImportDialog);
console.log("ACCESSIBILITY_VIOLATIONS_MOBILE=" + accessibilityViolationsMobile);
console.log("CONSOLE_ERRORS_COUNT=" + errors.length);
for (const e of errors) console.log(e);
