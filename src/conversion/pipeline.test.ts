import {
  computeScaleFilter,
  getInputFileName,
  getOutputName
} from "./pipeline";

describe("conversion pipeline helpers", () => {
  it("uses the width-limited scale filter for wide videos", () => {
    expect(computeScaleFilter(500, 100)).toBe("scale=250:-1");
  });

  it("uses the height-limited scale filter for tall videos", () => {
    expect(computeScaleFilter(100, 500)).toBe("scale=-1:80");
  });

  it("derives gif names from the input filename", () => {
    expect(getOutputName("clip.mov")).toBe("clip.gif");
  });

  it("normalizes the ffmpeg input filename", () => {
    expect(getInputFileName("clip.webm")).toBe("input.webm");
  });
});

