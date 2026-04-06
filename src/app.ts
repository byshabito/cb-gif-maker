import { BrowserGifConverter } from "./ffmpeg/client";
import {
  computeScaleFilter,
  getOutputName
} from "./conversion/pipeline";
import { readVideoMetadata } from "./video/metadata";
import {
  clampTrimEnd,
  clampTrimStart,
  getTrimDuration
} from "./video/trim";
import type {
  ConversionJob,
  ConversionResult,
  ConversionState,
  FfmpegAssetPaths,
  InputMetadata,
  ScaleFilter,
  TrimRange
} from "./types";

const ACCEPTED_VIDEO_TYPES = ".mp4,video/mp4";
const TRIM_STEP = 0.1;
const MIN_TRIM_SPAN = 0.1;
const PREVIEW_LOOP_EPSILON = 0.05;

type EngineState = "idle" | "loading" | "ready" | "error";

type AppState = {
  conversionState: ConversionState;
  engineState: EngineState;
  file: File | null;
  metadata: InputMetadata | null;
  scaleFilter: ScaleFilter | null;
  trimRange: TrimRange | null;
  result: ConversionResult | null;
  inputPreviewUrl: string | null;
  errorMessage: string;
  isBusy: boolean;
  progress: number | null;
};

const initialState = (): AppState => ({
  conversionState: "idle",
  engineState: "idle",
  file: null,
  metadata: null,
  scaleFilter: null,
  trimRange: null,
  result: null,
  inputPreviewUrl: null,
  errorMessage: "",
  isBusy: false,
  progress: null
});

function formatBytes(bytes: number): string {
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

function formatDuration(duration?: number): string {
  if (!duration) {
    return "Unknown";
  }

  return `${duration.toFixed(2)} s`;
}

function formatTrimTimestamp(seconds: number): string {
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

function sanitizeError(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error.";
}

function isSupportedVideo(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  return lowerName.endsWith(".mp4") || file.type === "video/mp4";
}

function getFfmpegPaths(): FfmpegAssetPaths {
  const base = import.meta.env.BASE_URL;
  return {
    coreURL: `${base}ffmpeg/ffmpeg-core.js`,
    wasmURL: `${base}ffmpeg/ffmpeg-core.wasm`
  };
}

function hasKnownDuration(
  metadata: InputMetadata | null
): metadata is InputMetadata & { duration: number } {
  return typeof metadata?.duration === "number" && metadata.duration > 0;
}

export function initializeApp(root: HTMLDivElement): void {
  const converter = new BrowserGifConverter();
  const state = initialState();
  let activeOperationId = 0;

  root.innerHTML = `
    <main class="shell">
      <section class="hero">
        <p class="eyebrow">MP4 → GIF</p>
        <h1>Convert your favourite clips to a CB emoticon</h1>
        <p class="lede">Turn your clip into an animated GIF optimised for Chaturbate.</p>
      </section>
      <section class="panel controls-panel">
        <article class="input-column">
          <label class="file-picker">
            <input id="file-input" class="file-input" type="file" accept="${ACCEPTED_VIDEO_TYPES}" />
            <span class="file-picker-ui">
              <span class="file-picker-button">Choose video (.mp4)</span>
              <span id="file-name" class="file-name">No file chosen</span>
            </span>
          </label>
          <div id="input-skeleton" class="preview-skeleton">
            <div class="skeleton-frame"></div>
          </div>
          <div id="input-preview-wrap" class="input-preview-wrap" hidden>
            <video
              id="input-preview"
              class="input-preview"
              controls
              muted
              playsinline
              preload="metadata"
            ></video>
          </div>
          <p id="input-summary" class="input-summary" hidden>- / - / -</p>
          <section id="trim-controls" class="trim-controls" hidden>
            <div class="trim-header">
              <p class="trim-title">Trim clip</p>
              <p id="trim-duration" class="trim-duration">0:00.0 selected</p>
            </div>
            <div class="trim-slider-stack">
              <div class="trim-slider-track"></div>
              <div id="trim-selected-range" class="trim-selected-range"></div>
              <input
                id="trim-start"
                class="trim-slider trim-slider-start"
                type="range"
                min="0"
                max="0"
                step="${TRIM_STEP}"
                value="0"
              />
              <input
                id="trim-end"
                class="trim-slider trim-slider-end"
                type="range"
                min="0"
                max="0"
                step="${TRIM_STEP}"
                value="0"
              />
            </div>
            <div class="trim-readouts">
              <p class="trim-chip">
                <span class="trim-chip-label">Start</span>
                <strong id="trim-start-readout">0:00.0</strong>
              </p>
              <p class="trim-chip">
                <span class="trim-chip-label">End</span>
                <strong id="trim-end-readout">0:00.0</strong>
              </p>
            </div>
          </section>
          <p id="error-message" class="message error" hidden></p>
        </article>
        <div class="action-column">
          <button id="convert-button" class="primary convert-button" type="button" disabled>Convert to GIF</button>
          <button id="cancel-button" class="ghost-button" type="button" hidden>Cancel</button>
        </div>
        <article class="output-column">
          <div id="progress-wrap" class="progress-wrap" hidden>
            <div class="progress-track">
              <div id="progress-bar" class="progress-bar"></div>
            </div>
          </div>
          <p id="progress-status" class="input-summary" hidden></p>
          <div id="output-skeleton" class="status-result">
            <div class="skeleton-button"></div>
            <div class="skeleton-frame"></div>
          </div>
          <div id="status-result" class="status-result" hidden>
            <a id="download-link" class="primary download-link" download="" hidden>Download GIF</a>
            <img id="result-preview" class="result-preview" alt="Generated GIF preview" hidden />
            <p id="result-meta" class="input-summary" hidden></p>
          </div>
        </article>
      </section>
    </main>
  `;

  const fileInput = root.querySelector<HTMLInputElement>("#file-input");
  const convertButton = root.querySelector<HTMLButtonElement>("#convert-button");
  const cancelButton = root.querySelector<HTMLButtonElement>("#cancel-button");
  const inputSkeleton = root.querySelector<HTMLElement>("#input-skeleton");
  const inputPreviewWrap = root.querySelector<HTMLElement>("#input-preview-wrap");
  const inputPreview = root.querySelector<HTMLVideoElement>("#input-preview");
  const fileName = root.querySelector<HTMLElement>("#file-name");
  const inputSummary = root.querySelector<HTMLElement>("#input-summary");
  const trimControls = root.querySelector<HTMLElement>("#trim-controls");
  const trimSelectedRange = root.querySelector<HTMLElement>("#trim-selected-range");
  const trimDuration = root.querySelector<HTMLElement>("#trim-duration");
  const trimStartInput = root.querySelector<HTMLInputElement>("#trim-start");
  const trimEndInput = root.querySelector<HTMLInputElement>("#trim-end");
  const trimStartReadout = root.querySelector<HTMLElement>("#trim-start-readout");
  const trimEndReadout = root.querySelector<HTMLElement>("#trim-end-readout");
  const errorMessage = root.querySelector<HTMLElement>("#error-message");
  const outputSkeleton = root.querySelector<HTMLElement>("#output-skeleton");
  const progressWrap = root.querySelector<HTMLElement>("#progress-wrap");
  const progressBar = root.querySelector<HTMLElement>("#progress-bar");
  const progressStatus = root.querySelector<HTMLElement>("#progress-status");
  const statusResult = root.querySelector<HTMLElement>("#status-result");
  const outputColumn = root.querySelector<HTMLElement>(".output-column");
  const resultMeta = root.querySelector<HTMLElement>("#result-meta");
  const resultPreview = root.querySelector<HTMLImageElement>("#result-preview");
  const downloadLink = root.querySelector<HTMLAnchorElement>("#download-link");

  if (
    !fileInput ||
    !convertButton ||
    !cancelButton ||
    !inputSkeleton ||
    !inputPreviewWrap ||
    !inputPreview ||
    !fileName ||
    !inputSummary ||
    !trimControls ||
    !trimSelectedRange ||
    !trimDuration ||
    !trimStartInput ||
    !trimEndInput ||
    !trimStartReadout ||
    !trimEndReadout ||
    !errorMessage ||
    !outputSkeleton ||
    !progressWrap ||
    !progressBar ||
    !progressStatus ||
    !statusResult ||
    !outputColumn ||
    !resultMeta ||
    !resultPreview ||
    !downloadLink
  ) {
    throw new Error("App failed to initialize.");
  }

  const clearResult = () => {
    if (state.result) {
      URL.revokeObjectURL(state.result.objectUrl);
    }

    state.result = null;
  };

  const clearInputPreview = () => {
    inputPreview.pause();
    inputPreview.removeAttribute("src");
    inputPreview.load();
    delete inputPreview.dataset.objectUrl;

    if (state.inputPreviewUrl) {
      URL.revokeObjectURL(state.inputPreviewUrl);
      state.inputPreviewUrl = null;
    }
  };

  const getProgressStatusMessage = (): string => {
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

    return "";
  };

  const syncMediaSource = (
    element: HTMLVideoElement | HTMLImageElement,
    objectUrl: string | null
  ) => {
    const currentObjectUrl = element.dataset.objectUrl ?? null;

    if (currentObjectUrl === objectUrl) {
      return;
    }

    if (!objectUrl) {
      if (element instanceof HTMLVideoElement) {
        element.pause();
        element.removeAttribute("src");
        element.load();
      } else {
        element.removeAttribute("src");
      }

      delete element.dataset.objectUrl;
      return;
    }

    element.src = objectUrl;
    element.dataset.objectUrl = objectUrl;
  };

  const render = () => {
    const inputSize = state.file
      ? formatBytes(state.file.size)
      : "-";
    const inputDimensions = state.metadata
      ? `${state.metadata.width} × ${state.metadata.height}`
      : "-";
    const inputDuration = state.metadata
      ? formatDuration(state.metadata.duration)
      : "-";
    fileName.textContent = state.file?.name ?? "No file chosen";
    const showInputPreview = state.inputPreviewUrl !== null;
    inputSummary.textContent = `${inputSize} / ${inputDimensions} / ${inputDuration}`;
    inputSummary.hidden = state.file === null;
    inputSkeleton.hidden = showInputPreview;
    inputPreviewWrap.hidden = !showInputPreview;
    syncMediaSource(inputPreview, state.inputPreviewUrl);

    const trimMetadata = hasKnownDuration(state.metadata)
      ? state.metadata
      : null;
    const trimRange = state.trimRange;
    const trimEnabled =
      trimMetadata !== null &&
      trimRange !== null &&
      trimMetadata.duration >= MIN_TRIM_SPAN;
    trimControls.hidden = !trimEnabled;

    if (trimEnabled) {
      const duration = trimMetadata.duration;
      const selectedDuration = getTrimDuration(trimRange);
      const startPercent =
        duration > 0
          ? (trimRange.startTime / duration) * 100
          : 0;
      const endPercent =
        duration > 0
          ? (trimRange.endTime / duration) * 100
          : 100;

      trimStartInput.min = "0";
      trimStartInput.max = String(duration);
      trimStartInput.step = String(TRIM_STEP);
      trimStartInput.value = String(trimRange.startTime);
      trimStartInput.disabled = state.isBusy;

      trimEndInput.min = "0";
      trimEndInput.max = String(duration);
      trimEndInput.step = String(TRIM_STEP);
      trimEndInput.value = String(trimRange.endTime);
      trimEndInput.disabled = state.isBusy;

      trimSelectedRange.style.left = `${startPercent}%`;
      trimSelectedRange.style.width = `${Math.max(endPercent - startPercent, 0)}%`;
      trimDuration.textContent = `${formatTrimTimestamp(selectedDuration)} selected`;
      trimStartReadout.textContent = formatTrimTimestamp(trimRange.startTime);
      trimEndReadout.textContent = formatTrimTimestamp(trimRange.endTime);
    } else {
      trimStartInput.value = "0";
      trimEndInput.value = "0";
      trimStartInput.disabled = true;
      trimEndInput.disabled = true;
      trimSelectedRange.style.left = "0%";
      trimSelectedRange.style.width = "100%";
      trimDuration.textContent = "0:00.0 selected";
      trimStartReadout.textContent = "0:00.0";
      trimEndReadout.textContent = "0:00.0";
    }

    errorMessage.hidden = !state.errorMessage;
    errorMessage.textContent = state.errorMessage;

    const showResult = state.result !== null;
    const progressStatusMessage = getProgressStatusMessage();
    const showProgress =
      !showResult &&
      (state.isBusy ||
        state.progress !== null ||
        state.conversionState === "loading-engine" ||
        state.conversionState === "converting" ||
        state.engineState === "loading");
    const showProgressStatus = !showResult && progressStatusMessage !== "";
    const showOutputSkeleton = !showResult && !showProgress && !showProgressStatus;

    outputColumn.dataset.mode = showResult
      ? "result"
      : showProgress || showProgressStatus
        ? "progress"
        : "idle";
    outputSkeleton.hidden = !showOutputSkeleton;
    progressWrap.hidden = !showProgress;
    statusResult.hidden = !showResult;
    progressBar.style.width = `${Math.round((state.progress ?? 0) * 100)}%`;
    progressStatus.hidden = !showProgressStatus;
    progressStatus.textContent = progressStatusMessage;

    if (state.result) {
      resultPreview.hidden = false;
      resultMeta.hidden = false;
      downloadLink.hidden = false;
      syncMediaSource(resultPreview, state.result.objectUrl);
      resultMeta.textContent =
        `${formatBytes(state.result.bytes)} / ` +
        `${state.result.width} × ${state.result.height} / ` +
        `${formatDuration(state.result.duration)}`;
      downloadLink.href = state.result.objectUrl;
      downloadLink.download = state.file ? getOutputName(state.file.name) : "output.gif";
    } else {
      resultPreview.hidden = true;
      resultMeta.hidden = true;
      downloadLink.hidden = true;
      syncMediaSource(resultPreview, null);
      resultMeta.textContent = "";
      downloadLink.removeAttribute("href");
      downloadLink.download = "";
    }

    const canConvert =
      !state.isBusy &&
      state.file !== null &&
      state.metadata !== null &&
      state.scaleFilter !== null;

    convertButton.textContent = state.isBusy ? "Converting..." : "Convert to GIF";
    convertButton.disabled = !canConvert;
    cancelButton.hidden = !state.isBusy;
    fileInput.disabled = state.isBusy;
  };

  converter.setHandlers({
    onLog: (line) => {
      console.log("[ffmpeg]", line);
    },
    onProgress: (value) => {
      if (!state.isBusy) {
        return;
      }

      state.progress = value;
      render();
    }
  });

  const loadEngine = async (operationId: number): Promise<boolean> => {
    state.conversionState = "loading-engine";
    state.engineState = "loading";
    state.isBusy = true;
    state.errorMessage = "";
    state.progress = null;
    render();

    try {
      await converter.ensureLoaded(getFfmpegPaths());

      if (operationId !== activeOperationId) {
        return false;
      }

      state.engineState = "ready";
      state.isBusy = false;
      state.conversionState = state.metadata ? "ready" : "idle";
      render();
      return true;
    } catch (error) {
      if (operationId !== activeOperationId) {
        return false;
      }

      state.engineState = "error";
      state.isBusy = false;
      state.conversionState = "error";
      state.errorMessage = `Failed to load ffmpeg engine: ${sanitizeError(error)}`;
      render();
      return false;
    }
  };

  const prepareFile = async (file: File) => {
    const operationId = ++activeOperationId;
    const nextEngineState = state.engineState === "ready"
      ? "ready"
      : "idle";

    clearResult();
    clearInputPreview();
    state.progress = null;
    state.engineState = nextEngineState;

    if (!isSupportedVideo(file)) {
      state.file = null;
      state.metadata = null;
      state.scaleFilter = null;
      state.trimRange = null;
      state.engineState = "idle";
      state.conversionState = "error";
      state.errorMessage = "Unsupported file type. Use an MP4 video.";
      render();
      return;
    }

    state.file = file;
    state.inputPreviewUrl = URL.createObjectURL(file);
    state.metadata = null;
    state.scaleFilter = null;
    state.trimRange = null;
    state.errorMessage = "";
    state.conversionState = "probing";
    render();

    try {
      const metadata = await readVideoMetadata(file);

      if (operationId !== activeOperationId) {
        return;
      }

      state.metadata = metadata;
      state.scaleFilter = computeScaleFilter(metadata.width, metadata.height);
      state.trimRange = hasKnownDuration(metadata)
        ? {
            startTime: 0,
            endTime: metadata.duration
          }
        : null;
      state.conversionState = "ready";
      render();
      warmEngineInBackground(operationId);
    } catch (error) {
      if (operationId !== activeOperationId) {
        return;
      }

      state.metadata = null;
      state.scaleFilter = null;
      state.trimRange = null;
      state.engineState = "idle";
      state.conversionState = "error";
      state.errorMessage = sanitizeError(error);
      render();
    }
  };

  const runConversion = async () => {
    if (!state.file || !state.metadata || !state.scaleFilter) {
      return;
    }

    const operationId = ++activeOperationId;

    const job: ConversionJob = {
      file: state.file,
      metadata: state.metadata,
      scaleFilter: state.scaleFilter,
      trimRange: state.trimRange,
      outputName: getOutputName(state.file.name)
    };

    inputPreview.pause();
    clearResult();
    const loaded =
      state.engineState === "ready"
        ? true
        : await loadEngine(operationId);

    if (!loaded || operationId !== activeOperationId || state.conversionState === "error") {
      return;
    }

    state.conversionState = "converting";
    state.isBusy = true;
    state.errorMessage = "";
    state.progress = 0;
    render();

    try {
      const result = await converter.convert(job);

      if (operationId !== activeOperationId) {
        URL.revokeObjectURL(result.objectUrl);
        return;
      }

      state.result = result;
      state.conversionState = "done";
      render();
    } catch (error) {
      if (operationId !== activeOperationId) {
        return;
      }

      state.conversionState = "error";
      state.errorMessage = `Conversion failed: ${sanitizeError(error)}`;
      render();
    } finally {
      if (operationId !== activeOperationId) {
        return;
      }

      state.isBusy = false;
      state.progress = state.conversionState === "done" ? 1 : null;
      render();
    }
  };

  const cancelConversion = () => {
    if (!state.isBusy) {
      return;
    }

    activeOperationId += 1;
    converter.terminate();
    clearResult();
    state.engineState = "idle";
    state.conversionState = state.metadata ? "ready" : "idle";
    state.errorMessage = "";
    state.isBusy = false;
    state.progress = null;
    render();
  };

  const seekPreview = (time: number) => {
    if (!Number.isFinite(time)) {
      return;
    }

    inputPreview.currentTime = Math.max(time, 0);
  };

  const resumePreviewPlayback = () => {
    void inputPreview.play().catch(() => {});
  };

  const warmEngineInBackground = (operationId: number) => {
    if (state.engineState !== "ready") {
      state.engineState = "loading";
      render();
    }

    void converter.ensureLoaded(getFfmpegPaths())
      .then(() => {
        if (operationId !== activeOperationId) {
          return;
        }

        state.engineState = "ready";
        render();
      })
      .catch(() => {
        if (operationId !== activeOperationId) {
          return;
        }

        state.engineState = "error";
        render();
      });
  };

  const getActivePreviewRange = (): TrimRange | null => {
    if (
      !hasKnownDuration(state.metadata) ||
      state.trimRange === null ||
      state.metadata.duration < MIN_TRIM_SPAN
    ) {
      return null;
    }

    return state.trimRange;
  };

  const getLoopEndThreshold = (endTime: number): number => {
    return Math.max(endTime - PREVIEW_LOOP_EPSILON, 0);
  };

  const seekPreviewToLoopStart = (range: TrimRange) => {
    seekPreview(range.startTime);
  };

  const enforcePreviewBounds = (
    options: { restartPlayback: boolean } = { restartPlayback: false }
  ) => {
    const range = getActivePreviewRange();

    if (!range) {
      return;
    }

    const loopEndThreshold = Math.max(
      getLoopEndThreshold(range.endTime),
      range.startTime
    );
    let didSeek = false;

    if (inputPreview.currentTime < range.startTime) {
      seekPreviewToLoopStart(range);
      didSeek = true;
    } else if (inputPreview.currentTime >= loopEndThreshold) {
      seekPreviewToLoopStart(range);
      didSeek = true;
    }

    if (didSeek && options.restartPlayback && !inputPreview.paused) {
      resumePreviewPlayback();
    }
  };

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];

    if (!file) {
      activeOperationId += 1;
      clearResult();
      clearInputPreview();
      Object.assign(state, initialState());
      render();
      return;
    }

    await prepareFile(file);
  });

  convertButton.addEventListener("click", async () => {
    await runConversion();
  });

  cancelButton.addEventListener("click", () => {
    cancelConversion();
  });

  inputPreview.addEventListener("play", () => {
    enforcePreviewBounds({ restartPlayback: false });
  });

  inputPreview.addEventListener("timeupdate", () => {
    if (inputPreview.paused) {
      return;
    }

    enforcePreviewBounds({ restartPlayback: true });
  });

  inputPreview.addEventListener("seeking", () => {
    if (inputPreview.paused) {
      return;
    }

    enforcePreviewBounds({ restartPlayback: true });
  });

  inputPreview.addEventListener("ended", () => {
    const range = getActivePreviewRange();

    if (!range) {
      return;
    }

    seekPreviewToLoopStart(range);
    resumePreviewPlayback();
  });

  trimStartInput.addEventListener("input", () => {
    if (!hasKnownDuration(state.metadata) || !state.trimRange || state.isBusy) {
      return;
    }

    const startTime = clampTrimStart(
      Number(trimStartInput.value),
      state.trimRange.endTime,
      state.metadata.duration,
      MIN_TRIM_SPAN
    );

    state.trimRange = {
      startTime,
      endTime: state.trimRange.endTime
    };
    clearResult();
    state.conversionState = "ready";
    seekPreview(startTime);
    if (!inputPreview.paused) {
      resumePreviewPlayback();
    }
    render();
  });

  trimEndInput.addEventListener("input", () => {
    if (!hasKnownDuration(state.metadata) || !state.trimRange || state.isBusy) {
      return;
    }

    const endTime = clampTrimEnd(
      state.trimRange.startTime,
      Number(trimEndInput.value),
      state.metadata.duration,
      MIN_TRIM_SPAN
    );

    state.trimRange = {
      startTime: state.trimRange.startTime,
      endTime
    };
    clearResult();
    state.conversionState = "ready";
    seekPreview(Math.min(endTime, Math.max(state.metadata.duration - PREVIEW_LOOP_EPSILON, 0)));
    if (!inputPreview.paused) {
      resumePreviewPlayback();
    }
    render();
  });

  window.addEventListener("beforeunload", () => {
    clearResult();
    clearInputPreview();
    converter.terminate();
  });

  render();
}
