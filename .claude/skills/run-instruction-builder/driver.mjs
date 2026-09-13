// Playwright driver for the Visual Instruction Builder dev app.
// Usage: node driver.mjs <screenshot-output-dir> [devServerUrl]
//
// Assumes the Vite dev server is already running (see SKILL.md for the
// exact start/poll commands) - this script only drives the browser.
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

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

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector(".instruction-canvas__svg");
await page.screenshot({ path: path.join(OUT, "01-desktop-initial.png"), fullPage: true });

// Task 13 (Undo/Redo): both buttons start disabled - a fresh document has
// nothing to undo and nothing has been undone yet to redo. Check this here,
// before the rest of the flow below makes any edits.
const undoButton = page.getByRole("button", { name: "Undo", exact: true });
const redoButton = page.getByRole("button", { name: "Redo", exact: true });
const historyButtonsDisabledInitially = (await undoButton.isDisabled()) && (await redoButton.isDisabled());

// Representative flow: name the first step, add tokens via the picker,
// select a step from the canvas badge, remove a token from the canvas.
await page.locator(".step-list__item").first().click();
await page.locator(".step-details__field input").fill("Chop the onion");
await page.locator(".step-details__field textarea").fill("Use a sharp knife on a stable board.");
await page.locator("body").click({ position: { x: 5, y: 5 } }); // blur the field

const picker = page.locator(".token-picker");
async function selectTab(label) {
  await picker.getByRole("tab", { name: label, exact: true }).click();
}

// Category tabs: only the active category's tokens are in the DOM/visible
// at a time, so a real user (and this driver) must switch tabs to reach
// tokens outside the default-active category ("Actions", the first one
// with samples).
const objectsTabCountBeforeSwitch = await picker.locator(".token-picker__grid").getByRole("button").count();
await picker.getByRole("button", { name: "Chop", exact: true }).click();
await selectTab("Objects");
const objectsTabCount = await picker.locator(".token-picker__grid").getByRole("button").count();
const tabsFilterTokens = objectsTabCount !== objectsTabCountBeforeSwitch;
await picker.getByRole("button", { name: "Onion", exact: true }).click();
await selectTab("Tools");
await picker.getByRole("button", { name: "Knife", exact: true }).click();
await selectTab("Actions");
await page.screenshot({ path: path.join(OUT, "02-desktop-after-edit.png"), fullPage: true });

// Connector lines: a plain line between each pair of consecutive tokens
// within a step (3 tokens in step 1 so far -> 2 connectors).
const connectorCount = await page.locator(".instruction-canvas__connector").count();

// Two-stage select: add a second (unselected) step, then click one of its
// tokens - the FIRST click on an unselected step's token should select the
// step, not the token (token-details stays empty).
await page.locator(".step-list__add").click();
await picker.getByRole("button", { name: "Bake", exact: true }).click();
await page.locator(".step-list__item").first().click(); // reselect step 1 (still has tokens)

const firstToken = page.locator(".instruction-canvas__token").first();
await firstToken.click(); // step 1 already selected -> should select the TOKEN
const tokenTitleInput = page.locator(".token-details__field input");
const tokenSelectedAfterFirstClick = (await tokenTitleInput.count()) > 0 && (await tokenTitleInput.inputValue()) !== "";

await tokenTitleInput.fill("Chop finely");
await page.locator(".token-details__field textarea").fill("Small, even dice.");
await page.locator("body").click({ position: { x: 5, y: 5 } }); // blur
const tokenLabelUpdated = (await page.locator(".instruction-canvas__chip-label").first().textContent()) === "Chop finely";
await page.screenshot({ path: path.join(OUT, "02b-token-details.png"), fullPage: true });

// "Add to token": Quantity (a free amount+unit form) and Warning (a preset
// grid) attach to the selected token (firstToken, already selected above) -
// a separate menu from "Add to step", click-only (no drag). Time is
// deliberately not here - see the DurationField block below. Verify the
// canvas chip grows the expected badges, Token details lists them, and
// removing one via Token details drops it from both.
const attach = page.locator(".token-attachment-picker");
async function selectAttachTab(label) {
  await attach.getByRole("tab", { name: label, exact: true }).click();
}
await selectAttachTab("Warnings");
await attach.getByRole("button", { name: "Sharp!", exact: true }).click();
await selectAttachTab("Quantities");
await attach.locator(".token-attachment-picker__field input").fill("250");
await attach.locator(".token-attachment-picker__field select").selectOption("g");
await attach.getByRole("button", { name: "Attach", exact: true }).click();

const badgeCountAfterAttach = await firstToken.locator(".instruction-canvas__chip-badge").count();
const attachmentListCountAfterAttach = await page.locator(".token-details__attachment").count();
await page.screenshot({ path: path.join(OUT, "02c-token-attachments.png"), fullPage: true });

await page.locator(".token-details").getByRole("button", { name: "Remove Sharp!" }).click();
const badgeCountAfterRemove = await firstToken.locator(".instruction-canvas__chip-badge").count();
const attachmentListCountAfterRemove = await page.locator(".token-details__attachment").count();

const attachmentsWorkedEndToEnd =
  badgeCountAfterAttach === 2 &&
  attachmentListCountAfterAttach === 2 &&
  badgeCountAfterRemove === 1 &&
  attachmentListCountAfterRemove === 1;

// Regression test for a review finding: QuantityForm is the same component
// instance across a token switch (same position in the tree), so without a
// `key={token.id}` on it, typing a draft amount/unit for one token and then
// switching to a *different* token (without clicking Attach) left the new
// token's Quantity form showing the old token's unsaved draft instead of
// resetting to the default amount/unit - same bug class already found and
// fixed for DurationField above.
await selectAttachTab("Quantities");
const quantityAmountInput = attach.locator(".token-attachment-picker__field input");
const quantityUnitSelect = attach.locator(".token-attachment-picker__field select");
const defaultQuantityUnit = await quantityUnitSelect.locator("option").first().getAttribute("value");
await quantityAmountInput.fill("42");
await quantityUnitSelect.selectOption("kg");
// step 1 already selected -> selects its 2nd token (declared as `secondToken` later, reused there)
await page.locator(".instruction-canvas__token").nth(1).click();
const freshQuantityAmount = await quantityAmountInput.inputValue();
const freshQuantityUnit = await quantityUnitSelect.inputValue();
const quantityFormResetsPerToken = freshQuantityAmount === "1" && freshQuantityUnit === defaultQuantityUnit;
await firstToken.click(); // back to the first token for the rest of the flow

// Time: factored out of "Add to token" entirely - set via DurationField
// directly in Token details (a token's own time) and Step details (a
// step's own estimate, which takes precedence over its tokens' summed time
// when both are set - see stepDisplayedTime in InstructionCanvas.tsx).
// Verify the canvas's step-level duration header reflects both in turn.
const tokenDurationField = page.locator(".token-details").locator(".duration-field");
await tokenDurationField.getByRole("button", { name: "Add token time", exact: true }).click();
const tokenDurationInputs = tokenDurationField.locator(".duration-field__unit input");
await tokenDurationInputs.nth(1).fill("1"); // 1 hour
await tokenDurationInputs.nth(2).fill("30"); // 30 minutes
await tokenDurationField.getByRole("button", { name: "Save token time", exact: true }).click();

const stepTimeAfterTokenTime = await page.locator(".instruction-canvas__step-time").first().textContent();
const tokenTimeMatchesSum = stepTimeAfterTokenTime === "00d-01h-30m-00s";

// Regression test for a bug found in manual testing: DurationField is the
// same component instance across a token switch (same position in the
// tree), so without a `key={token.id}` on it, starting an edit on one
// token and then clicking a *different* token (without saving/cancelling)
// left the new token's Time field stuck showing the old token's unsaved
// editing form instead of the new token's own value.
await tokenDurationField.getByRole("button", { name: "Edit token time", exact: true }).click();
await tokenDurationInputs.nth(2).fill("59"); // change but deliberately don't save
const secondToken = page.locator(".instruction-canvas__token").nth(1);
await secondToken.click(); // step 1 already selected -> selects its 2nd token (no time of its own)
const freshTokenDurationField = page.locator(".token-details").locator(".duration-field");
const durationFieldResetsPerToken =
  (await freshTokenDurationField.locator(".duration-field__inputs").count()) === 0 &&
  (await freshTokenDurationField.getByRole("button", { name: "Add token time", exact: true }).count()) === 1;
// Leave the first token re-selected and its time intact for the rest of the flow.
await firstToken.click();

const stepDurationField = page.locator(".step-details").locator(".duration-field");
await stepDurationField.getByRole("button", { name: "Add step time", exact: true }).click();
const stepDurationInputs = stepDurationField.locator(".duration-field__unit input");
await stepDurationInputs.nth(0).fill("2"); // 2 days - an explicit step estimate
await stepDurationField.getByRole("button", { name: "Save step time", exact: true }).click();

const stepTimeAfterStepTime = await page.locator(".instruction-canvas__step-time").first().textContent();
const stepTimeOverridesTokenSum = stepTimeAfterStepTime === "02d-00h-00m-00s";

// Same regression as above, for a step switch: edit step 1's time again
// without saving, then switch to step 2 - its own DurationField must show
// "Add step time" fresh, not step 1's leftover unsaved edit.
await stepDurationField.getByRole("button", { name: "Edit step time", exact: true }).click();
await stepDurationInputs.nth(0).fill("5"); // change but deliberately don't save
await page.locator(".step-list__item").nth(1).click(); // switch to step 2 (no time of its own)
const freshStepDurationField = page.locator(".step-details").locator(".duration-field");
const durationFieldResetsPerStep =
  (await freshStepDurationField.locator(".duration-field__inputs").count()) === 0 &&
  (await freshStepDurationField.getByRole("button", { name: "Add step time", exact: true }).count()) === 1;
await page.locator(".step-list__item").first().click(); // back to step 1 for the rest of the flow

await page.screenshot({ path: path.join(OUT, "02d-time.png"), fullPage: true });

const timeWorkedEndToEnd = tokenTimeMatchesSum && stepTimeOverridesTokenSum;

// Keyboard reachability check: Tab should be able to reach canvas controls
// (regression test for the tabindex="0" vs tabIndex="0" SVG casing bug).
const badge = page.locator(".instruction-canvas__badge").first();
await badge.focus();
const canvasControlFocused = await page.evaluate(
  () => document.activeElement?.getAttribute("role") === "button",
);

const chipRemoves = page.locator(".instruction-canvas__chip-remove");
if ((await chipRemoves.count()) > 0) {
  await chipRemoves.first().click();
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

const step1Tokens = page.locator(".instruction-canvas__tokens").nth(0).locator(".instruction-canvas__token");
const step2Tokens = page.locator(".instruction-canvas__tokens").nth(1).locator(".instruction-canvas__token");
const step2Bg = page.locator(".instruction-canvas__step-bg").nth(1);

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

// Drag step 2 above step 1 in the StepList to reorder. Drop near the TOP of
// step 1's box, not its center - the drop-index calculation compares
// against each item's vertical midpoint, so dropping exactly on a midpoint
// is a genuine boundary tie, not a realistic drag gesture.
const stepItems = page.locator(".step-list__item");
const firstSummaryBefore = await stepItems.first().locator(".step-list__summary").textContent();
const step2ItemBox = await stepItems.nth(1).boundingBox();
const step1ItemBox = await stepItems.nth(0).boundingBox();
await page.mouse.move(step2ItemBox.x + step2ItemBox.width / 2, step2ItemBox.y + step2ItemBox.height / 2);
await page.mouse.down();
await page.mouse.move(step1ItemBox.x + step1ItemBox.width / 2, step1ItemBox.y + 2, { steps: 10 });
await page.mouse.up();
let firstSummaryAfter = await stepItems.first().locator(".step-list__summary").textContent();
const stepsReordered = firstSummaryAfter !== firstSummaryBefore;

// Regression test for a review finding: forward step reorder used to
// overshoot by one slot for the same reason as the token reorder above,
// but only shows up when the drop target sits strictly *between* two other
// items - "move to the very end" happens to clamp to the same result
// either way, which is why the backward-drag check above never caught it.
// Add a third step so there's a middle slot to drop into, then drag the
// first item ("Untitled step", from the backward drag just above) forward
// to land just before the third.
await page.locator(".step-list__add").click();
await page.locator(".step-list__item").nth(2).click();
await page.locator(".step-details__field input").fill("Third step");
await page.locator("body").click({ position: { x: 5, y: 5 } }); // blur

const forwardStepItems = page.locator(".step-list__item");
const forwardDragSourceBox = await forwardStepItems.nth(0).boundingBox();
const forwardDragTargetBox = await forwardStepItems.nth(2).boundingBox();
await page.mouse.move(forwardDragSourceBox.x + forwardDragSourceBox.width / 2, forwardDragSourceBox.y + forwardDragSourceBox.height / 2);
await page.mouse.down();
await page.mouse.move(forwardDragTargetBox.x + forwardDragTargetBox.width / 2, forwardDragTargetBox.y + 2, { steps: 10 });
await page.mouse.up();
const summariesAfterForwardStepDrag = await forwardStepItems.locator(".step-list__summary").allTextContents();
const forwardStepDragLandsAtDropPoint =
  summariesAfterForwardStepDrag.length === 3 &&
  summariesAfterForwardStepDrag[0] === "Chop the onion" && // former 2nd item now 1st
  summariesAfterForwardStepDrag[1] === "Untitled step" && // dragged item lands just before "Third step"
  summariesAfterForwardStepDrag[2] === "Third step";

// Remove the temporary third step so downstream counts (the persistence
// check below expects exactly 2 steps) stay accurate, and refresh
// firstSummaryAfter to reflect the resulting order. `.step-list__remove` is
// a sibling of `.step-list__item` (the button), not a descendant of it -
// both live under the same `<li data-step-index>` - so it's targeted via
// that shared ancestor, not by scoping into the item button itself.
await page.locator("[data-step-index='2']").locator(".step-list__remove").click();
firstSummaryAfter = await page.locator(".step-list__item").first().locator(".step-list__summary").textContent();

// Task 13 (Undo/Redo): snapshot state first so this block can fully undo
// itself afterward, leaving the step count/order exactly as the
// persistence check below expects (it was captured just above, before this
// block runs).
const summariesBeforeHistoryTest = await page.locator(".step-list__summary").allTextContents();

// Discrete action: adding a step is its own undo step.
await page.locator(".step-list__add").click();
const stepCountAfterAddForHistoryTest = await page.locator(".step-list__item").count();
await undoButton.click();
const stepCountAfterUndoingAdd = await page.locator(".step-list__item").count();
const discreteActionUndoes =
  stepCountAfterAddForHistoryTest === summariesBeforeHistoryTest.length + 1 &&
  stepCountAfterUndoingAdd === summariesBeforeHistoryTest.length;

// Continuous action: typing a whole title (several keystrokes) must
// coalesce into ONE undo step, not one character at a time - StepDetails'
// title field calls its mutator on every keystroke with no local draft
// state (see state/document.ts's COALESCE_WINDOW_MS comment), so without
// coalescing, undo would only ever remove the last-typed character.
const originalFirstTitle = summariesBeforeHistoryTest[0];
await page.locator(".step-list__item").first().click();
await page.locator(".step-details__field input").fill("");
await page.locator(".step-details__field input").pressSequentially("Renamed step", { delay: 20 });
await page.locator("body").click({ position: { x: 5, y: 5 } }); // blur
const titleAfterTyping = await page.locator(".step-list__item").first().locator(".step-list__summary").textContent();
await undoButton.click(); // one click undoes the WHOLE typed title
const titleAfterOneUndo = await page.locator(".step-list__item").first().locator(".step-list__summary").textContent();
const continuousEditCoalescesIntoOneUndo =
  titleAfterTyping === "Renamed step" && titleAfterOneUndo === originalFirstTitle;

// Redo restores the coalesced edit in one step.
await redoButton.click();
const redoRestoresCoalescedEdit =
  (await page.locator(".step-list__item").first().locator(".step-list__summary").textContent()) === "Renamed step";

// Keyboard shortcuts: Ctrl+Z undoes, Ctrl+Shift+Z redoes.
await page.keyboard.press("Control+z");
const titleAfterCtrlZ = await page.locator(".step-list__item").first().locator(".step-list__summary").textContent();
await page.keyboard.press("Control+Shift+z");
const titleAfterCtrlShiftZ = await page.locator(".step-list__item").first().locator(".step-list__summary").textContent();
const keyboardShortcutsWork = titleAfterCtrlZ === originalFirstTitle && titleAfterCtrlShiftZ === "Renamed step";

// Undo the rename back out, leaving state exactly as this block found it.
await undoButton.click();
const summariesAfterHistoryTest = await page.locator(".step-list__summary").allTextContents();
const historyTestLeftStateUnchanged =
  JSON.stringify(summariesAfterHistoryTest) === JSON.stringify(summariesBeforeHistoryTest);

const undoRedoWorkedEndToEnd =
  discreteActionUndoes &&
  continuousEditCoalescesIntoOneUndo &&
  redoRestoresCoalescedEdit &&
  keyboardShortcutsWork &&
  historyTestLeftStateUnchanged;

// Task 8 (Live Preview): toggling it swaps the editor for a read-only canvas.
await page.locator(".app__preview-toggle").click();
await page.waitForSelector(".instruction-canvas--readonly");
const previewHidesEditingControls =
  (await page.locator(".instruction-canvas__chip-remove").count()) === 0 &&
  (await page.locator(".step-list").count()) === 0;
await page.screenshot({ path: path.join(OUT, "06-preview-mode.png"), fullPage: true });
await page.locator(".app__preview-toggle").click();
await page.waitForSelector(".step-list");

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
const summariesAfterReload = await page.locator(".step-list__summary").allTextContents();
const persistedAcrossReload =
  summariesAfterReload.length === 2 && summariesAfterReload[0] === firstSummaryAfter;

// Mobile viewport - canvas tokens must stay legible and single-row per step.
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: path.join(OUT, "04-mobile.png"), fullPage: true });

// Task 18 (JSON Export): add a temporary empty step so there's something for
// task 14's validation to flag, then export and confirm the downloaded file
// is the current document plus a non-blocking warning toast (the export
// itself must still succeed either way - "non-blocking" per
// docs/Fixed-Issues.md's design intent, not enforced there but this is where
// it's actually exercised).
await page.locator(".step-list__add").click();
const flagCountBeforeExport = await page.locator(".step-list__flag").count();
const [download] = await Promise.all([
  page.waitForEvent("download"),
  page.getByRole("button", { name: "Export", exact: true }).click(),
]);
const exportSuggestedFilename = download.suggestedFilename();
const exportPath = path.join(OUT, "exported-document.json");
await download.saveAs(exportPath);
const exportedDoc = JSON.parse(fs.readFileSync(exportPath, "utf8"));
const exportToastText = await page.locator(".app__toast").textContent();
const exportWarnedAboutIncompleteSteps =
  flagCountBeforeExport > 0 &&
  (await page.locator(".app__toast--warning").count()) === 1 &&
  exportToastText.includes(String(flagCountBeforeExport));
const jsonExportDownloadsCurrentDocument =
  exportSuggestedFilename === "untitled-instructions.json" &&
  exportedDoc.steps.length === (await page.locator(".step-list__item").count());
await page.screenshot({ path: path.join(OUT, "07-export-warning-toast.png"), fullPage: true });
await page.locator(".app__toast-dismiss").click();
const toastGoneAfterDismiss = (await page.locator(".app__toast").count()) === 0;

// Remove the temporary empty step so the step count is back to what it was.
await page.locator("[data-step-index='2']").locator(".step-list__remove").click();

// Task 19 (Import): a small valid document, imported via the hidden file
// input (Playwright's setInputFiles fires the same `change` event a real
// file picker would, so the visually-hidden input - proxied by the visible
// "Import" button in normal use - doesn't need to actually be clicked open).
const summariesBeforeImportTest = await page.locator(".step-list__summary").allTextContents();
const importFileInput = page.locator('input[type="file"]');
const validImportDoc = {
  schemaVersion: 1,
  meta: { title: "Driver Import Test", domain: "recipe", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  steps: [
    { id: "import-step-1", title: "Imported step", tokens: [{ id: "import-token-1", category: "action", iconId: "chop", label: "Chop" }] },
  ],
};
await importFileInput.setInputFiles({
  name: "import.json",
  mimeType: "application/json",
  buffer: Buffer.from(JSON.stringify(validImportDoc)),
});
const importDialogMentionsStepCount = (await page.locator(".import-confirm-dialog").textContent()).includes("1 step");
await page.screenshot({ path: path.join(OUT, "08-import-confirm-dialog.png"), fullPage: true });
await page.getByRole("button", { name: "Replace", exact: true }).click();
const summariesAfterImport = await page.locator(".step-list__summary").allTextContents();
const importReplacedDocument = summariesAfterImport.length === 1 && summariesAfterImport[0] === "Imported step";
await page.locator(".app__toast-dismiss").click();

// Undo/redo must cover import too, same as every other mutation - an
// accidental "Replace" is one Ctrl+Z away from being reverted.
await page.keyboard.press("Control+z");
const summariesAfterUndoingImport = await page.locator(".step-list__summary").allTextContents();
const undoRevertsImport = JSON.stringify(summariesAfterUndoingImport) === JSON.stringify(summariesBeforeImportTest);
await page.keyboard.press("Control+Shift+z");
const summariesAfterRedoingImport = await page.locator(".step-list__summary").allTextContents();
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
const noDialogForUnparseableFile = (await page.locator(".import-confirm-dialog").count()) === 0;
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
const noDialogForWrongShapeFile = (await page.locator(".import-confirm-dialog").count()) === 0;
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
const summariesAfterCancelingImport = await page.locator(".step-list__summary").allTextContents();
const importCancelLeavesDocumentUnchanged =
  (await page.locator(".import-confirm-dialog").count()) === 0 &&
  JSON.stringify(summariesAfterCancelingImport) === JSON.stringify(summariesBeforeImportTest);

await browser.close();

console.log("SCREENSHOTS_DIR=" + OUT);
console.log("TABS_FILTER_TOKENS=" + tabsFilterTokens);
console.log("TOKEN_SELECTED_AFTER_FIRST_CLICK=" + tokenSelectedAfterFirstClick);
console.log("TOKEN_LABEL_UPDATED=" + tokenLabelUpdated);
console.log("ATTACHMENTS_WORKED_END_TO_END=" + attachmentsWorkedEndToEnd);
console.log("QUANTITY_FORM_RESETS_PER_TOKEN=" + quantityFormResetsPerToken);
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
console.log("CANVAS_KEYBOARD_FOCUSABLE=" + canvasControlFocused);
console.log("JSON_EXPORT_DOWNLOADS_CURRENT_DOCUMENT=" + jsonExportDownloadsCurrentDocument);
console.log("JSON_EXPORT_WARNS_ABOUT_INCOMPLETE_STEPS=" + exportWarnedAboutIncompleteSteps);
console.log("TOAST_DISMISSIBLE=" + toastGoneAfterDismiss);
console.log("IMPORT_DIALOG_MENTIONS_STEP_COUNT=" + importDialogMentionsStepCount);
console.log("IMPORT_UNDO_REDO_WORKED=" + importUndoRedoWorked);
console.log("IMPORT_REJECTS_INVALID_FILE=" + importRejectsInvalidFile);
console.log("IMPORT_CANCEL_LEAVES_DOCUMENT_UNCHANGED=" + importCancelLeavesDocumentUnchanged);
console.log("CONSOLE_ERRORS_COUNT=" + errors.length);
for (const e of errors) console.log(e);
