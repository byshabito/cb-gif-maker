import type { GifArtifactFactory } from "./artifacts";
import type { ConversionExecutor } from "./executor";
import type { PlannedConversionJob } from "./types";
import type { ConversionResult } from "@/types";

export async function runGifConversion(
  job: PlannedConversionJob,
  executor: ConversionExecutor,
  artifactFactory: GifArtifactFactory
): Promise<ConversionResult> {
  const cleanupFiles = [
    job.plan.files.input,
    ...job.plan.steps.flatMap((step) => step.outputs),
  ];

  try {
    await executor.writeFile(job.plan.files.input, job.request.file);

    for (const step of job.plan.steps) {
      await executor.exec(step.command);
    }

    const bytes = await executor.readFile(job.plan.files.output);

    return await artifactFactory.createResult(bytes, {
      duration: job.plan.effectiveDuration,
      dimensions: job.plan.outputDimensions,
    });
  } finally {
    await Promise.allSettled(cleanupFiles.map((path) => executor.deleteFile(path)));
  }
}
