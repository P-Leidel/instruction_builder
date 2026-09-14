import { describe, it, expect } from "vitest";
import {
  formatDuration,
  splitDuration,
  buildDuration,
  sumDurations,
  stepDisplayedTime,
  MIN_DURATION_SECONDS,
  MAX_DURATION_SECONDS,
} from "./duration";
import { createEmptyStep, createToken } from "../model/instruction";

describe("formatDuration / splitDuration", () => {
  it("formats a mixed duration as XXd-XXh-XXm-XXs", () => {
    // 1 day, 2 hours, 3 minutes, 4 seconds.
    const seconds = 1 * 86400 + 2 * 3600 + 3 * 60 + 4;
    expect(formatDuration(seconds)).toBe("01d-02h-03m-04s");
  });

  it("formats zero as all-zero", () => {
    expect(formatDuration(0)).toBe("00d-00h-00m-00s");
  });

  it("round-trips through splitDuration", () => {
    const seconds = 3 * 86400 + 5 * 3600 + 30 * 60 + 15;
    expect(splitDuration(seconds)).toEqual({ days: 3, hours: 5, minutes: 30, seconds: 15 });
  });
});

describe("buildDuration", () => {
  it("builds a duration from d/h/m/s fields", () => {
    const result = buildDuration(0, 1, 30, 0);
    expect(result).toEqual({
      iconId: expect.any(String),
      label: "00d-01h-30m-00s",
      seconds: 3600 + 1800,
    });
  });

  it("returns undefined for a total below the minimum", () => {
    expect(buildDuration(0, 0, 0, 0)).toBeUndefined();
  });

  it("treats negative fields as zero rather than subtracting", () => {
    expect(buildDuration(0, 0, 0, -5)).toBeUndefined();
    expect(buildDuration(0, 1, -30, 0)).toEqual(buildDuration(0, 1, 0, 0));
  });

  it("clamps a total above MAX_DURATION_SECONDS", () => {
    const result = buildDuration(999, 0, 0, 0);
    expect(result?.seconds).toBe(MAX_DURATION_SECONDS);
  });

  it("accepts exactly MIN_DURATION_SECONDS", () => {
    expect(buildDuration(0, 0, 0, MIN_DURATION_SECONDS)).toBeDefined();
  });
});

describe("sumDurations", () => {
  it("sums several durations' seconds", () => {
    const a = buildDuration(0, 0, 1, 0)!;
    const b = buildDuration(0, 0, 2, 0)!;
    expect(sumDurations([a, b])?.seconds).toBe(180);
  });

  it("skips undefined entries", () => {
    const a = buildDuration(0, 0, 1, 0)!;
    expect(sumDurations([a, undefined])?.seconds).toBe(60);
  });

  it("returns undefined when nothing has a time", () => {
    expect(sumDurations([undefined, undefined])).toBeUndefined();
    expect(sumDurations([])).toBeUndefined();
  });

  it("clamps a sum above MAX_DURATION_SECONDS", () => {
    const huge = { iconId: "x", label: "x", seconds: MAX_DURATION_SECONDS };
    expect(sumDurations([huge, huge])?.seconds).toBe(MAX_DURATION_SECONDS);
  });
});

describe("stepDisplayedTime", () => {
  it("returns undefined when neither the step nor any token has a time", () => {
    const step = { ...createEmptyStep(), tokens: [createToken("action", "knife")] };
    expect(stepDisplayedTime(step)).toBeUndefined();
  });

  it("sums the tokens' times when the step has no explicit time", () => {
    const time = buildDuration(0, 0, 1, 0)!;
    const step = {
      ...createEmptyStep(),
      tokens: [{ ...createToken("action", "knife"), time }],
    };
    expect(stepDisplayedTime(step)?.seconds).toBe(60);
  });

  it("prefers the step's own explicit time over the sum of its tokens", () => {
    const tokenTime = buildDuration(0, 0, 1, 0)!;
    const stepTime = buildDuration(0, 1, 0, 0)!;
    const step = {
      ...createEmptyStep(),
      time: stepTime,
      tokens: [{ ...createToken("action", "knife"), time: tokenTime }],
    };
    expect(stepDisplayedTime(step)).toBe(stepTime);
  });
});
