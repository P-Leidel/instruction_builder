import { useEffect, useRef } from "preact/hooks";
import type { ComponentChildren, RefObject } from "preact";

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
 * A small non-modal floating panel anchored below a trigger button - used by
 * DurationField (Step/Token time) and TokenDetails' QuantityRow (Quantity)
 * to edit a value without affecting the layout around the trigger (see
 * docs/phase-3/progress - the row those two used to share reflowed
 * unexpectedly whenever one's inline edit form opened, since both lived in
 * the same wrapping flex row; this popover removes the form from that flow
 * entirely instead of trying to reserve space for it).
 *
 * Must be rendered inside a `position: relative` wrapper around exactly the
 * trigger button `anchorRef` points at (see `.field-popover-anchor` in
 * global.css) - `top: 100%` below positions it directly under that button,
 * not the field's label or any other sibling content.
 *
 * Unlike `useConfirmDialogFocusTrap` (dialog-focus-trap.ts, hard-coded to
 * exactly two buttons since that's all a confirm dialog ever has), the Tab
 * trap here queries its focusable descendants live on every Tab press -
 * these forms have 4-6 controls whose enabled/disabled state can change
 * (e.g. Quantity's Save disables while its amount is invalid), so a fixed
 * two-ref version wouldn't fit.
 */
export function FieldPopover({ anchorRef, onClose, ariaLabel, children }: FieldPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const popover = popoverRef.current;
    if (!popover) return;

    // preventScroll: true - without it, focusing an input below the fold
    // (this popover renders below its trigger, which can itself be low in a
    // tall panel) makes the browser auto-scroll the page to reveal it. That
    // scroll persists after the popover closes, so on-screen everything
    // above/around the field appears to have silently shifted - the exact
    // "things move when I open this" complaint this popover exists to fix,
    // just caused by scroll instead of layout this time.
    popover.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus({ preventScroll: true });

    // Flip to right-aligned if the default left-aligned position would run
    // past the viewport's right edge - the only positioning math this needs
    // (vertical position and left-aligned default both come from CSS
    // `top: 100%; left: 0` relative to the anchor wrapper), but real enough
    // to matter: this app is tested down to a 390px mobile viewport (see
    // NO_HORIZONTAL_OVERFLOW_AT_MOBILE_WIDTH in the driver script) and a
    // trigger near the right edge of a narrow column would otherwise push
    // this off-screen.
    const anchorRect = anchorRef.current?.getBoundingClientRect();
    if (anchorRect && anchorRect.left + popover.offsetWidth > window.innerWidth - 8) {
      popover.style.left = "auto";
      popover.style.right = "0";
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (popover?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      anchorRef.current?.focus({ preventScroll: true });
    };
  }, []);

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusables = popoverRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    if (!focusables || focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div class="field-popover" role="dialog" aria-modal="false" aria-label={ariaLabel} ref={popoverRef} onKeyDown={handleKeyDown}>
      {children}
    </div>
  );
}
