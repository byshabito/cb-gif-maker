import { getTrimDuration } from "../video/trim";
import type {
  ConversionAssetNames,
  ConversionPlan,
  ConversionPreset,
  ConversionPresetId,
  ConversionRequest,
  InputMetadata,
  OutputBounds,
  OutputDimensions,
  ScaleFilter,
  TrimSeekMode,
  TrimRange,
} from "./types";

export const DEFAULT_OUTPUT_BOUNDS: OutputBounds = {
  maxWidth: 250,
  maxHeight: 80,
  enforceEvenDimensions: true,
};

export const DEFAULT_CONVERSION_PRESET_ID: ConversionPresetId = "fast";

export const CONVERSION_PRESETS: Record<ConversionPresetId, ConversionPreset> = {
  fast: {
    id: "fast",
    label: "Fast",
    fps: 12,
    trimSeekMode: "fast",
    denoiseFilter: null,
    scaleFlags: "bicubic",
    paletteGenFilter: "palettegen=stats_mode=diff",
    paletteUseFilter: "paletteuse=dither=bayer:bayer_scale=4",
  },
  quality: {
    id: "quality",
    label: "Quality",
    fps: 15,
    trimSeekMode: "fast",
    denoiseFilter: "hqdn3d=2.0:1.5:3.0:3.0",
    scaleFlags: "bicubic",
    paletteGenFilter: "palettegen=stats_mode=diff",
    paletteUseFilter: "paletteuse=dither=bayer:bayer_scale=3",
  },
};

export const TEMP_FILES: Omit<ConversionAssetNames, "input"> = {
  palette: "output_palette.png",
  output: "output.gif"
};

const VIDEO_EXTENSION_PATTERN = /\.([a-z0-9]+)$/i;

export function computeContainedEvenScale(
  metadata: InputMetadata,
  bounds: OutputBounds = DEFAULT_OUTPUT_BOUNDS
): ScaleFilter {
  const preset = getConversionPreset();

  return metadata.width * bounds.maxHeight > metadata.height * bounds.maxWidth
    ? `scale=${bounds.maxWidth}:-2:flags=${preset.scaleFlags}`
    : `scale=-2:${bounds.maxHeight}:flags=${preset.scaleFlags}`;
}

export function computeContainedEvenDimensions(
  metadata: InputMetadata,
  bounds: OutputBounds = DEFAULT_OUTPUT_BOUNDS
): OutputDimensions {
  const widthRatio = bounds.maxWidth / metadata.width;
  const heightRatio = bounds.maxHeight / metadata.height;
  const scale = Math.min(widthRatio, heightRatio);
  const width = Math.max(2, Math.floor(metadata.width * scale / 2) * 2);
  const height = Math.max(2, Math.floor(metadata.height * scale / 2) * 2);

  return {
    width: Math.min(width, bounds.maxWidth),
    height: Math.min(height, bounds.maxHeight),
  };
}

export function getScaleSummary(
  metadata: InputMetadata,
  bounds: OutputBounds = DEFAULT_OUTPUT_BOUNDS
): string {
  return metadata.width * bounds.maxHeight > metadata.height * bounds.maxWidth
    ? `Scale to ${bounds.maxWidth}px wide`
    : `Scale to ${bounds.maxHeight}px tall`;
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

export function getConversionFiles(filename: string): ConversionAssetNames {
  return {
    input: getInputFileName(filename),
    ...TEMP_FILES
  };
}

function serializeCommandTime(seconds: number): string {
  return Math.max(seconds, 0).toFixed(3);
}

function serializeTrimRange(trimRange: TrimRange): string[] {
  return [
    "-ss",
    serializeCommandTime(trimRange.startTime),
    "-t",
    serializeCommandTime(getTrimDuration(trimRange)),
  ];
}

export function getConversionPreset(
  id: ConversionPresetId = DEFAULT_CONVERSION_PRESET_ID
): ConversionPreset {
  return CONVERSION_PRESETS[id];
}

export function buildVideoFilterChain({
  scaleFilter,
  preset,
}: {
  scaleFilter: ScaleFilter;
  preset: ConversionPreset;
}): string {
  return [
    preset.fps === null ? null : `fps=${preset.fps}`,
    scaleFilter,
    preset.denoiseFilter,
  ].filter((filter): filter is string => Boolean(filter)).join(",");
}

export function buildTrimInputArgs({
  inputName,
  seekMode,
  trimRange,
}: {
  inputName: string;
  seekMode: TrimSeekMode;
  trimRange: TrimRange | null;
}): string[] {
  if (!trimRange) {
    return ["-i", inputName];
  }

  const trimArgs = serializeTrimRange(trimRange);

  return seekMode === "fast"
    ? [...trimArgs, "-i", inputName]
    : ["-i", inputName, ...trimArgs];
}

export function buildGifPipeline(
  inputName: string,
  scaleFilter: ScaleFilter,
  trimRange: TrimRange | null = null,
  files: Omit<ConversionAssetNames, "input"> = TEMP_FILES
): string[][] {
  const preset = getConversionPreset();
  const videoFilterChain = buildVideoFilterChain({ scaleFilter, preset });

  return [
    [
      ...buildTrimInputArgs({
        inputName,
        trimRange,
        seekMode: preset.trimSeekMode,
      }),
      "-vf",
      `${videoFilterChain},${preset.paletteGenFilter}`,
      files.palette
    ],
    [
      ...buildTrimInputArgs({
        inputName,
        trimRange,
        seekMode: preset.trimSeekMode,
      }),
      "-i",
      files.palette,
      "-lavfi",
      `${videoFilterChain}[x];[x][1:v]${preset.paletteUseFilter}`,
      files.output
    ]
  ];
}

export function createGifConversionPlan(
  request: ConversionRequest
): ConversionPlan {
  const outputBounds = request.outputBounds ?? DEFAULT_OUTPUT_BOUNDS;
  const preset = getConversionPreset(request.presetId);
  const files = getConversionFiles(request.file.name);
  const scaleFilter = computeContainedEvenScale(request.metadata, outputBounds)
    .replace(/:flags=[^:]+$/, `:flags=${preset.scaleFlags}`) as ScaleFilter;
  const videoFilterChain = buildVideoFilterChain({ scaleFilter, preset });
  const effectiveDuration = request.trimRange
    ? getTrimDuration(request.trimRange)
    : request.metadata.duration;

  return {
    files,
    outputName: request.outputName ?? getOutputName(request.file.name),
    outputBounds,
    outputDimensions: computeContainedEvenDimensions(request.metadata, outputBounds),
    preset,
    effectiveDuration,
    steps: [
      {
        name: "palette",
        command: [
          ...buildTrimInputArgs({
            inputName: files.input,
            trimRange: request.trimRange,
            seekMode: preset.trimSeekMode,
          }),
          "-vf",
          `${videoFilterChain},${preset.paletteGenFilter}`,
          files.palette,
        ],
        outputs: [files.palette],
      },
      {
        name: "encode",
        command: [
          ...buildTrimInputArgs({
            inputName: files.input,
            trimRange: request.trimRange,
            seekMode: preset.trimSeekMode,
          }),
          "-i",
          files.palette,
          "-lavfi",
          `${videoFilterChain}[x];[x][1:v]${preset.paletteUseFilter}`,
          files.output,
        ],
        outputs: [files.output],
      },
    ],
  };
}
