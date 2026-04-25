export type ConversionState =
  | "idle"
  | "loading-engine"
  | "ready"
  | "probing"
  | "converting"
  | "done"
  | "error";

export type InputMetadata = {
  width: number;
  height: number;
  duration?: number;
};

export type TrimRange = {
  startTime: number;
  endTime: number;
};

export type ConversionJob = {
  file: File;
  metadata: InputMetadata;
  trimRange: TrimRange | null;
  outputName: string;
};

export type ConversionResult = {
  blob: Blob;
  objectUrl: string;
  bytes: number;
  width: number;
  height: number;
  duration?: number;
};

export type FfmpegAssetPaths = {
  coreURL: string;
  wasmURL: string;
};

export type {
  ConversionAssetNames as ConversionFiles,
  ConversionPlan,
  ConversionPreset,
  ConversionPresetId,
  ConversionRequest,
  FfmpegCommand,
  GifQualityPreset,
  OutputDimensions,
  OutputBounds,
  PlannedConversionJob,
  ScaleFilter,
} from "@/conversion/types";
