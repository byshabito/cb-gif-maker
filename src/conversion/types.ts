import type { ConversionResult, InputMetadata, TrimRange } from "@/types";

export type OutputBounds = {
  maxWidth: number;
  maxHeight: number;
  enforceEvenDimensions: true;
};

export type OutputDimensions = {
  width: number;
  height: number;
};

export type ConversionPresetId = "fast" | "quality";

export type TrimSeekMode = "fast" | "accurate";

export type ConversionPreset = {
  id: ConversionPresetId;
  label: string;
  fps: number | null;
  trimSeekMode: TrimSeekMode;
  denoiseFilter: string | null;
  scaleFlags: "bicubic" | "lanczos";
  paletteGenFilter: string;
  paletteUseFilter: string;
};

export type GifQualityPreset = ConversionPreset;

export type ConversionAssetNames = {
  input: string;
  palette: string;
  output: string;
};

export type FfmpegCommand = readonly string[];

export type ConversionProgressPhase =
  | "preparing"
  | "writing-input"
  | "palette"
  | "encode"
  | "reading-output"
  | "finalizing"
  | "complete";

export type ConversionProgressUpdate = {
  progress: number;
  phase: ConversionProgressPhase;
};

export type ConversionStepName =
  | "prepare-input"
  | "palette"
  | "encode";

export type ConversionStep = {
  name: ConversionStepName;
  command: FfmpegCommand;
  outputs: readonly string[];
};

export type ConversionPlan = {
  files: ConversionAssetNames;
  outputName: string;
  outputBounds: OutputBounds;
  outputDimensions: OutputDimensions;
  preset: ConversionPreset;
  effectiveDuration?: number;
  steps: readonly ConversionStep[];
};

export type ConversionRequest = {
  file: File;
  metadata: InputMetadata;
  trimRange: TrimRange | null;
  outputName?: string;
  outputBounds?: OutputBounds;
  presetId?: ConversionPresetId;
};

export type PlannedConversionJob = {
  request: ConversionRequest;
  plan: ConversionPlan;
};

export type ScaleFilter =
  `scale=${number | "-2"}:${number | "-2"}:flags=${ConversionPreset["scaleFlags"]}`;

export type { ConversionResult, InputMetadata, TrimRange };
