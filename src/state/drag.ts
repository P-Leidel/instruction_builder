import { signal } from "@preact/signals";

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

export interface DropTarget {
  stepId: string;
  /** Insertion index within the target step's tokens; Infinity means "append". */
  index: number;
}

/**
 * The step - and, once dragging a token, the exact slot within it - the
 * pointer is currently over. `InstructionCanvas` uses `index` to render a
 * live insertion-point marker (not just a highlight on the whole step),
 * updating as the pointer moves over different chips.
 */
export const dropTarget = signal<DropTarget | null>(null);
