import { useEffect, useMemo, useRef, useState } from "react";
import { BrowserGifConverter } from "@/ffmpeg/client";
import { getOutputName } from "@/conversion/pipeline";
import {
  clampTrimEnd,
  clampTrimStart,
  getTrimDuration,
} from "@/video/trim";
import { readVideoMetadata } from "@/video/metadata";
import type { ConversionJob, ConversionResult, TrimRange } from "@/types";
import {
  MIN_TRIM_SPAN,
  PREVIEW_LOOP_EPSILON,
  createInitialState,
  getFfmpegPaths,
  getProgressStatusMessage,
  hasKnownDuration,
  isSupportedVideo,
  sanitizeError,
} from "@/lib/gif-it";

function createConverter() {
  return new BrowserGifConverter();
}

export function useGifIt() {
  const [state, setState] = useState(createInitialState);
  const stateRef = useRef(state);
  const converterRef = useRef<BrowserGifConverter | null>(null);
  const operationIdRef = useRef(0);
  const previewRef = useRef<HTMLVideoElement | null>(null);

  if (!converterRef.current) {
    converterRef.current = createConverter();
  }

  const setAppState = (
    nextState:
      | ReturnType<typeof createInitialState>
      | ((currentState: typeof state) => typeof state)
  ) => {
    setState((currentState) => {
      const resolvedState =
        typeof nextState === "function"
          ? nextState(currentState)
          : nextState;
      stateRef.current = resolvedState;
      return resolvedState;
    });
  };

  const revokeResult = () => {
    const currentResult = stateRef.current.result;

    if (currentResult) {
      URL.revokeObjectURL(currentResult.objectUrl);
    }
  };

  const clearResult = () => {
    revokeResult();
    setAppState((currentState) => ({
      ...currentState,
      result: null,
    }));
  };

  const revokeInputPreview = () => {
    const preview = previewRef.current;

    preview?.pause();
    preview?.removeAttribute("src");
    preview?.load();

    const currentPreviewUrl = stateRef.current.inputPreviewUrl;

    if (currentPreviewUrl) {
      URL.revokeObjectURL(currentPreviewUrl);
    }
  };

  const clearInputPreview = () => {
    revokeInputPreview();
    setAppState((currentState) => ({
      ...currentState,
      inputPreviewUrl: null,
    }));
  };

  const getActivePreviewRange = (): TrimRange | null => {
    const currentState = stateRef.current;

    if (
      !hasKnownDuration(currentState.metadata) ||
      currentState.trimRange === null ||
      currentState.metadata.duration < MIN_TRIM_SPAN
    ) {
      return null;
    }

    return currentState.trimRange;
  };

  const seekPreview = (time: number) => {
    const preview = previewRef.current;

    if (!preview || !Number.isFinite(time)) {
      return;
    }

    preview.currentTime = Math.max(time, 0);
  };

  const resumePreviewPlayback = () => {
    void previewRef.current?.play().catch(() => {});
  };

  const seekPreviewToLoopStart = (range: TrimRange) => {
    seekPreview(range.startTime);
  };

  const getLoopEndThreshold = (endTime: number) => {
    return Math.max(endTime - PREVIEW_LOOP_EPSILON, 0);
  };

  const enforcePreviewBounds = (
    options: { restartPlayback: boolean } = { restartPlayback: false }
  ) => {
    const range = getActivePreviewRange();
    const preview = previewRef.current;

    if (!range || !preview) {
      return;
    }

    const loopEndThreshold = Math.max(
      getLoopEndThreshold(range.endTime),
      range.startTime
    );
    let didSeek = false;

    if (preview.currentTime < range.startTime) {
      seekPreviewToLoopStart(range);
      didSeek = true;
    } else if (preview.currentTime >= loopEndThreshold) {
      seekPreviewToLoopStart(range);
      didSeek = true;
    }

    if (didSeek && options.restartPlayback && !preview.paused) {
      resumePreviewPlayback();
    }
  };

  const warmEngineInBackground = (operationId: number) => {
    if (stateRef.current.engineState !== "ready") {
      setAppState((currentState) => ({
        ...currentState,
        engineState: "loading",
      }));
    }

    void converterRef.current!
      .ensureLoaded(getFfmpegPaths())
      .then(() => {
        if (operationId !== operationIdRef.current) {
          return;
        }

        setAppState((currentState) => ({
          ...currentState,
          engineState: "ready",
        }));
      })
      .catch(() => {
        if (operationId !== operationIdRef.current) {
          return;
        }

        setAppState((currentState) => ({
          ...currentState,
          engineState: "error",
        }));
      });
  };

  const loadEngine = async (operationId: number): Promise<boolean> => {
    setAppState((currentState) => ({
      ...currentState,
      conversionState: "loading-engine",
      engineState: "loading",
      isBusy: true,
      errorMessage: "",
      progress: null,
    }));

    try {
      await converterRef.current!.ensureLoaded(getFfmpegPaths());

      if (operationId !== operationIdRef.current) {
        return false;
      }

      setAppState((currentState) => ({
        ...currentState,
        conversionState: currentState.metadata ? "ready" : "idle",
        engineState: "ready",
        isBusy: false,
      }));

      return true;
    } catch (error) {
      if (operationId !== operationIdRef.current) {
        return false;
      }

      setAppState((currentState) => ({
        ...currentState,
        conversionState: "error",
        engineState: "error",
        isBusy: false,
        errorMessage: `Failed to load ffmpeg engine: ${sanitizeError(error)}`,
      }));

      return false;
    }
  };

  const resetState = () => {
    operationIdRef.current += 1;
    revokeResult();
    revokeInputPreview();
    setAppState(createInitialState());
  };

  const selectFile = async (file: File | null) => {
    if (!file) {
      resetState();
      return;
    }

    const operationId = ++operationIdRef.current;
    revokeResult();
    clearInputPreview();
    const nextEngineState =
      stateRef.current.engineState === "ready" ? "ready" : "idle";

    setAppState((currentState) => ({
      ...currentState,
      progress: null,
      result: null,
      engineState: nextEngineState,
    }));

    if (!isSupportedVideo(file)) {
      setAppState((currentState) => ({
        ...currentState,
        conversionState: "error",
        engineState: "idle",
        file: null,
        metadata: null,
        trimRange: null,
        result: null,
        inputPreviewUrl: null,
        errorMessage: "Unsupported file type. Use an MP4 video.",
      }));
      return;
    }

    const inputPreviewUrl = URL.createObjectURL(file);

    setAppState((currentState) => ({
      ...currentState,
      conversionState: "probing",
      file,
      metadata: null,
      trimRange: null,
      result: null,
      inputPreviewUrl,
      errorMessage: "",
    }));

    try {
      const metadata = await readVideoMetadata(file);

      if (operationId !== operationIdRef.current) {
        return;
      }

      setAppState((currentState) => ({
        ...currentState,
        conversionState: "ready",
        metadata,
        trimRange: hasKnownDuration(metadata)
          ? {
              startTime: 0,
              endTime: metadata.duration,
            }
          : null,
        errorMessage: "",
        file,
      }));
      warmEngineInBackground(operationId);
    } catch (error) {
      if (operationId !== operationIdRef.current) {
        return;
      }

      setAppState((currentState) => ({
        ...currentState,
        conversionState: "error",
        engineState: "idle",
        metadata: null,
        trimRange: null,
        errorMessage: sanitizeError(error),
      }));
    }
  };

  const updateTrimRange = (values: number[]) => {
    const currentState = stateRef.current;

    if (
      !hasKnownDuration(currentState.metadata) ||
      currentState.trimRange === null ||
      currentState.isBusy
    ) {
      return;
    }

    const [nextStartRaw, nextEndRaw] = values;

    if (
      typeof nextStartRaw !== "number" ||
      typeof nextEndRaw !== "number"
    ) {
      return;
    }

    const startTime = clampTrimStart(
      nextStartRaw,
      nextEndRaw,
      currentState.metadata.duration,
      MIN_TRIM_SPAN
    );
    const endTime = clampTrimEnd(
      startTime,
      nextEndRaw,
      currentState.metadata.duration,
      MIN_TRIM_SPAN
    );
    const didChangeStart = startTime !== currentState.trimRange.startTime;

    revokeResult();

    setAppState((previousState) => ({
      ...previousState,
      conversionState: "ready",
      result: null,
      trimRange: {
        startTime,
        endTime,
      },
    }));

    seekPreview(
      didChangeStart
        ? startTime
        : Math.min(
            endTime,
            Math.max(currentState.metadata.duration - PREVIEW_LOOP_EPSILON, 0)
          )
    );

    if (!previewRef.current?.paused) {
      resumePreviewPlayback();
    }
  };

  const runConversion = async () => {
    const currentState = stateRef.current;

    if (!currentState.file || !currentState.metadata) {
      return;
    }

    const operationId = ++operationIdRef.current;
    const job: ConversionJob = {
      file: currentState.file,
      metadata: currentState.metadata,
      trimRange: currentState.trimRange,
      outputName: getOutputName(currentState.file.name),
    };

    previewRef.current?.pause();
    clearResult();

    const loaded =
      currentState.engineState === "ready"
        ? true
        : await loadEngine(operationId);

    if (
      !loaded ||
      operationId !== operationIdRef.current ||
      stateRef.current.conversionState === "error"
    ) {
      return;
    }

    setAppState((previousState) => ({
      ...previousState,
      conversionState: "converting",
      isBusy: true,
      errorMessage: "",
      progress: 0,
    }));

    try {
      const result = await converterRef.current!.convert(job);

      if (operationId !== operationIdRef.current) {
        URL.revokeObjectURL(result.objectUrl);
        return;
      }

      setAppState((previousState) => ({
        ...previousState,
        conversionState: "done",
        result,
      }));
    } catch (error) {
      if (operationId !== operationIdRef.current) {
        return;
      }

      setAppState((previousState) => ({
        ...previousState,
        conversionState: "error",
        errorMessage: `Conversion failed: ${sanitizeError(error)}`,
      }));
    } finally {
      if (operationId !== operationIdRef.current) {
        return;
      }

      setAppState((previousState) => ({
        ...previousState,
        isBusy: false,
        progress: previousState.conversionState === "done" ? 1 : null,
      }));
    }
  };

  const cancelConversion = () => {
    if (!stateRef.current.isBusy) {
      return;
    }

    operationIdRef.current += 1;
    converterRef.current!.terminate();
    clearResult();

    setAppState((currentState) => ({
      ...currentState,
      engineState: "idle",
      conversionState: currentState.metadata ? "ready" : "idle",
      errorMessage: "",
      isBusy: false,
      progress: null,
      result: null,
    }));
  };

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const converter = converterRef.current!;

    converter.setHandlers({
      onLog: (line) => {
        console.log("[ffmpeg]", line);
      },
      onProgress: (value) => {
        if (!stateRef.current.isBusy) {
          return;
        }

        setAppState((currentState) => ({
          ...currentState,
          progress: value,
        }));
      },
    });

    const handleBeforeUnload = () => {
      revokeResult();
      revokeInputPreview();
      converter.terminate();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      revokeResult();
      revokeInputPreview();
      converter.terminate();
    };
  }, []);

  const convertButtonLabel = useMemo(() => {
    switch (state.conversionState) {
      case "loading-engine":
        return "Preparing...";
      case "converting":
        return "Converting...";
      default:
        return "Convert to GIF";
    }
  }, [state.conversionState]);

  const accessibleConvertButtonLabel = useMemo(() => {
    switch (state.conversionState) {
      case "loading-engine":
        return "Preparing...";
      case "converting":
        return "Converting...";
      default:
        return "Convert to GIF";
    }
  }, [state.conversionState]);

  const progressStatusMessage = useMemo(() => {
    return getProgressStatusMessage(state);
  }, [state]);

  const canConvert = Boolean(
    !state.isBusy && state.file && state.metadata
  );
  const trimDuration = state.trimRange ? getTrimDuration(state.trimRange) : 0;

  return {
    accessibleConvertButtonLabel,
    canConvert,
    convertButtonLabel,
    clearResult,
    previewRef,
    progressStatusMessage,
    selectFile,
    state,
    trimDuration,
    cancelConversion,
    enforcePreviewBounds,
    runConversion,
    seekPreviewToLoopStart,
    resumePreviewPlayback,
    updateTrimRange,
  };
}
