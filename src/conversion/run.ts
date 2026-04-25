import type { GifArtifactFactory } from "./artifacts";
import type { ConversionExecutor } from "./executor";
import type {
  ConversionProgressPhase,
  ConversionProgressUpdate,
  ConversionStepName,
  PlannedConversionJob,
} from "./types";
import type { ConversionResult } from "@/types";

type ProgressRange = readonly [number, number];

type RunGifConversionOptions = {
  onProgress?: (update: ConversionProgressUpdate) => void;
  getStepProgress?: () => number;
  resetStepProgress?: () => void;
};

const PROGRESS_RANGES = {
  writingInput: [0, 0.05],
  palette: [0.05, 0.25],
  encode: [0.25, 0.97],
  readingOutput: [0.97, 0.99],
  finalizing: [0.99, 1],
} as const satisfies Record<string, ProgressRange>;

const STEP_PROGRESS_RANGES = {
  palette: PROGRESS_RANGES.palette,
  encode: PROGRESS_RANGES.encode,
} as const satisfies Partial<Record<ConversionStepName, ProgressRange>>;

function clampProgress(value: number): number {
  return Math.max(0, Math.min(value, 1));
}

function mapProgressToRange(progress: number, range: ProgressRange): number {
  const [start, end] = range;

  return start + (end - start) * clampProgress(progress);
}

function getFallbackStepProgress(startTime: number): number {
  const elapsedMilliseconds = Date.now() - startTime;

  return Math.min(elapsedMilliseconds / 10_000, 0.92);
}

export async function runGifConversion(
  job: PlannedConversionJob,
  executor: ConversionExecutor,
  artifactFactory: GifArtifactFactory,
  options: RunGifConversionOptions = {}
): Promise<ConversionResult> {
  const cleanupFiles = [
    job.plan.files.input,
    ...job.plan.steps.flatMap((step) => step.outputs),
  ];
  let lastReportedProgress = 0;

  const emitProgress = (
    progress: number,
    phase: ConversionProgressPhase
  ): void => {
    const nextProgress = Math.max(
      lastReportedProgress,
      clampProgress(progress)
    );

    lastReportedProgress = nextProgress;
    options.onProgress?.({ progress: nextProgress, phase });
  };

  const runStep = async (
    step: PlannedConversionJob["plan"]["steps"][number]
  ): Promise<void> => {
    const range =
      step.name === "palette" || step.name === "encode"
        ? STEP_PROGRESS_RANGES[step.name]
        : null;
    const phase = step.name === "palette" ? "palette" : "encode";

    options.resetStepProgress?.();

    if (!range) {
      await executor.exec(step.command);
      return;
    }

    const startTime = Date.now();
    const intervalId = globalThis.setInterval(() => {
      const reportedStepProgress = options.getStepProgress?.() ?? 0;
      emitProgress(
        mapProgressToRange(
          Math.max(reportedStepProgress, getFallbackStepProgress(startTime)),
          range
        ),
        phase
      );
    }, 100);

    try {
      await executor.exec(step.command);
      emitProgress(range[1], phase);
    } finally {
      globalThis.clearInterval(intervalId);
    }
  };

  try {
    emitProgress(0, "preparing");
    await executor.writeFile(job.plan.files.input, job.request.file);
    emitProgress(PROGRESS_RANGES.writingInput[1], "writing-input");

    for (const step of job.plan.steps) {
      await runStep(step);
    }

    const bytes = await executor.readFile(job.plan.files.output);
    emitProgress(PROGRESS_RANGES.readingOutput[1], "reading-output");

    const result = await artifactFactory.createResult(bytes, {
      duration: job.plan.effectiveDuration,
      dimensions: job.plan.outputDimensions,
    });
    emitProgress(PROGRESS_RANGES.finalizing[1], "complete");

    return result;
  } finally {
    await Promise.allSettled(cleanupFiles.map((path) => executor.deleteFile(path)));
  }
}
