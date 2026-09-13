import { dragGhost } from "../../state/drag";

/**
 * A small floating label that follows the pointer during a drag (task 9),
 * rendered once at the app root so it can sit above every panel regardless
 * of which one the drag started in.
 */
export function DragGhost() {
  const ghost = dragGhost.value;
  if (!ghost) return null;
  return (
    <div class="drag-ghost" style={{ left: `${ghost.x}px`, top: `${ghost.y}px` }}>
      {ghost.label}
    </div>
  );
}
