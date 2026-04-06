import {
  clampTrimEnd,
  clampTrimStart,
  getTrimDuration
} from "./trim";

describe("trim helpers", () => {
  it("clamps the start time below the end time", () => {
    expect(clampTrimStart(4.95, 5, 10, 0.1)).toBeCloseTo(4.9);
  });

  it("clamps the end time above the start time", () => {
    expect(clampTrimEnd(5, 5.02, 10, 0.1)).toBeCloseTo(5.1);
  });

  it("respects the duration bounds", () => {
    expect(clampTrimStart(-1, 3, 10, 0.1)).toBe(0);
    expect(clampTrimEnd(3, 25, 10, 0.1)).toBe(10);
  });

  it("computes the trimmed duration", () => {
    expect(getTrimDuration({ startTime: 1.25, endTime: 3.5 })).toBeCloseTo(2.25);
  });

  it("handles a full-duration selection", () => {
    expect(clampTrimStart(0, 0.08, 0.08, 0.1)).toBe(0);
    expect(clampTrimEnd(0, 0.08, 0.08, 0.1)).toBe(0.08);
  });
});
