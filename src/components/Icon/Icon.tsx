import { iconMarkup, ICON_VIEW_BOX, ICON_PRESENTATION_PROPS } from "../../data/icon-library";

interface IconProps {
  iconId: string;
  size?: number;
  class?: string;
}

/**
 * Renders a bundled icon (data/icon-library.ts) as a standalone inline
 * <svg>, for plain-HTML contexts (TokenPicker, Step/Token details).
 * InstructionCanvas inlines the same markup directly as a <g> instead,
 * since it's already inside an <svg> document.
 *
 * The markup is static, build-time-bundled content from our own vetted
 * dependency (never user input), so dangerouslySetInnerHTML carries no XSS
 * risk here.
 */
export function Icon({ iconId, size = 20, class: className }: IconProps) {
  const markup = iconMarkup(iconId);
  if (!markup) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox={ICON_VIEW_BOX}
      aria-hidden="true"
      class={className}
      {...ICON_PRESENTATION_PROPS}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
