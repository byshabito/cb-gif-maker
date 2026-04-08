import type {
  ConversionResult,
  FfmpegAssetPaths,
  InputMetadata,
  TrimRange,
} from "@/types";

export const ACCEPTED_VIDEO_TYPES = ".mp4,video/mp4";
export const TRIM_STEP = 0.1;
export const MIN_TRIM_SPAN = 0.1;
export const PREVIEW_LOOP_EPSILON = 0.05;
export const CONVERTING_FRAMES = [
  "Converting",
  "Converting.",
  "Converting..",
  "Converting...",
] as const;

export type EngineState = "idle" | "loading" | "ready" | "error";

export type GifMakerState = {
  conversionState:
    | "idle"
    | "loading-engine"
    | "ready"
    | "probing"
    | "converting"
    | "done"
    | "error";
  engineState: EngineState;
  file: File | null;
  metadata: InputMetadata | null;
  trimRange: TrimRange | null;
  result: ConversionResult | null;
  inputPreviewUrl: string | null;
  errorMessage: string;
  isBusy: boolean;
  progress: number | null;
};

export function createInitialState(): GifMakerState {
  return {
    conversionState: "idle",
    engineState: "idle",
    file: null,
    metadata: null,
    trimRange: null,
    result: null,
    inputPreviewUrl: null,
    errorMessage: "",
    isBusy: false,
    progress: null,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

export function formatDuration(duration?: number): string {
  if (!duration) {
    return "Unknown";
  }

  return `${duration.toFixed(2)} s`;
}

export function formatTrimTimestamp(seconds: number): string {
  const safeValue = Math.max(seconds, 0);
  const hours = Math.floor(safeValue / 3600);
  const minutes = Math.floor((safeValue % 3600) / 60);
  const remainingSeconds = safeValue - hours * 3600 - minutes * 60;
  const secondsText = remainingSeconds.toFixed(1).padStart(4, "0");

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${secondsText}`;
  }

  return `${minutes}:${secondsText}`;
}

export function sanitizeError(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error.";
}

export function isSupportedVideo(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  return lowerName.endsWith(".mp4") || file.type === "video/mp4";
}

export function getFfmpegPaths(): FfmpegAssetPaths {
  const base = import.meta.env.BASE_URL;

  return {
    coreURL: `${base}ffmpeg/ffmpeg-core.js`,
    wasmURL: `${base}ffmpeg/ffmpeg-core.wasm`,
  };
}

export function hasKnownDuration(
  metadata: InputMetadata | null
): metadata is InputMetadata & { duration: number } {
  return typeof metadata?.duration === "number" && metadata.duration > 0;
}

export function getProgressStatusMessage(state: GifMakerState): string {
  if (state.conversionState === "converting") {
    return "Converting clip to GIF...";
  }

  if (
    state.conversionState === "loading-engine" ||
    state.engineState === "loading"
  ) {
    return "Loading ffmpeg engine...";
  }

  if (state.engineState === "error") {
    return "Failed to load ffmpeg engine. Try convert again.";
  }

  if (state.conversionState === "probing") {
    return "Reading clip metadata...";
  }

  return "";
}

export function getEngineLabel(engineState: EngineState): string {
  switch (engineState) {
    case "idle":
      return "Engine idle";
    case "loading":
      return "Engine warming";
    case "ready":
      return "Engine ready";
    case "error":
      return "Engine failed";
  }
}
