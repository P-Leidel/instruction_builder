import type { RefObject } from "preact";
import { selectStep, removeStep, moveStepUp, moveStepDown, reorderSteps, selectedStepId, selectedTokenId } from "../../state/document";
import { dragGhost, dropTarget } from "../../state/drag";
import { beginPointerDrag, resolveStepDropIndex } from "../../lib/pointer-drag";
import {
  PADDING,
  CHIP_HEIGHT,
  BADGE_SIZE,
  MARKER_WIDTH,
  STEP_CONTROL_CX,
  STEP_CONTROL_RADIUS,
  REORDER_HANDLE_CY,
  MOVE_UP_CY,
  MOVE_DOWN_CY,
  insertionMarkerPosition,
} from "../../lib/canvas-layout";
import type { StepLayout } from "../../lib/canvas-layout";
import { SvgButton } from "./SvgButton";
import { TokenChip } from "./TokenChip";

// A step's remove control (×), top-right corner of the card - same visual
// language as the chip's own remove button (TokenChip.tsx), sized to match.
// The incomplete-step flag (!) shares that corner, positioned this button's
// STEP_FLAG_GAP to its left rather than at a fixed offset from the card
// edge - simpler than branching the flag's own x on whether the remove
// button happens to be shown for this particular step (it isn't, for the
// sole remaining step - see stepCount guard below).
const STEP_REMOVE_RADIUS = 9;
const STEP_REMOVE_CY = 12;
const STEP_REMOVE_MARGIN = 14; // distance from the card's right edge to the remove button's center
const STEP_FLAG_GAP = 28;

interface StepCardProps {
  layout: StepLayout;
  index: number;
  /** Total step count in the document - needed for canMoveDown/canReorder/canRemove, distinct from `index`. */
  stepCount: number;
  canvasWidth: number;
  readOnly: boolean;
  /** The canvas's own <svg> ref, needed only to resolve a reorder drag's drop index (resolveStepDropIndex). */
  svgRef: RefObject<SVGSVGElement>;
}

/**
 * One step card: select badge, title (with its own duration prefix),
 * incomplete-step flag, remove control, reorder/move-up/move-down controls,
 * and the row of `TokenChip`s it contains (plus their connectors and live
 * drag insertion marker). See InstructionCanvas's own doc comment for the
 * two-stage select model and the overall step-management behaviour this is
 * part of.
 */
export function StepCard({ layout, index, stepCount, canvasWidth, readOnly, svgRef }: StepCardProps) {
  const { step, cardY, displayedTime, height, chipsPerRow, issues, shouldFlagIncomplete, chipPositions, connectors, tokensOffsetX } =
    layout;

  const isSelected = !readOnly && step.id === selectedStepId.value;
  // The live drag slot, but only while the pointer is over *this* step - the
  // row travels with it, since the drop index alone can't say which side of
  // a row boundary the marker belongs on (see insertionMarkerPosition).
  const hovered = dropTarget.value;
  const hoveredSlot = !readOnly && hovered?.stepId === step.id ? hovered : null;
  const stepNumber = index + 1;
  // shouldFlagIncomplete (canvas-layout.ts, via model/validate.ts's
  // shouldFlagIncompleteStep): a step with zero tokens is always technically
  // incomplete, but the persistent badge (and this label) is deferred until
  // the user has actually added one, so a brand-new document doesn't flag
  // itself before anything has been built. Export's own incomplete-step
  // warning toast still checks `isComplete` directly and is unaffected.
  const selectLabel = shouldFlagIncomplete
    ? `Select step ${stepNumber}, incomplete: ${issues.join(", ")}`
    : `Select step ${stepNumber}`;

  const canMoveUp = index > 0;
  const canMoveDown = index < stepCount - 1;
  const canReorder = !readOnly && stepCount > 1;
  const canRemove = !readOnly && stepCount > 1;

  return (
    <g transform={`translate(${PADDING}, ${cardY})`} data-step-id={step.id} data-step-index={index}>
      <rect
        class={`instruction-canvas__step-bg${isSelected ? " instruction-canvas__step-bg--selected" : ""}${hoveredSlot ? " instruction-canvas__step-bg--drop-target" : ""}`}
        x={0}
        y={0}
        width={canvasWidth - PADDING * 2}
        height={height}
        rx={8}
        onClick={readOnly ? undefined : () => selectStep(step.id)}
      />
      {readOnly ? (
        <g class="instruction-canvas__badge" aria-hidden="true">
          <circle cx={12} cy={12} r={BADGE_SIZE / 2} />
          <text x={12} y={16} text-anchor="middle">
            {stepNumber}
          </text>
        </g>
      ) : (
        <SvgButton
          class="instruction-canvas__badge"
          ariaCurrent={isSelected ? "step" : undefined}
          ariaLabel={selectLabel}
          onActivate={() => selectStep(step.id)}
        >
          <circle cx={12} cy={12} r={BADGE_SIZE / 2} />
          <text x={12} y={16} text-anchor="middle" aria-hidden="true">
            {stepNumber}
          </text>
        </SvgButton>
      )}
      <text class="instruction-canvas__step-title" x={BADGE_SIZE + 12} y={16} aria-hidden="true">
        {displayedTime && (
          <>
            <tspan class="instruction-canvas__step-time">{displayedTime.label}</tspan>
            {" - "}
          </>
        )}
        <tspan class="instruction-canvas__step-title-text">{step.title || "Untitled step"}</tspan>
      </text>
      {shouldFlagIncomplete && (
        <g aria-hidden="true">
          <text
            class="instruction-canvas__flag"
            x={canvasWidth - PADDING * 2 - STEP_REMOVE_MARGIN - STEP_FLAG_GAP}
            y={20}
          >
            !<title>{issues.join(", ")}</title>
          </text>
        </g>
      )}
      {canRemove && (
        <SvgButton
          class="instruction-canvas__step-remove"
          ariaLabel={`Remove step ${stepNumber}`}
          onActivate={() => removeStep(step.id)}
        >
          <circle cx={canvasWidth - PADDING * 2 - STEP_REMOVE_MARGIN} cy={STEP_REMOVE_CY} r={STEP_REMOVE_RADIUS} />
          <text
            x={canvasWidth - PADDING * 2 - STEP_REMOVE_MARGIN}
            y={STEP_REMOVE_CY + 3}
            text-anchor="middle"
            aria-hidden="true"
          >
            ×
          </text>
        </SvgButton>
      )}
      {canReorder && (
        <g class="instruction-canvas__step-controls">
          <g
            class="instruction-canvas__step-drag-handle"
            aria-hidden="true"
            onPointerDown={(event) => {
              beginPointerDrag(event, {
                onMove: (x, y) => {
                  dragGhost.value = { label: step.title || "Untitled step", x, y };
                },
                onDrop: (_x, y, wasDrag) => {
                  dragGhost.value = null;
                  if (!wasDrag || !svgRef.current) return;
                  reorderSteps(index, resolveStepDropIndex(y, svgRef.current));
                },
                // No dropTarget to clear - a step-reorder drag never sets one
                // (it has no insertion marker of its own yet; see
                // docs/known-issues.md) - so this only drops the ghost.
                onCancel: () => {
                  dragGhost.value = null;
                },
              });
            }}
          >
            <circle cx={STEP_CONTROL_CX} cy={REORDER_HANDLE_CY} r={STEP_CONTROL_RADIUS} />
            <text x={STEP_CONTROL_CX} y={REORDER_HANDLE_CY + 3} text-anchor="middle">
              ⠿
            </text>
          </g>
          <SvgButton
            class={`instruction-canvas__step-move instruction-canvas__step-move--up${canMoveUp ? "" : " instruction-canvas__step-move--disabled"}`}
            disabled={!canMoveUp}
            ariaLabel={`Move step ${stepNumber} up`}
            onActivate={() => moveStepUp(step.id)}
          >
            <circle cx={STEP_CONTROL_CX} cy={MOVE_UP_CY} r={STEP_CONTROL_RADIUS} />
            <text x={STEP_CONTROL_CX} y={MOVE_UP_CY + 3} text-anchor="middle" aria-hidden="true">
              ↑
            </text>
          </SvgButton>
          <SvgButton
            class={`instruction-canvas__step-move instruction-canvas__step-move--down${canMoveDown ? "" : " instruction-canvas__step-move--disabled"}`}
            disabled={!canMoveDown}
            ariaLabel={`Move step ${stepNumber} down`}
            onActivate={() => moveStepDown(step.id)}
          >
            <circle cx={STEP_CONTROL_CX} cy={MOVE_DOWN_CY} r={STEP_CONTROL_RADIUS} />
            <text x={STEP_CONTROL_CX} y={MOVE_DOWN_CY + 3} text-anchor="middle" aria-hidden="true">
              ↓
            </text>
          </SvgButton>
        </g>
      )}
      <g transform={`translate(${tokensOffsetX}, 0)`}>
        <g class="instruction-canvas__connectors" aria-hidden="true">
          {connectors.map((segment) => (
            <path key={segment.key} class="instruction-canvas__connector" d={segment.d} />
          ))}
        </g>
        <g class="instruction-canvas__tokens">
          {step.tokens.map((token, tokenIndex) => (
            <TokenChip
              key={token.id}
              token={token}
              position={chipPositions[tokenIndex]}
              tokenIndex={tokenIndex}
              stepId={step.id}
              isStepSelected={isSelected}
              isTokenSelected={isSelected && token.id === selectedTokenId.value}
              readOnly={readOnly}
            />
          ))}
        </g>
        {hoveredSlot !== null &&
          (() => {
            const marker = insertionMarkerPosition(
              Math.min(hoveredSlot.index, step.tokens.length),
              chipPositions,
              chipsPerRow,
              hoveredSlot.row,
            );
            return (
              <rect
                class="instruction-canvas__insertion-marker"
                x={marker.cx - MARKER_WIDTH / 2}
                y={marker.cy}
                width={MARKER_WIDTH}
                height={CHIP_HEIGHT}
                rx={1.5}
                aria-hidden="true"
              />
            );
          })()}
      </g>
    </g>
  );
}
