import type { DurationAttachment, InstructionStep } from "../model/instruction";
import { TIME_ICON_ID } from "../data/icon-library";

export const MAX_DURATION_DAYS = 99;
export const MIN_DURATION_SECONDS = 1;
export const MAX_DURATION_SECONDS = MAX_DURATION_DAYS * 86400;

const SECONDS_PER_DAY = 86400;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_MINUTE = 60;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** "XXd-XXh-XXm-XXs", the fixed display format used everywhere a duration shows. */
export function formatDuration(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / SECONDS_PER_DAY);
  const hours = Math.floor((totalSeconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR);
  const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const seconds = Math.floor(totalSeconds % SECONDS_PER_MINUTE);
  return `${pad2(days)}d-${pad2(hours)}h-${pad2(minutes)}m-${pad2(seconds)}s`;
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
