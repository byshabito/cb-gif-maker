import {
  buildGifPipeline,
  computeScaleFilter,
  getInputFileName,
  getOutputName
} from "./pipeline";
import { getTrimDuration } from "../video/trim";

describe("conversion pipeline helpers", () => {
  it("uses the width-limited scale filter for wide videos", () => {
    expect(computeScaleFilter(500, 100)).toBe("scale=250:-2");
  });

  it("uses the height-limited scale filter for tall videos", () => {
    expect(computeScaleFilter(100, 500)).toBe("scale=-2:80");
  });

  it("uses the height-limited even scale filter for portrait inputs", () => {
    expect(computeScaleFilter(9, 16)).toBe("scale=-2:80");
  });

  it("derives gif names from the input filename", () => {
    expect(getOutputName("clip.mov")).toBe("clip.gif");
  });

  it("normalizes the ffmpeg input filename", () => {
    expect(getInputFileName("clip.webm")).toBe("input.webm");
  });

  it("adds trim arguments to the first ffmpeg command", () => {
    expect(
      buildGifPipeline("input.mp4", "scale=250:-2", {
        startTime: 1.25,
        endTime: 3.5
      })[0]
    ).toEqual([
      "-i",
      "input.mp4",
      "-ss",
      "1.250",
      "-t",
      "2.250",
      "-vf",
      "hqdn3d=2.0:1.5:3.0:3.0",
      "output_clean.mp4"
    ]);
  });

  it("derives duration from the trim range", () => {
    expect(getTrimDuration({ startTime: 0, endTime: 2.4 })).toBeCloseTo(2.4);
  });
});
