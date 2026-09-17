/**
 * The modifier-key label a shortcut tooltip should show, e.g. `` `${MOD_KEY_LABEL}+Z` ``
 * (app.tsx, TokenDetails.tsx, StepDetails.tsx) - `navigator.platform` is
 * deprecated but still the simplest reliable signal for this cosmetic
 * purpose. Purely a display concern: the actual keyboard handling
 * (app.tsx's keydown listeners) already treats Ctrl and Cmd identically
 * (`event.ctrlKey || event.metaKey`) regardless of what this says, so a
 * wrong guess here can never break the shortcut itself, only its tooltip
 * (2026-09-17 audit remediation, finding 4).
 */
const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.platform);

export const MOD_KEY_LABEL = isMac ? "Cmd" : "Ctrl";
