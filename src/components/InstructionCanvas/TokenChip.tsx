import { useState } from "preact/hooks";
import { selectStep, selectToken, moveToken, removeTokenFromStep } from "../../state/document";
import { clearDrag, dragGhost, dropTarget, setDropTarget } from "../../state/drag";
import { resolveLiveDropTarget } from "../../state/canvas";
import { beginPointerDrag, resolveTokenPointerOutcome } from "../../lib/pointer-drag";
import { iconMarkup, ICON_PRESENTATION_PROPS } from "../../data/icon-library";
import { CHIP_WIDTH, CHIP_HEIGHT, CHIP_TIME_HEADER_HEIGHT, ICON_DRAW_SIZE } from "../../lib/canvas-layout";
import type { ChipPosition } from "../../lib/canvas-layout";
import type { InstructionToken, TokenAttachment } from "../../model/instruction";
import { SvgButton } from "./SvgButton";

// Warning badge (see InstructionToken.warning): a small, fixed-corner
// icon-only marker on a chip, chosen over resizing the chip so the existing
// row/wrap layout math (lib/canvas-layout.ts) never has to account for a
// token being "taller" because it happens to have a warning. Quantity's own
// badge (below) needs visible text instead, so it gets a different shape (a
// pill, not a circle) - Time has no chip badge at all, see InstructionCanvas's
// step-level duration header instead.
const WARNING_BADGE_RADIUS = 9;
const WARNING_BADGE_ICON_SIZE = 12;
const WARNING_BADGE_POS = { cx: WARNING_BADGE_RADIUS + 1, cy: WARNING_BADGE_RADIUS + 1 };

/** The chip's top-left warning marker. */
function WarningBadge({ attachment }: { attachment: TokenAttachment }) {
  const { cx, cy } = WARNING_BADGE_POS;
  const iconScale = WARNING_BADGE_ICON_SIZE / ICON_DRAW_SIZE;
  return (
    <g class="instruction-canvas__chip-badge instruction-canvas__chip-badge--warning" aria-hidden="true">
      <circle cx={cx} cy={cy} r={WARNING_BADGE_RADIUS} />
      <g
        class="instruction-canvas__chip-badge-icon"
        transform={`translate(${cx - WARNING_BADGE_ICON_SIZE / 2}, ${cy - WARNING_BADGE_ICON_SIZE / 2}) scale(${iconScale})`}
        {...ICON_PRESENTATION_PROPS}
        dangerouslySetInnerHTML={{ __html: iconMarkup(attachment.iconId) ?? "" }}
      />
      <title>{attachment.label ?? "Warning"}</title>
    </g>
  );
}

// Quantity's badge shows its actual value ("250 g") as text, unlike
// Warning's icon-only marker - a fixed-size pill (rather than sizing to the
// text) keeps every chip's badge the same footprint regardless of how long
// the amount+unit string happens to be, comfortably fitting the longest
// realistic value ("99999 pinch") without measuring text at render time.
const QUANTITY_PILL_WIDTH = 80;
const QUANTITY_PILL_HEIGHT = 16;
const QUANTITY_PILL_MARGIN_BOTTOM = 4;

/** The chip's bottom-center quantity value pill - text only, no icon, so it never crowds the token's own icon/label above it. */
function QuantityBadge({ attachment }: { attachment: TokenAttachment }) {
  const cx = CHIP_WIDTH / 2;
  const y = CHIP_HEIGHT - QUANTITY_PILL_HEIGHT - QUANTITY_PILL_MARGIN_BOTTOM;
  return (
    <g class="instruction-canvas__chip-badge instruction-canvas__chip-badge--quantity" aria-hidden="true">
      <rect
        x={cx - QUANTITY_PILL_WIDTH / 2}
        y={y}
        width={QUANTITY_PILL_WIDTH}
        height={QUANTITY_PILL_HEIGHT}
        rx={QUANTITY_PILL_HEIGHT / 2}
      />
      <text x={cx} y={y + QUANTITY_PILL_HEIGHT / 2 + 3} text-anchor="middle">
        {attachment.label}
      </text>
    </g>
  );
}

interface TokenChipProps {
  token: InstructionToken;
  /**
   * This token's position within its step, and its flat index among
   * step.tokens - the index says where this chip already sits, which is what
   * makes a drag that ends on its own slot fall back to the tap
   * (`resolveTokenPointerOutcome`). It is no longer rendered as a
   * `data-token-index` attribute: nothing reads the DOM to find a chip any
   * more, since `resolveDropTarget` builds every chip's extent from the
   * layout instead (2026-09-20 candidate 1).
   */
  position: ChipPosition;
  tokenIndex: number;
  stepId: string;
  /** Whether the token's own step is already selected - see InstructionCanvas's two-stage select behavior. */
  isStepSelected: boolean;
  isTokenSelected: boolean;
  readOnly: boolean;
}

/**
 * One token chip: icon, label, warning/quantity badges, remove control, and
 * the drag source for both reordering within a step and moving between
 * steps (Task 9). A quick tap with no real movement runs the plain
 * select logic instead (see `beginPointerDrag`'s `wasDrag`) - selecting the
 * step if it wasn't already selected, or this token itself if it was. So
 * does a drag that ends back on this chip's own slot, which is no move at
 * all; `resolveTokenPointerOutcome` decides that, given where this chip
 * already sits (`stepId`/`tokenIndex`).
 */
export function TokenChip({
  token,
  position,
  tokenIndex,
  stepId,
  isStepSelected,
  isTokenSelected,
  readOnly,
}: TokenChipProps) {
  const label = token.label || token.iconId;
  // Whether *this* chip is the one currently being dragged, so it can dim
  // while its ghost is in flight. Plain local state, not anything shared:
  // the chip that started the drag is the only one that needs to know, and
  // keeping it local means a TokenPicker drag (which has no source chip)
  // correctly dims nothing. Set from onMove rather than the pointerdown
  // itself, so it marks a real drag passing `beginPointerDrag`'s threshold -
  // a plain tap, which is also how a token gets selected, never flickers.
  const [isDragging, setIsDragging] = useState(false);

  function endDrag() {
    setIsDragging(false);
    clearDrag();
  }

  return (
    <g
      class={`instruction-canvas__token${isDragging ? " instruction-canvas__token--dragging" : ""}`}
      transform={`translate(${position.cx}, ${position.cy})`}
      data-step-id={stepId}
      onPointerDown={
        readOnly
          ? undefined
          : (event) => {
              beginPointerDrag(event, {
                onMove: (x, y) => {
                  setIsDragging(true);
                  dragGhost.value = { label, x, y };
                  setDropTarget(resolveLiveDropTarget(x, y));
                },
                onDrop: (_x, _y, wasDrag) => {
                  // The slot the insertion marker was previewing at the
                  // moment of release, read before endDrag clears it -
                  // not a second, independent resolution of the drop
                  // coordinates. beginPointerDrag runs a final onMove at
                  // exactly this point first, so what the user last saw and
                  // what lands here are the same resolution by construction.
                  const previewed = dropTarget.value;
                  endDrag();
                  const outcome = resolveTokenPointerOutcome(
                    wasDrag,
                    isStepSelected,
                    wasDrag ? previewed : null,
                    { stepId, index: tokenIndex },
                  );
                  switch (outcome.kind) {
                    case "selectStep":
                      selectStep(stepId);
                      break;
                    case "selectToken":
                      selectToken(stepId, token.id);
                      break;
                    case "move":
                      moveToken(stepId, token.id, outcome.target.stepId, outcome.target.index);
                      break;
                    case "none":
                      break;
                  }
                },
                // A cancelled drag tears down the same transient state a drop
                // does, but performs no action at all - see DragHandlers.
                onCancel: endDrag,
              });
            }
      }
    >
      {token.time && (
        <text
          class="instruction-canvas__chip-time"
          x={CHIP_WIDTH / 2}
          y={-CHIP_TIME_HEADER_HEIGHT + 10}
          text-anchor="middle"
        >
          {token.time.label}
        </text>
      )}
      <rect
        class={`instruction-canvas__chip${
          token.category === "warning" ? " instruction-canvas__chip--warning" : ""
        }${isTokenSelected ? " instruction-canvas__chip--selected" : ""}`}
        width={CHIP_WIDTH}
        height={CHIP_HEIGHT}
        rx={8}
        aria-hidden="true"
      />
      <g
        class="instruction-canvas__chip-icon"
        transform={`translate(${(CHIP_WIDTH - ICON_DRAW_SIZE) / 2}, 4)`}
        aria-hidden="true"
        {...ICON_PRESENTATION_PROPS}
        dangerouslySetInnerHTML={{ __html: iconMarkup(token.iconId) ?? "" }}
      />
      <text class="instruction-canvas__chip-label" x={CHIP_WIDTH / 2} y={40} text-anchor="middle" aria-hidden="true">
        {label}
      </text>
      {token.warning && <WarningBadge attachment={token.warning} />}
      {token.quantity && <QuantityBadge attachment={token.quantity} />}
      {!readOnly && (
        <SvgButton
          class="instruction-canvas__chip-remove"
          ariaLabel={`Remove ${label}`}
          stopPropagation
          onActivate={() => removeTokenFromStep(stepId, token.id)}
        >
          <g onPointerDown={(event) => event.stopPropagation()}>
            <circle cx={CHIP_WIDTH - 10} cy={10} r={9} />
            <text x={CHIP_WIDTH - 10} y={13} text-anchor="middle" aria-hidden="true">
              ×
            </text>
          </g>
        </SvgButton>
      )}
    </g>
  );
}
