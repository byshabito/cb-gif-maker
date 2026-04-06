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

const ACCEPTED_VIDEO_TYPES = ".mp4,.webm,.mov,video/*";
const WARNING_SIZE_BYTES = 200 * 1024 * 1024;

type AppState = {
  conversionState: ConversionState;
  file: File | null;
  metadata: InputMetadata | null;
  scaleFilter: ScaleFilter | null;
  result: ConversionResult | null;
  inputPreviewUrl: string | null;
  statusMessage: string;
  errorMessage: string;
  warningMessage: string;
  showReloadEngine: boolean;
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
  statusMessage: "Select a local video to begin.",
  errorMessage: "",
  warningMessage: "",
  showReloadEngine: false,
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
  return (
    lowerName.endsWith(".mp4") ||
    lowerName.endsWith(".webm") ||
    lowerName.endsWith(".mov") ||
    file.type.startsWith("video/")
  );
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

  root.innerHTML = `
    <main class="shell">
      <section class="hero">
        <p class="eyebrow">CbGifTool</p>
        <h1>Local video to GIF conversion in the browser.</h1>
        <p class="lede">Runs entirely in your browser with ffmpeg.wasm. No uploads. No backend.</p>
      </section>
      <section class="panel controls-panel">
        <article>
          <label class="file-picker">
            <span>Choose a video</span>
            <input id="file-input" type="file" accept="${ACCEPTED_VIDEO_TYPES}" />
          </label>
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
          <p id="input-summary" class="input-summary">- / - / -</p>
          <p id="warning-message" class="message warning" hidden></p>
          <p id="error-message" class="message error" hidden></p>
        </article>
        <article>
          <p id="status-message" class="status-text">${state.statusMessage}</p>
          <div id="progress-wrap" class="progress-wrap" hidden>
            <div class="progress-track">
              <div id="progress-bar" class="progress-bar"></div>
            </div>
            <p id="progress-label" class="progress-label">Idle</p>
          </div>
          <div id="status-result" class="status-result" hidden>
            <img id="result-preview" class="result-preview" alt="Generated GIF preview" />
            <div class="result-toolbar">
              <span id="result-meta" class="caption"></span>
              <a id="download-link" class="primary download-link" download="">Download GIF</a>
            </div>
          </div>
          <div class="actions status-actions">
            <button id="convert-button" class="primary" type="button" disabled>Convert to GIF</button>
            <button id="reload-button" type="button" hidden>Reload engine</button>
          </div>
        </article>
      </section>
    </main>
  `;

  const fileInput = root.querySelector<HTMLInputElement>("#file-input");
  const convertButton = root.querySelector<HTMLButtonElement>("#convert-button");
  const reloadButton = root.querySelector<HTMLButtonElement>("#reload-button");
  const inputPreviewWrap = root.querySelector<HTMLElement>("#input-preview-wrap");
  const inputPreview = root.querySelector<HTMLVideoElement>("#input-preview");
  const inputSummary = root.querySelector<HTMLElement>("#input-summary");
  const warningMessage = root.querySelector<HTMLElement>("#warning-message");
  const errorMessage = root.querySelector<HTMLElement>("#error-message");
  const statusMessage = root.querySelector<HTMLElement>("#status-message");
  const progressWrap = root.querySelector<HTMLElement>("#progress-wrap");
  const progressBar = root.querySelector<HTMLElement>("#progress-bar");
  const progressLabel = root.querySelector<HTMLElement>("#progress-label");
  const statusResult = root.querySelector<HTMLElement>("#status-result");
  const resultMeta = root.querySelector<HTMLElement>("#result-meta");
  const resultPreview = root.querySelector<HTMLImageElement>("#result-preview");
  const downloadLink = root.querySelector<HTMLAnchorElement>("#download-link");

  if (
    !fileInput ||
    !convertButton ||
    !reloadButton ||
    !inputPreviewWrap ||
    !inputPreview ||
    !inputSummary ||
    !warningMessage ||
    !errorMessage ||
    !statusMessage ||
    !progressWrap ||
    !progressBar ||
    !progressLabel ||
    !statusResult ||
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
    inputSummary.textContent = `${inputSize} / ${inputDimensions} / ${inputDuration}`;
    inputPreviewWrap.hidden = state.inputPreviewUrl === null;
    syncMediaSource(inputPreview, state.inputPreviewUrl);

    warningMessage.hidden = !state.warningMessage;
    warningMessage.textContent = state.warningMessage;
    errorMessage.hidden = !state.errorMessage;
    errorMessage.textContent = state.errorMessage;
    statusMessage.textContent = state.statusMessage;

    const showResult = state.result !== null;
    const showProgress =
      !showResult &&
      (state.isBusy ||
        state.progress !== null ||
        state.conversionState === "loading-engine" ||
        state.conversionState === "converting");

    progressWrap.hidden = !showProgress;
    statusResult.hidden = !showResult;
    progressBar.style.width = `${Math.round((state.progress ?? 0) * 100)}%`;
    progressLabel.textContent =
      state.progress === null
        ? state.conversionState
        : `${Math.round(state.progress * 100)}%`;

    if (state.result) {
      syncMediaSource(resultPreview, state.result.objectUrl);
      resultMeta.textContent =
        `${formatBytes(state.result.bytes)} / ` +
        `${state.result.width} × ${state.result.height} / ` +
        `${formatDuration(state.result.duration)}`;
      downloadLink.href = state.result.objectUrl;
      downloadLink.download = state.file ? getOutputName(state.file.name) : "output.gif";
    } else {
      syncMediaSource(resultPreview, null);
      resultMeta.textContent = "";
      downloadLink.removeAttribute("href");
      downloadLink.download = "";
    }

    reloadButton.hidden = !state.showReloadEngine;

    const canConvert =
      !state.isBusy &&
      state.file !== null &&
      state.metadata !== null &&
      state.scaleFilter !== null &&
      !state.showReloadEngine;

    convertButton.disabled = !canConvert;
    fileInput.disabled = state.isBusy;
    reloadButton.disabled = state.isBusy;
  };

  converter.setHandlers({
    onLog: (line) => {
      console.log("[ffmpeg]", line);
    },
    onProgress: (value) => {
      state.progress = value;
      render();
    }
  });

  const loadEngine = async (forceReload = false) => {
    state.conversionState = "loading-engine";
    state.isBusy = true;
    state.showReloadEngine = false;
    state.statusMessage = "Loading ffmpeg engine from local site assets.";
    state.errorMessage = "";
    state.progress = null;
    render();

    try {
      if (forceReload) {
        await converter.reload(getFfmpegPaths());
      } else {
        await converter.ensureLoaded(getFfmpegPaths());
      }

      state.isBusy = false;
      state.conversionState = state.metadata ? "ready" : "idle";
      state.statusMessage = state.metadata
        ? "Engine ready. Convert when you are ready."
        : "Engine ready. Select a local video to begin.";
      render();
    } catch (error) {
      state.isBusy = false;
      state.conversionState = "error";
      state.showReloadEngine = true;
      state.errorMessage = `Failed to load ffmpeg engine: ${sanitizeError(error)}`;
      state.statusMessage = "Engine load failed.";
      render();
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
      state.errorMessage = "Unsupported file type. Use MP4, WebM, MOV, or another browser-readable video.";
      state.statusMessage = "Select a supported local video.";
      render();
      return;
    }

    state.file = file;
    state.inputPreviewUrl = URL.createObjectURL(file);
    state.metadata = null;
    state.scaleFilter = null;
    state.warningMessage =
      file.size > WARNING_SIZE_BYTES
        ? "Large files over 200 MB can fail in the browser because of memory limits."
        : "";
    state.errorMessage = "";
    state.conversionState = "probing";
    state.statusMessage = "Reading local video metadata in the browser.";
    render();

    try {
      const metadata = await readVideoMetadata(file);
      state.metadata = metadata;
      state.scaleFilter = computeScaleFilter(metadata.width, metadata.height);
      state.conversionState = "ready";
      state.statusMessage = "Video ready. Convert to generate a GIF.";
      render();
    } catch (error) {
      state.metadata = null;
      state.scaleFilter = null;
      state.conversionState = "error";
      state.errorMessage = sanitizeError(error);
      state.statusMessage = "Metadata probe failed.";
      render();
    }
  };

  const runConversion = async () => {
    if (!state.file || !state.metadata || !state.scaleFilter) {
      return;
    }

    const job: ConversionJob = {
      file: state.file,
      metadata: state.metadata,
      scaleFilter: state.scaleFilter,
      outputName: getOutputName(state.file.name)
    };

    if (!state.showReloadEngine) {
      await loadEngine(false);
    }

    if (state.conversionState === "error") {
      return;
    }

    state.conversionState = "converting";
    state.isBusy = true;
    state.errorMessage = "";
    state.statusMessage = `Converting ${job.file.name} to ${job.outputName}.`;
    state.progress = 0;
    render();

    try {
      const result = await converter.convert(job);
      clearResult();
      state.result = result;
      state.conversionState = "done";
      state.statusMessage = "GIF ready for preview and download.";
      render();
    } catch (error) {
      state.conversionState = "error";
      state.errorMessage = `Conversion failed: ${sanitizeError(error)}`;
      state.statusMessage = "Conversion failed.";
      render();
    } finally {
      state.isBusy = false;
      state.progress = state.conversionState === "done" ? 1 : null;
      render();
    }
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

  reloadButton.addEventListener("click", async () => {
    await loadEngine(true);
  });

  window.addEventListener("beforeunload", () => {
    clearResult();
    clearInputPreview();
    converter.terminate();
  });

  render();
}
