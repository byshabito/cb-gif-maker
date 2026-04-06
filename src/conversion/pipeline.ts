import type { ConversionFiles, ScaleFilter } from "../types";

export const TEMP_FILES: Omit<ConversionFiles, "input"> = {
  clean: "output_clean.mp4",
  reduced: "output_reduced.mp4",
  palette: "output_palette.png",
  output: "output.gif"
};

const VIDEO_EXTENSION_PATTERN = /\.([a-z0-9]+)$/i;

export function computeScaleFilter(width: number, height: number): ScaleFilter {
  return width * 80 > height * 250 ? "scale=250:-1" : "scale=-1:80";
}

export function getOutputName(filename: string): string {
  const base = filename.replace(/\.[^/.]+$/, "") || "output";
  return `${base}.gif`;
}

export function getInputFileName(filename: string): string {
  const extensionMatch = filename.match(VIDEO_EXTENSION_PATTERN);
  const extension = extensionMatch?.[1]?.toLowerCase() ?? "mp4";
  return `input.${extension}`;
}

export function getConversionFiles(filename: string): ConversionFiles {
  return {
    input: getInputFileName(filename),
    ...TEMP_FILES
  };
}

export function buildGifPipeline(
  inputName: string,
  scaleFilter: ScaleFilter,
  files: Omit<ConversionFiles, "input"> = TEMP_FILES
): string[][] {
  return [
    [
      "-i",
      inputName,
      "-vf",
      "hqdn3d=2.0:1.5:3.0:3.0",
      files.clean
    ],
    [
      "-i",
      files.clean,
      "-vf",
      scaleFilter,
      files.reduced
    ],
    [
      "-i",
      files.reduced,
      "-vf",
      "palettegen",
      files.palette
    ],
    [
      "-i",
      files.reduced,
      "-i",
      files.palette,
      "-lavfi",
      "paletteuse=dither=bayer:bayer_scale=3",
      files.output
    ]
  ];
}

