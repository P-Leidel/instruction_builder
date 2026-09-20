import { signal } from "@preact/signals";
import type { TokenDropSlot } from "../lib/canvas-layout";

/**
 * Transient drag-in-progress UI state (task 9), separate from document/
 * selection state since none of it is part of the saved document.
 */
export interface DragGhost {
  label: string;
  x: number;
  y: number;
}

/** The floating label that follows the pointer during a drag, or null when idle. */
export const dragGhost = signal<DragGhost | null>(null);

/**
 * The step - and, once dragging a token, the exact slot within it - the
 * pointer is currently over. `StepCard` uses the slot to render a live
 * insertion-point marker (not just a highlight on the whole step), updating
 * as the pointer moves over different chips. Typed as `TokenDropSlot` (not a
 * separate local type) since it only ever holds `resolveDropTarget`'s
 * return value - which carries the hovered row alongside the drop index,
 * because the index alone doesn't say where to draw at a row boundary (see
 * `TokenDropSlot`'s own comment). Consumers that only perform the move, like
 * `moveToken`, still take the narrower `TokenDropTarget` it extends.
 *
 * Write it through `setDropTarget` below rather than assigning directly.
 */
export const dropTarget = signal<TokenDropSlot | null>(null);

/**
 * Sets `dropTarget` only when the hovered slot actually changed. Every
 * `StepCard` subscribes to this signal, so assigning an equal-but-new object
 * re-renders every step in the document for nothing - and a drag writes one
 * per animation frame, for as long as the drag lasts. This lives here, as
 * the one way to write the signal, because it was previously hand-written
 * inside `TokenChip`'s move handler and simply missing from `TokenPicker`'s:
 * one of the two drag sources had the guard and the other re-rendered the
 * whole canvas at refresh rate. Two copies of a guard is two copies to keep
 * in step; one setter beside the signal can't drift.
 */
export function setDropTarget(next: TokenDropSlot | null): void {
  const current = dropTarget.value;
  if (current?.stepId === next?.stepId && current?.index === next?.index && current?.row === next?.row) {
    return;
  }
  dropTarget.value = next;
}

/**
 * Tears down everything a drag leaves behind in this module - the floating
 * ghost and the hovered drop slot - in one call.
 *
 * Both drag sources end a drag on two paths each (drop and cancel), and all
 * four have to clear exactly this pair: a ghost left behind follows the
 * pointer with no drag under it, and a stale drop slot keeps an insertion
 * marker drawn in a step nothing is hovering. That pairing was hand-written
 * at three of those four sites and extracted at the fourth, which is the
 * same drift `setDropTarget` above exists to prevent - so it gets the same
 * treatment: one teardown beside the signals it tears down. A caller with
 * its own local drag state (TokenChip dims its source chip) still wraps this
 * rather than replacing it, because that state isn't ours to clear.
 */
export function clearDrag(): void {
  dragGhost.value = null;
  setDropTarget(null);
}
