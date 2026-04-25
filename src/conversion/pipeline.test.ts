import {
  DEFAULT_CONVERSION_PRESET_ID,
  DEFAULT_OUTPUT_BOUNDS,
  buildTrimInputArgs,
  buildVideoFilterChain,
  computeContainedEvenDimensions,
  computeContainedEvenScale,
  createGifConversionPlan,
  getConversionPreset,
  getInputFileName,
  getOutputName,
  getScaleSummary,
} from "./pipeline";
import { getTrimDuration } from "../video/trim";

describe("conversion pipeline helpers", () => {
  it("uses balanced as the default conversion preset", () => {
    expect(DEFAULT_CONVERSION_PRESET_ID).toBe("balanced");
    expect(getConversionPreset().id).toBe("balanced");
  });

  it("uses the width-limited scale filter for wide videos", () => {
    expect(computeContainedEvenScale({ width: 500, height: 100 })).toBe(
      "scale=250:-2:flags=bicubic"
    );
  });

  it("uses the height-limited scale filter for tall videos", () => {
    expect(computeContainedEvenScale({ width: 100, height: 500 })).toBe(
      "scale=-2:80:flags=bicubic"
    );
  });

  it("uses the height-limited even scale filter for portrait inputs", () => {
    expect(computeContainedEvenScale({ width: 9, height: 16 })).toBe(
      "scale=-2:80:flags=bicubic"
    );
  });

  it("uses height-limited scaling for square inputs", () => {
    expect(computeContainedEvenScale({ width: 100, height: 100 })).toBe(
      "scale=-2:80:flags=bicubic"
    );
  });

  it("uses height-limited scaling at the exact bounds aspect ratio", () => {
    expect(computeContainedEvenScale({ width: 250, height: 80 })).toBe(
      "scale=-2:80:flags=bicubic"
    );
  });

  it("uses configured bounds for tiny metadata", () => {
    expect(
      computeContainedEvenScale(
        { width: 1, height: 1 },
        { maxWidth: 100, maxHeight: 50, enforceEvenDimensions: true }
      )
    ).toBe("scale=-2:50:flags=bicubic");
  });

  it("computes contained even output dimensions", () => {
    expect(computeContainedEvenDimensions({ width: 500, height: 100 })).toEqual({
      width: 250,
      height: 50,
    });
    expect(computeContainedEvenDimensions({ width: 100, height: 500 })).toEqual({
      width: 16,
      height: 80,
    });
    expect(computeContainedEvenDimensions({ width: 250, height: 80 })).toEqual({
      width: 250,
      height: 80,
    });
    expect(computeContainedEvenDimensions({ width: 9, height: 16 })).toEqual({
      width: 44,
      height: 80,
    });
  });

  it("never computes output dimensions below 2x2", () => {
    expect(computeContainedEvenDimensions({ width: 1, height: 1000 })).toEqual({
      width: 2,
      height: 80,
    });
  });

  it("derives gif names from the input filename", () => {
    expect(getOutputName("clip.mov")).toBe("clip.gif");
  });

  it("normalizes the ffmpeg input filename", () => {
    expect(getInputFileName("clip.webm")).toBe("input.webm");
  });

  it("builds fast trim input args before the input", () => {
    expect(
      buildTrimInputArgs({
        inputName: "input.mp4",
        seekMode: "fast",
        trimRange: { startTime: 1.25, endTime: 3.5 },
      })
    ).toEqual(["-ss", "1.250", "-t", "2.250", "-i", "input.mp4"]);
  });

  it("builds accurate trim input args after the input", () => {
    expect(
      buildTrimInputArgs({
        inputName: "input.mp4",
        seekMode: "accurate",
        trimRange: { startTime: 1.25, endTime: 3.5 },
      })
    ).toEqual(["-i", "input.mp4", "-ss", "1.250", "-t", "2.250"]);
  });

  it("omits trim args when no trim range is present", () => {
    expect(
      buildTrimInputArgs({
        inputName: "input.mp4",
        seekMode: "fast",
        trimRange: null,
      })
    ).toEqual(["-i", "input.mp4"]);
  });

  it("builds a fast video filter chain", () => {
    expect(
      buildVideoFilterChain({
        scaleFilter: "scale=250:-2:flags=fast_bilinear",
        preset: getConversionPreset("fast"),
      })
    ).toBe("fps=12,scale=250:-2:flags=fast_bilinear");
  });

  it("builds a quality video filter chain with denoise", () => {
    expect(
      buildVideoFilterChain({
        scaleFilter: "scale=250:-2:flags=lanczos",
        preset: getConversionPreset("quality"),
      })
    ).toBe("hqdn3d=2.0:1.5:3.0:3.0,fps=20,scale=250:-2:flags=lanczos");
  });

  it("derives duration from the trim range", () => {
    expect(getTrimDuration({ startTime: 0, endTime: 2.4 })).toBeCloseTo(2.4);
  });

  it("creates a default balanced two-step 250x80 conversion plan", () => {
    const file = new File(["video"], "clip.mp4", { type: "video/mp4" });
    const plan = createGifConversionPlan({
      file,
      metadata: { width: 500, height: 100, duration: 4 },
      trimRange: null,
    });

    expect(plan.outputBounds).toEqual(DEFAULT_OUTPUT_BOUNDS);
    expect(plan.files).toEqual({
      input: "input.mp4",
      palette: "output_palette.png",
      output: "output.gif",
    });
    expect(plan.outputName).toBe("clip.gif");
    expect(plan.outputDimensions).toEqual({ width: 250, height: 50 });
    expect(plan.preset.id).toBe("balanced");
    expect(plan.effectiveDuration).toBe(4);
    expect(plan.steps.map((step) => step.name)).toEqual(["palette", "encode"]);
  });

  it("creates the full ordered balanced command list", () => {
    const plan = createGifConversionPlan({
      file: new File(["video"], "clip.webm", { type: "video/webm" }),
      metadata: { width: 100, height: 500, duration: 6 },
      trimRange: { startTime: 1.25, endTime: 3.5 },
      outputName: "custom.gif",
    });

    expect(plan.outputName).toBe("custom.gif");
    expect(plan.effectiveDuration).toBeCloseTo(2.25);
    expect(plan.steps).toEqual([
      {
        name: "palette",
        command: [
          "-ss",
          "1.250",
          "-t",
          "2.250",
          "-i",
          "input.webm",
          "-vf",
          "fps=15,scale=-2:80:flags=bicubic,palettegen=stats_mode=diff",
          "output_palette.png",
        ],
        outputs: ["output_palette.png"],
      },
      {
        name: "encode",
        command: [
          "-ss",
          "1.250",
          "-t",
          "2.250",
          "-i",
          "input.webm",
          "-i",
          "output_palette.png",
          "-lavfi",
          "fps=15,scale=-2:80:flags=bicubic[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3",
          "output.gif",
        ],
        outputs: ["output.gif"],
      },
    ]);
  });

  it("creates a fast plan with fast seek and fps=12", () => {
    const plan = createGifConversionPlan({
      file: new File(["video"], "clip.mp4", { type: "video/mp4" }),
      metadata: { width: 500, height: 100 },
      trimRange: { startTime: 1, endTime: 2 },
      presetId: "fast",
    });

    expect(plan.steps).toHaveLength(2);
    expect(plan.steps[0].command).toContain(
      "fps=12,scale=250:-2:flags=fast_bilinear,palettegen=stats_mode=single"
    );
    expect(plan.steps[0].command.slice(0, 5)).toEqual([
      "-ss",
      "1.000",
      "-t",
      "1.000",
      "-i",
    ]);
  });

  it("creates a quality plan with accurate seek, denoise, and fps=20", () => {
    const plan = createGifConversionPlan({
      file: new File(["video"], "clip.mp4", { type: "video/mp4" }),
      metadata: { width: 500, height: 100 },
      trimRange: { startTime: 1, endTime: 2 },
      presetId: "quality",
    });

    expect(plan.steps).toHaveLength(2);
    expect(plan.steps[0].command.slice(0, 7)).toEqual([
      "-i",
      "input.mp4",
      "-ss",
      "1.000",
      "-t",
      "1.000",
      "-vf",
    ]);
    expect(plan.steps[0].command).toContain(
      "hqdn3d=2.0:1.5:3.0:3.0,fps=20,scale=250:-2:flags=lanczos,palettegen=stats_mode=diff"
    );
  });

  it("does not create intermediate mp4 files", () => {
    const plan = createGifConversionPlan({
      file: new File(["video"], "clip.mp4", { type: "video/mp4" }),
      metadata: { width: 500, height: 100 },
      trimRange: null,
    });
    const commandText = plan.steps
      .flatMap((step) => step.command)
      .join(" ");

    expect(commandText).not.toContain("output_clean.mp4");
    expect(commandText).not.toContain("output_reduced.mp4");
  });

  it("provides scale summary text without exposing command strings", () => {
    expect(getScaleSummary({ width: 500, height: 100 })).toBe("Scale to 250px wide");
    expect(getScaleSummary({ width: 100, height: 500 })).toBe("Scale to 80px tall");
  });
});
