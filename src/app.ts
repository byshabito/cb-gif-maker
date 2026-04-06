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
const MAX_LOG_LINES = 200;

type AppState = {
  conversionState: ConversionState;
  file: File | null;
  metadata: InputMetadata | null;
  scaleFilter: ScaleFilter | null;
  result: ConversionResult | null;
  statusMessage: string;
  errorMessage: string;
  warningMessage: string;
  showReloadEngine: boolean;
  isBusy: boolean;
  progress: number | null;
  logs: string[];
};

const initialState = (): AppState => ({
  conversionState: "idle",
  file: null,
  metadata: null,
  scaleFilter: null,
  result: null,
  statusMessage: "Select a local video to begin.",
  errorMessage: "",
  warningMessage: "",
  showReloadEngine: false,
  isBusy: false,
  progress: null,
  logs: []
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
        <label class="file-picker">
          <span>Choose a video</span>
          <input id="file-input" type="file" accept="${ACCEPTED_VIDEO_TYPES}" />
        </label>
        <div class="actions">
          <button id="convert-button" class="primary" type="button" disabled>Convert to GIF</button>
          <button id="reset-button" type="button">Reset</button>
          <button id="reload-button" type="button" hidden>Reload engine</button>
        </div>
      </section>
      <section class="panel info-grid">
        <article>
          <h2>Input</h2>
          <dl class="meta-list">
            <div><dt>File</dt><dd id="input-file">None selected</dd></div>
            <div><dt>Dimensions</dt><dd id="input-dimensions">-</dd></div>
            <div><dt>Duration</dt><dd id="input-duration">-</dd></div>
            <div><dt>Scale rule</dt><dd id="input-scale">-</dd></div>
          </dl>
          <p id="warning-message" class="message warning" hidden></p>
          <p id="error-message" class="message error" hidden></p>
        </article>
        <article>
          <h2>Status</h2>
          <p id="status-message" class="status-text">${state.statusMessage}</p>
          <div class="progress-wrap">
            <div class="progress-track">
              <div id="progress-bar" class="progress-bar"></div>
            </div>
            <p id="progress-label" class="progress-label">Idle</p>
          </div>
        </article>
      </section>
      <section class="panel log-panel">
        <div class="section-heading">
          <h2>Logs</h2>
          <span class="caption">Latest ffmpeg output</span>
        </div>
        <pre id="log-output" class="log-output">Waiting for work.</pre>
      </section>
      <section id="result-panel" class="panel result-panel" hidden>
        <div class="section-heading">
          <h2>Result</h2>
          <span id="result-meta" class="caption"></span>
        </div>
        <img id="result-preview" class="result-preview" alt="Generated GIF preview" />
        <a id="download-link" class="primary download-link" download="">Download GIF</a>
      </section>
    </main>
  `;

  const fileInput = root.querySelector<HTMLInputElement>("#file-input");
  const convertButton = root.querySelector<HTMLButtonElement>("#convert-button");
  const resetButton = root.querySelector<HTMLButtonElement>("#reset-button");
  const reloadButton = root.querySelector<HTMLButtonElement>("#reload-button");
  const inputFile = root.querySelector<HTMLElement>("#input-file");
  const inputDimensions = root.querySelector<HTMLElement>("#input-dimensions");
  const inputDuration = root.querySelector<HTMLElement>("#input-duration");
  const inputScale = root.querySelector<HTMLElement>("#input-scale");
  const warningMessage = root.querySelector<HTMLElement>("#warning-message");
  const errorMessage = root.querySelector<HTMLElement>("#error-message");
  const statusMessage = root.querySelector<HTMLElement>("#status-message");
  const progressBar = root.querySelector<HTMLElement>("#progress-bar");
  const progressLabel = root.querySelector<HTMLElement>("#progress-label");
  const logOutput = root.querySelector<HTMLElement>("#log-output");
  const resultPanel = root.querySelector<HTMLElement>("#result-panel");
  const resultMeta = root.querySelector<HTMLElement>("#result-meta");
  const resultPreview = root.querySelector<HTMLImageElement>("#result-preview");
  const downloadLink = root.querySelector<HTMLAnchorElement>("#download-link");

  if (
    !fileInput ||
    !convertButton ||
    !resetButton ||
    !reloadButton ||
    !inputFile ||
    !inputDimensions ||
    !inputDuration ||
    !inputScale ||
    !warningMessage ||
    !errorMessage ||
    !statusMessage ||
    !progressBar ||
    !progressLabel ||
    !logOutput ||
    !resultPanel ||
    !resultMeta ||
    !resultPreview ||
    !downloadLink
  ) {
    throw new Error("App failed to initialize.");
  }

  const pushLog = (line: string) => {
    state.logs = [...state.logs, line].slice(-MAX_LOG_LINES);
    render();
  };

  const clearResult = () => {
    if (state.result) {
      URL.revokeObjectURL(state.result.objectUrl);
    }

    state.result = null;
  };

  const resetState = () => {
    clearResult();
    Object.assign(state, initialState());
    fileInput.value = "";
    render();
  };

  const render = () => {
    inputFile.textContent = state.file?.name ?? "None selected";
    inputDimensions.textContent = state.metadata
      ? `${state.metadata.width} × ${state.metadata.height}`
      : "-";
    inputDuration.textContent = state.metadata
      ? formatDuration(state.metadata.duration)
      : "-";
    inputScale.textContent = state.scaleFilter ?? "-";

    warningMessage.hidden = !state.warningMessage;
    warningMessage.textContent = state.warningMessage;
    errorMessage.hidden = !state.errorMessage;
    errorMessage.textContent = state.errorMessage;
    statusMessage.textContent = state.statusMessage;
    progressBar.style.width = `${Math.round((state.progress ?? 0) * 100)}%`;
    progressLabel.textContent =
      state.progress === null
        ? state.conversionState
        : `${Math.round(state.progress * 100)}%`;
    logOutput.textContent =
      state.logs.length > 0 ? state.logs.join("\n") : "Waiting for work.";

    resultPanel.hidden = !state.result;

    if (state.result) {
      resultPreview.src = state.result.objectUrl;
      resultMeta.textContent = `${formatBytes(state.result.bytes)} • ${(
        state.result.elapsedMs / 1000
      ).toFixed(2)} s`;
      downloadLink.href = state.result.objectUrl;
      downloadLink.download = state.file ? getOutputName(state.file.name) : "output.gif";
    } else {
      resultPreview.removeAttribute("src");
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
    resetButton.disabled = state.isBusy;
    reloadButton.disabled = state.isBusy;
  };

  converter.setHandlers({
    onLog: (line) => {
      pushLog(line);
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
    state.logs = [];
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
    state.logs = [];
    state.progress = 0;
    render();

    try {
      const result = await converter.convert(job);
      clearResult();
      state.result = result;
      state.logs = result.logs.slice(-MAX_LOG_LINES);
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
      resetState();
      return;
    }

    await prepareFile(file);
  });

  convertButton.addEventListener("click", async () => {
    await runConversion();
  });

  resetButton.addEventListener("click", () => {
    resetState();
  });

  reloadButton.addEventListener("click", async () => {
    await loadEngine(true);
  });

  window.addEventListener("beforeunload", () => {
    clearResult();
    converter.terminate();
  });

  render();
}
