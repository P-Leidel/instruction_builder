import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { document, addStep } from "../../state/document";
import { DESKTOP_QUERY, PADDING, ADD_STEP_ROW_HEIGHT, computeCanvasLayout } from "../../lib/canvas-layout";
import { sumDurations, stepDisplayedTime } from "../../lib/duration";
import { SvgButton } from "./SvgButton";
import { StepCard } from "./StepCard";

/**
 * Tracks the `min-width: 800px` breakpoint so layout can switch between
 * desktop's wrapped multi-row chips and mobile's single row per step. Kept
 * as a plain hook (not a signal) since it's a local rendering concern, not
 * shared app state.
 */
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia(DESKTOP_QUERY).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => setIsDesktop(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isDesktop;
}

interface InstructionCanvasProps {
  /**
   * Task 8 (Live Preview): renders the same SVG with every editing
   * affordance (badges, remove controls, drag, selection) turned off,
   * standing in for "what this looks like exported" ahead of the real
   * export pipeline (tasks 15-17), instead of a second rendering pipeline.
   * Task 15 (SVG Export) reuses this exact mode: `App` keeps one hidden,
   * always-rendered `readOnly` instance around purely so the export button
   * has a live, always-current SVG node to serialize (see
   * `lib/svg-export.ts`) - export never re-renders or recomputes layout on
   * its own.
   */
  readOnly?: boolean;
}

/**
 * Phase 2 task 6: renders the whole document as native SVG, replacing
 * StepBuilder's HTML prototype now that Phase 1 validated the interaction
 * model. Token icons (task 7) are inlined Lucide path markup resolved by
 * `iconId` via data/icon-library.ts - inlined rather than referenced with
 * `<image href>` so a future SVG export (task 15) stays self-contained.
 * Layout geometry (chip/connector/insertion-marker positions, canvas
 * sizing) lives in `lib/canvas-layout.ts`, not here - this component only
 * renders whatever that module computes (task 15 prep, per an external
 * architecture audit - see docs/known-issues.md).
 *
 * Each step's "select" control is a small header badge, kept as a sibling
 * of the token chips (not a wrapper around them) so no interactive element
 * ends up nested inside another.
 *
 * Selection is two-stage: clicking anywhere on a step that isn't already
 * selected (its background, badge, or one of its tokens) selects the step.
 * Once a step is already selected, clicking one of its tokens selects that
 * token instead (surfaced in the TokenDetails panel). Tokens carry no
 * keyboard role - the header badge stays the only keyboard-reachable way to
 * select a step.
 *
 * Task 9 (Drag-and-Drop): a token chip is also a drag source - dragging it
 * over a step (`data-step-id`) or a specific chip (`data-token-index`)
 * moves it there via `moveToken`. A quick tap with no real movement still
 * runs the plain select logic above (see `beginPointerDrag`'s `wasDrag`).
 * While dragging, the step being hovered shows a live insertion marker at
 * the exact slot the token would land in (`dropTarget`'s index), not just a
 * highlight on the step as a whole.
 * Task 10 (Touch Support) is largely "this already works on touch" since
 * Pointer Events unify the input types - `touch-action: none` on the chips
 * (global.css) stops the browser from scrolling the page mid-drag instead.
 *
 * Connector lines: a plain line is drawn between each pair of consecutive
 * tokens within a step (array order), so the sequence reads clearly even
 * before adding per-connection styling. Steps stay visually separate - no
 * lines are drawn between steps. Lines are computed purely from token order,
 * not stored - see docs/planned-additions.md #3 for what per-connection
 * style/labels would need later.
 *
 * On mobile (below the 800px breakpoint) each step's tokens stay in a
 * single row instead of wrapping, and the SVG's rendered width is clamped
 * (see .instruction-canvas__svg in global.css) so icons neither shrink
 * below nor grow past a reasonable size - both are easy to revisit later
 * (swap the mobile chipsPerRow back to the wrapped desktop formula, or
 * change the clamp bounds).
 *
 * A token with its own `time` (see InstructionToken.time) shows it above
 * its chip - `lib/canvas-layout.ts` reserves the room per row of chips
 * (only when a row actually has a timed token in it), not here; this just
 * renders the label for whichever tokens have one. A step's own duration
 * (`displayedTime`) instead renders inline before its title, in the same
 * text node - see the step-title `<text>` below - rather than reserving any
 * extra layout room of its own.
 *
 * Step management (previously a standalone StepList side panel) lives on the
 * canvas itself: each step's title renders next to its select badge, a
 * left-edge control column below the badge holds a drag-to-reorder handle
 * (pointer-only, same `beginPointerDrag`/`dragGhost` pattern as a token
 * drag, drop slot resolved via `resolveStepDropIndex`) plus click-only move
 * up/down buttons (the keyboard-operable path, each disabled at its end of
 * the list), and a remove (×) button sits in the card's top-right corner -
 * both the reorder controls and remove are hidden for the sole remaining
 * step, same rule StepList used. A dashed "+ Add step" row renders inside
 * the SVG just past the last step. All of it is hidden when `readOnly`, same
 * as the token-level editing controls above.
 */
export function InstructionCanvas({ readOnly = false }: InstructionCanvasProps) {
  const steps = document.value.steps;
  const isDesktop = useIsDesktop();
  const svgRef = useRef<SVGSVGElement>(null);

  const { layouts, totalHeight, canvasWidth, addStepRowY } = useMemo(
    () => computeCanvasLayout(steps, isDesktop),
    [steps, isDesktop],
  );
  // computeCanvasLayout stays read-only-agnostic (document + isDesktop is its
  // whole interface - see its own comment), so the "+ Add step" row's extra
  // height only applies here, where readOnly is actually known: the read-only/
  // export canvas stays exactly totalHeight tall (no trailing gap for a row
  // it never draws), the editable one reserves ADD_STEP_ROW_HEIGHT + PADDING
  // past addStepRowY for it.
  const svgHeight = readOnly ? totalHeight : addStepRowY + ADD_STEP_ROW_HEIGHT + PADDING;

  // Document-level echo of the step-title time pattern below (displayedTime
  // + step title in one <text>): total is undefined - and hidden - unless at
  // least one step has a time of its own to show, same "nothing to sum"
  // floor as stepDisplayedTime/sumDurations already apply per step.
  const totalTime = sumDurations(steps.map(stepDisplayedTime));

  return (
    <div class={`instruction-canvas${readOnly ? " instruction-canvas--readonly" : ""}`}>
      <h2 class="instruction-canvas__heading">
        {totalTime && (
          <>
            <span class="instruction-canvas__heading-time">{totalTime.label}</span>
            {" - "}
          </>
        )}
        <span class="instruction-canvas__heading-title">
          {document.value.meta.title || "Untitled instructions"}
        </span>
      </h2>
      <svg
        ref={svgRef}
        class="instruction-canvas__svg"
        viewBox={`0 0 ${canvasWidth} ${svgHeight}`}
        role="group"
        aria-label={
          readOnly
            ? `${steps.length} instruction step${steps.length === 1 ? "" : "s"}, read-only preview`
            : `${steps.length} instruction step${steps.length === 1 ? "" : "s"}, each with a select button and removable tokens`
        }
      >
        {layouts.map((layout, index) => (
          <StepCard
            key={layout.step.id}
            layout={layout}
            index={index}
            stepCount={steps.length}
            canvasWidth={canvasWidth}
            readOnly={readOnly}
            svgRef={svgRef}
          />
        ))}
        {!readOnly && (
          <SvgButton
            class="instruction-canvas__add-step"
            ariaLabel="Add step"
            transform={`translate(${PADDING}, ${addStepRowY})`}
            onActivate={addStep}
          >
            <rect
              class="instruction-canvas__add-step-bg"
              x={0}
              y={0}
              width={canvasWidth - PADDING * 2}
              height={ADD_STEP_ROW_HEIGHT}
              rx={8}
            />
            <text
              x={(canvasWidth - PADDING * 2) / 2}
              y={ADD_STEP_ROW_HEIGHT / 2 + 5}
              text-anchor="middle"
              aria-hidden="true"
            >
              + Add step
            </text>
          </SvgButton>
        )}
      </svg>
    </div>
  );
}
