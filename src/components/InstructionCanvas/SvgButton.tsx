import type { ComponentChildren } from "preact";

interface SvgButtonProps {
  class?: string;
  ariaLabel: string;
  onActivate: () => void;
  disabled?: boolean;
  stopPropagation?: boolean;
  /** Only the step badge needs this (aria-current="step" when selected). */
  ariaCurrent?: "step";
  /** Only "+ Add step" needs this - a transform on the same <g> as role=button. */
  transform?: string;
  children: ComponentChildren;
}

/**
 * Generic keyboard-activatable SVG `<g role="button">` - six call sites in
 * InstructionCanvas.tsx each hand-rolled this identical role/tabindex/
 * onClick/onKeyDown block (Enter/Space -> activate) before this extraction;
 * see docs/phase-3/progress/architecture-svgbutton-extraction.md for the
 * shape decisions.
 */
export function SvgButton({
  class: className,
  ariaLabel,
  onActivate,
  disabled,
  stopPropagation,
  ariaCurrent,
  transform,
  children,
}: SvgButtonProps) {
  function activate(event: { stopPropagation: () => void }) {
    if (disabled) return;
    if (stopPropagation) event.stopPropagation();
    onActivate();
  }

  return (
    <g
      class={className}
      role="button"
      tabindex={disabled ? -1 : 0}
      aria-disabled={disabled ? "true" : undefined}
      aria-current={ariaCurrent}
      aria-label={ariaLabel}
      transform={transform}
      onClick={activate}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate(event);
        }
      }}
    >
      {children}
    </g>
  );
}
