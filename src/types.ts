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

export type ConversionJob = {
  file: File;
  metadata: InputMetadata;
  scaleFilter: ScaleFilter;
  outputName: string;
};

export type ConversionResult = {
  blob: Blob;
  objectUrl: string;
  bytes: number;
  elapsedMs: number;
  logs: string[];
};

export type FfmpegAssetPaths = {
  coreURL: string;
  wasmURL: string;
};

export type ScaleFilter = "scale=250:-1" | "scale=-1:80";

export type ConversionFiles = {
  input: string;
  clean: string;
  reduced: string;
  palette: string;
  output: string;
};
