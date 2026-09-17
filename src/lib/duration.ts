import type { DurationAttachment, InstructionStep } from "../model/instruction";
import { TIME_ICON_ID } from "../data/icon-library";

export const MAX_DURATION_DAYS = 99;
export const MIN_DURATION_SECONDS = 1;
export const MAX_DURATION_SECONDS = MAX_DURATION_DAYS * 86400;

const SECONDS_PER_DAY = 86400;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_MINUTE = 60;

/**
 * A human-readable duration, e.g. "1d 2h 3m 4s" or "1h 30m" - only the
 * non-zero units are shown, so a plain 30-minute estimate reads as "30m",
 * not "00d-00h-30m-00s". This is the one label used everywhere a duration
 * displays - it's stored verbatim as `DurationAttachment.label` (see
 * `buildDuration`/`sumDurations` below) and reused as-is by the on-screen
 * Step/Token details readout and by the canvas, so every visual export
 * (SVG/PNG/PDF) shows the same friendly text too. JSON export is
 * unaffected: it round-trips through `DurationAttachment.seconds`, not
 * this string.
 */
export function formatDuration(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / SECONDS_PER_DAY);
  const hours = Math.floor((totalSeconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR);
  const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const seconds = Math.floor(totalSeconds % SECONDS_PER_MINUTE);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(" ");
}

/** Splits a total-seconds value back into its d/h/m/s parts, for pre-filling an edit form. */
export function splitDuration(totalSeconds: number): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
} {
  return {
    days: Math.floor(totalSeconds / SECONDS_PER_DAY),
    hours: Math.floor((totalSeconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR),
    minutes: Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE),
    seconds: Math.floor(totalSeconds % SECONDS_PER_MINUTE),
  };
}

/**
 * Builds a `DurationAttachment` from separate d/h/m/s fields (the "simple,
 * common" input widget chosen for this) - clamped to the 1 second..99 days
 * range. Returns `undefined` for a total of 0 (nothing to attach).
 */
export function buildDuration(
  days: number,
  hours: number,
  minutes: number,
  seconds: number,
): DurationAttachment | undefined {
  const total = Math.max(0, days) * SECONDS_PER_DAY
    + Math.max(0, hours) * SECONDS_PER_HOUR
    + Math.max(0, minutes) * SECONDS_PER_MINUTE
    + Math.max(0, seconds);
  if (total < MIN_DURATION_SECONDS) return undefined;
  const clamped = Math.min(total, MAX_DURATION_SECONDS);
  return { iconId: TIME_ICON_ID, label: formatDuration(clamped), seconds: clamped };
}

/** Sums several tokens' own times into one step-level total, or `undefined` if none have one. */
export function sumDurations(durations: (DurationAttachment | undefined)[]): DurationAttachment | undefined {
  const total = durations.reduce((sum, d) => sum + (d?.seconds ?? 0), 0);
  if (total <= 0) return undefined;
  const clamped = Math.min(total, MAX_DURATION_SECONDS);
  return { iconId: TIME_ICON_ID, label: formatDuration(clamped), seconds: clamped };
}

/**
 * The step's own time if set, else the sum of its tokens' own times, else
 * nothing to show - a step-time-wins-else-sum-of-tokens rule that gives a
 * user who times individual tokens a free estimated step total without
 * entering one manually.
 */
export function stepDisplayedTime(step: InstructionStep): DurationAttachment | undefined {
  return step.time ?? sumDurations(step.tokens.map((t) => t.time));
}

/**
 * A whole document's total displayed time - every step's own
 * `stepDisplayedTime`, summed. Used by both the on-screen canvas heading
 * (InstructionCanvas.tsx) and the PDF export heading (document-actions.ts's
 * `runPdfExport`), which used to each independently write out
 * `sumDurations(steps.map(stepDisplayedTime))` (2026-09-17 audit
 * remediation, finding 5).
 */
export function documentTotalTime(steps: InstructionStep[]): DurationAttachment | undefined {
  return sumDurations(steps.map(stepDisplayedTime));
}
