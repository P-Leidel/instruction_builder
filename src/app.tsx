import { StepList } from "./components/StepList/StepList";
import { StepDetails } from "./components/StepDetails/StepDetails";
import { TokenDetails } from "./components/TokenDetails/TokenDetails";
import { InstructionCanvas } from "./components/InstructionCanvas/InstructionCanvas";
import { TokenPicker } from "./components/TokenPicker/TokenPicker";
import { TokenAttachmentPicker } from "./components/TokenAttachmentPicker/TokenAttachmentPicker";
import { DragGhost } from "./components/DragGhost/DragGhost";
import { previewMode } from "./state/ui";
import { persistenceStatus } from "./state/persistence";

/**
 * Phase 2 task 5: the toolbar/canvas/panel regions from
 * docs/phase-1/Architecture.md section 5. Placement is driven entirely by
 * grid-template-areas in global.css, so repositioning a region later (e.g.
 * moving StepList to the other side) is a CSS-only change - no markup here
 * needs to move.
 *
 * The canvas region now renders InstructionCanvas (task 6), replacing
 * Phase 1's StepBuilder HTML prototype now that the interaction model is
 * validated (docs/phase-1/UX-and-Wireframes.md).
 *
 * Task 8 (Live Preview): toggling `previewMode` swaps the whole editor for
 * a read-only `InstructionCanvas` - the exact same SVG, just with every
 * editing affordance turned off, rather than a second rendering pipeline.
 *
 * Task 12 (Data Persistence): the document is auto-saved to IndexedDB by
 * state/persistence.ts, invisibly, unless that fails (e.g. Safari private
 * browsing), in which case a banner here warns that changes won't survive
 * closing the tab rather than losing work silently.
 */
export function App() {
  return (
    <div class="app">
      <header class="app__toolbar">
        <div class="app__titles">
          <h1>Visual Instruction Builder</h1>
          <p class="app__tagline">Phase 2 — instruction canvas</p>
        </div>
        <button
          type="button"
          class="app__preview-toggle"
          onClick={() => (previewMode.value = !previewMode.value)}
        >
          {previewMode.value ? "Back to editor" : "Preview"}
        </button>
      </header>
      {persistenceStatus.value === "unavailable" && (
        <p class="app__persistence-warning" role="status">
          Your browser blocked local saving (this is common in private
          browsing). Changes will be lost when you close this tab.
        </p>
      )}
      <main class={`app__main${previewMode.value ? " app__main--preview" : ""}`}>
        {previewMode.value ? (
          <InstructionCanvas readOnly />
        ) : (
          <>
            <StepList />
            <StepDetails />
            <TokenDetails />
            <InstructionCanvas />
            <TokenPicker />
            <TokenAttachmentPicker />
          </>
        )}
      </main>
      <DragGhost />
    </div>
  );
}
