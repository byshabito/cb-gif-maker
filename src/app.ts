import { BrowserGifConverter } from "./ffmpeg/client";
import {
  computeScaleFilter,
  getOutputName
} from "./conversion/pipeline";
import { readVideoMetadata } from "./video/metadata";
import type {
  ConversionJob,
  ConversionResult,
  ConversionState,
  FfmpegAssetPaths,
  InputMetadata,
  ScaleFilter
} from "./types";

const ACCEPTED_VIDEO_TYPES = ".mp4,video/mp4";
type AppState = {
  conversionState: ConversionState;
  file: File | null;
  metadata: InputMetadata | null;
  scaleFilter: ScaleFilter | null;
  result: ConversionResult | null;
  inputPreviewUrl: string | null;
  errorMessage: string;
  isBusy: boolean;
  progress: number | null;
};

const initialState = (): AppState => ({
  conversionState: "idle",
  file: null,
  metadata: null,
  scaleFilter: null,
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

export function initializeApp(root: HTMLDivElement): void {
  const converter = new BrowserGifConverter();
  const state = initialState();
  let activeOperationId = 0;
  const convertingFrames = [
    "Converting",
    "Converting.",
    "Converting..",
    "Converting..."
  ];
  let convertingFrameIndex = 0;
  let convertingLabelTimer: number | null = null;
  let wasAnimating = false;
  let accessibleConvertButtonLabel = "Convert to GIF";

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
          <p id="error-message" class="message error" hidden></p>
        </article>
        <div class="action-column">
          <button id="convert-button" class="primary convert-button" type="button" disabled>
            <span id="convert-button-label" class="convert-button__label" aria-hidden="true">Convert to GIF</span>
            <span class="convert-button__label convert-button__label--reserve" aria-hidden="true">Convert to GIF</span>
            <span class="convert-button__label convert-button__label--reserve" aria-hidden="true">Converting...</span>
            <span id="convert-button-a11y-label" class="sr-only">Convert to GIF</span>
          </button>
          <button id="cancel-button" class="ghost-button" type="button" hidden>Cancel</button>
        </div>
        <article class="output-column">
          <div id="progress-wrap" class="progress-wrap" hidden>
            <div class="progress-track">
              <div id="progress-bar" class="progress-bar"></div>
            </div>
          </div>
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
  const convertButtonLabel = root.querySelector<HTMLElement>("#convert-button-label");
  const convertButtonA11yLabel = root.querySelector<HTMLElement>("#convert-button-a11y-label");
  const cancelButton = root.querySelector<HTMLButtonElement>("#cancel-button");
  const inputSkeleton = root.querySelector<HTMLElement>("#input-skeleton");
  const inputPreviewWrap = root.querySelector<HTMLElement>("#input-preview-wrap");
  const inputPreview = root.querySelector<HTMLVideoElement>("#input-preview");
  const fileName = root.querySelector<HTMLElement>("#file-name");
  const inputSummary = root.querySelector<HTMLElement>("#input-summary");
  const errorMessage = root.querySelector<HTMLElement>("#error-message");
  const outputSkeleton = root.querySelector<HTMLElement>("#output-skeleton");
  const progressWrap = root.querySelector<HTMLElement>("#progress-wrap");
  const progressBar = root.querySelector<HTMLElement>("#progress-bar");
  const statusResult = root.querySelector<HTMLElement>("#status-result");
  const outputColumn = root.querySelector<HTMLElement>(".output-column");
  const resultMeta = root.querySelector<HTMLElement>("#result-meta");
  const resultPreview = root.querySelector<HTMLImageElement>("#result-preview");
  const downloadLink = root.querySelector<HTMLAnchorElement>("#download-link");

  if (
    !fileInput ||
    !convertButton ||
    !convertButtonLabel ||
    !convertButtonA11yLabel ||
    !cancelButton ||
    !inputSkeleton ||
    !inputPreviewWrap ||
    !inputPreview ||
    !fileName ||
    !inputSummary ||
    !errorMessage ||
    !outputSkeleton ||
    !progressWrap ||
    !progressBar ||
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

  const getVisibleConvertButtonLabel = (): string => {
    switch (state.conversionState) {
      case "loading-engine":
        return "Preparing...";
      case "converting":
        return convertingFrames[convertingFrameIndex];
      default:
        return "Convert to GIF";
    }
  };

  const getAccessibleConvertButtonLabel = (): string => {
    switch (state.conversionState) {
      case "loading-engine":
        return "Preparing...";
      case "converting":
        return "Converting...";
      default:
        return "Convert to GIF";
    }
  };

  const syncConvertButtonLabels = () => {
    convertButtonLabel.textContent = getVisibleConvertButtonLabel();

    const nextAccessibleLabel = getAccessibleConvertButtonLabel();
    if (accessibleConvertButtonLabel !== nextAccessibleLabel) {
      accessibleConvertButtonLabel = nextAccessibleLabel;
      convertButtonA11yLabel.textContent = nextAccessibleLabel;
    }
  };

  const stopConvertingLabelAnimation = () => {
    if (convertingLabelTimer !== null) {
      window.clearInterval(convertingLabelTimer);
      convertingLabelTimer = null;
    }

    convertingFrameIndex = 0;
  };

  const startConvertingLabelAnimation = () => {
    if (convertingLabelTimer !== null) {
      return;
    }

    convertingFrameIndex = 0;
    syncConvertButtonLabels();
    convertingLabelTimer = window.setInterval(() => {
      if (state.conversionState !== "converting") {
        stopConvertingLabelAnimation();
        syncConvertButtonLabels();
        return;
      }

      convertingFrameIndex = (convertingFrameIndex + 1) % convertingFrames.length;
      convertButtonLabel.textContent = getVisibleConvertButtonLabel();
    }, 400);
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

    errorMessage.hidden = !state.errorMessage;
    errorMessage.textContent = state.errorMessage;

    const showResult = state.result !== null;
    const showProgress =
      !showResult &&
      (state.isBusy ||
        state.progress !== null ||
        state.conversionState === "loading-engine" ||
        state.conversionState === "converting");
    const showOutputSkeleton = !showResult && !showProgress;

    outputColumn.dataset.mode = showResult
      ? "result"
      : showProgress
        ? "progress"
        : "idle";
    outputSkeleton.hidden = !showOutputSkeleton;
    progressWrap.hidden = !showProgress;
    statusResult.hidden = !showResult;
    progressBar.style.width = `${Math.round((state.progress ?? 0) * 100)}%`;

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

    const isAnimating = state.conversionState === "converting";
    if (isAnimating && !wasAnimating) {
      startConvertingLabelAnimation();
    } else if (!isAnimating && wasAnimating) {
      stopConvertingLabelAnimation();
    }
    wasAnimating = isAnimating;

    syncConvertButtonLabels();
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
    state.isBusy = true;
    state.errorMessage = "";
    state.progress = null;
    render();

    try {
      await converter.ensureLoaded(getFfmpegPaths());

      if (operationId !== activeOperationId) {
        return false;
      }

      state.isBusy = false;
      state.conversionState = state.metadata ? "ready" : "idle";
      render();
      return true;
    } catch (error) {
      if (operationId !== activeOperationId) {
        return false;
      }

      state.isBusy = false;
      state.conversionState = "error";
      state.errorMessage = `Failed to load ffmpeg engine: ${sanitizeError(error)}`;
      render();
      return false;
    }
  };

  const prepareFile = async (file: File) => {
    clearResult();
    clearInputPreview();
    state.progress = null;

    if (!isSupportedVideo(file)) {
      state.file = null;
      state.metadata = null;
      state.scaleFilter = null;
      state.conversionState = "error";
      state.errorMessage = "Unsupported file type. Use an MP4 video.";
      render();
      return;
    }

    state.file = file;
    state.inputPreviewUrl = URL.createObjectURL(file);
    state.metadata = null;
    state.scaleFilter = null;
    state.errorMessage = "";
    state.conversionState = "probing";
    render();

    try {
      const metadata = await readVideoMetadata(file);
      state.metadata = metadata;
      state.scaleFilter = computeScaleFilter(metadata.width, metadata.height);
      state.conversionState = "ready";
      render();
    } catch (error) {
      state.metadata = null;
      state.scaleFilter = null;
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
      outputName: getOutputName(state.file.name)
    };

    clearResult();
    const loaded = await loadEngine(operationId);

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
    state.conversionState = state.metadata ? "ready" : "idle";
    state.errorMessage = "";
    state.isBusy = false;
    state.progress = null;
    render();
  };

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];

    if (!file) {
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

  window.addEventListener("beforeunload", () => {
    stopConvertingLabelAnimation();
    clearResult();
    clearInputPreview();
    converter.terminate();
  });

  render();
}
