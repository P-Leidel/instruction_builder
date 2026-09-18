import { useLayoutEffect, useRef } from "preact/hooks";
import type { ComponentChildren, RefObject } from "preact";
import { resolveFieldPlacement } from "../../lib/field-placement";

interface FieldPopoverProps {
  /** The trigger button this popover is anchored below and returns focus to on close. */
  anchorRef: RefObject<HTMLElement>;
  /** Called on Escape, an outside click, or unmount-worthy dismissal - never on Save, which is the caller's own button inside `children`. */
  onClose: () => void;
  ariaLabel: string;
  children: ComponentChildren;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A small non-modal floating panel anchored to a trigger button - used by
 * DurationField (Step/Token time) and TokenDetails' QuantityRow (Quantity)
 * to edit a value without affecting the layout around the trigger (see
 * docs/phase-3/progress - the row those two used to share reflowed
 * unexpectedly whenever one's inline edit form opened, since both lived in
 * the same wrapping flex row; this popover removes the form from that flow
 * entirely instead of trying to reserve space for it).
 *
 * Must be rendered inside a `position: relative` wrapper around exactly the
 * trigger button `anchorRef` points at (see `.field-popover-anchor` in
 * global.css) - the default `top: 100%` positions it directly under that
 * button, not the field's label or any other sibling content.
 *
 * CSS owns the actual position; this only chooses between the four
 * possibilities by toggling `.field-popover--right`/`--above`, from
 * `resolveFieldPlacement` in `lib/field-placement.ts` (which is where the
 * viewport arithmetic and its tests live). Placement runs in a
 * `useLayoutEffect` rather than `useEffect` so it happens before paint -
 * with `useEffect` the panel is drawn below-left for one frame and then
 * visibly snaps, which is worse now there is a vertical flip to snap
 * through. It re-runs on `resize` and `orientationchange`: rotating a
 * tablet with the panel open used to leave it wherever it was first
 * placed, and that is a case task 30's tablet testers are asked about by
 * name (docs/manual-testing-checklist.md).
 *
 * Genuinely non-modal, and now says so consistently. It used to declare
 * `aria-modal="false"` while cycling Tab back to its first control - a
 * screen reader user was told they could leave and then prevented from
 * doing so (2026-09-18 architecture review, finding 8). There is no
 * backdrop and nothing is made inert, so the honest fix was dropping the
 * trap, not adding modal machinery to a panel whose whole purpose is to be
 * unobtrusive. Escape and an outside pointerdown still close it.
 *
 * Because focus can now leave, returning it to the trigger on close is
 * conditional: yanking focus backwards out of wherever a user has since
 * tabbed to would be its own bug. `document.activeElement` is unreliable
 * by the time this effect's cleanup runs (it may already have reset to
 * `<body>`), so focus is tracked as it moves instead.
 */
export function FieldPopover({ anchorRef, onClose, ariaLabel, children }: FieldPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const focusStillInsideRef = useRef(true);

  useLayoutEffect(() => {
    const popover = popoverRef.current;
    if (!popover) return;

    function applyPlacement() {
      // Re-read the ref rather than closing over the narrowed `popover`
      // above: this also runs from a resize, where the panel may since
      // have gone.
      const panel = popoverRef.current;
      const anchorRect = anchorRef.current?.getBoundingClientRect();
      if (!panel || !anchorRect) return;
      const { horizontal, vertical } = resolveFieldPlacement({
        anchor: {
          left: anchorRect.left,
          right: anchorRect.right,
          top: anchorRect.top,
          bottom: anchorRect.bottom,
        },
        popover: { width: panel.offsetWidth, height: panel.offsetHeight },
        viewport: { width: window.innerWidth, height: window.innerHeight },
      });
      panel.classList.toggle("field-popover--right", horizontal === "right");
      panel.classList.toggle("field-popover--above", vertical === "above");
    }

    applyPlacement();

    // preventScroll: true - without it, focusing an input below the fold
    // (this popover renders next to its trigger, which can itself be low in
    // a tall panel) makes the browser auto-scroll the page to reveal it.
    // That scroll persists after the popover closes, so on-screen
    // everything above/around the field appears to have silently shifted -
    // the exact "things move when I open this" complaint this popover
    // exists to fix, just caused by scroll instead of layout this time.
    popover.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus({ preventScroll: true });

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (popover?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    }

    function handleFocusIn() {
      focusStillInsideRef.current = true;
    }

    function handleFocusOut(event: FocusEvent) {
      const next = event.relatedTarget as Node | null;
      // A null relatedTarget means focus went nowhere in particular - a
      // click on empty space, say. The user hasn't chosen somewhere else to
      // be, so handing focus back to the trigger on close is still right.
      if (!next) return;
      focusStillInsideRef.current =
        popoverRef.current?.contains(next) === true || anchorRef.current?.contains(next) === true;
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", applyPlacement);
    window.addEventListener("orientationchange", applyPlacement);
    popover.addEventListener("focusin", handleFocusIn);
    popover.addEventListener("focusout", handleFocusOut);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", applyPlacement);
      window.removeEventListener("orientationchange", applyPlacement);
      popover.removeEventListener("focusin", handleFocusIn);
      popover.removeEventListener("focusout", handleFocusOut);
      if (focusStillInsideRef.current) anchorRef.current?.focus({ preventScroll: true });
    };
  }, []);

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    onClose();
  }

  return (
    <div class="field-popover" role="dialog" aria-modal="false" aria-label={ariaLabel} ref={popoverRef} onKeyDown={handleKeyDown}>
      {children}
    </div>
  );
}
