import type { GifArtifactFactory } from "./artifacts";
import type { ConversionExecutor, VirtualFileData } from "./executor";
import { createGifConversionPlan } from "./pipeline";
import { runGifConversion } from "./run";
import type {
  ConversionProgressUpdate,
  FfmpegCommand,
  PlannedConversionJob,
} from "./types";
import type { ConversionResult } from "@/types";

function createJob(): PlannedConversionJob {
  const request = {
    file: new File(["video"], "clip.mp4", { type: "video/mp4" }),
    metadata: { width: 500, height: 100, duration: 4 },
    trimRange: { startTime: 1, endTime: 3 },
  };

  return {
    request,
    plan: createGifConversionPlan(request),
  };
}

function createResult(duration?: number): ConversionResult {
  return {
    blob: new Blob(["gif"], { type: "image/gif" }),
    objectUrl: "blob:result",
    bytes: 3,
    width: 250,
    height: 50,
    duration,
  };
}

function createExecutor(options: { failCommandIndex?: number } = {}) {
  const calls: string[] = [];
  let commandIndex = 0;

  const executor: ConversionExecutor = {
    async writeFile(path: string, _data: VirtualFileData) {
      calls.push(`write:${path}`);
    },
    async exec(command: FfmpegCommand) {
      calls.push(`exec:${command.join(" ")}`);

      if (options.failCommandIndex === commandIndex) {
        throw new Error("command failed");
      }

      commandIndex += 1;
    },
    async readFile(path: string) {
      calls.push(`read:${path}`);
      return new Uint8Array([1, 2, 3]);
    },
    async deleteFile(path: string) {
      calls.push(`delete:${path}`);
    },
  };

  return { calls, executor };
}

describe("runGifConversion", () => {
  it("writes input, executes plan, reads output, and creates the result", async () => {
    const job = createJob();
    const { calls, executor } = createExecutor();
    const artifactFactory: GifArtifactFactory = {
      createResult: vi.fn(async (_bytes, metadata) => createResult(metadata.duration)),
    };

    const result = await runGifConversion(job, executor, artifactFactory);

    expect(result.duration).toBe(2);
    expect(artifactFactory.createResult).toHaveBeenCalledWith(
      new Uint8Array([1, 2, 3]),
      {
        duration: 2,
        dimensions: { width: 250, height: 50 },
      }
    );
    expect(calls.slice(0, 4)).toEqual([
      "write:input.mp4",
      `exec:${job.plan.steps[0].command.join(" ")}`,
      `exec:${job.plan.steps[1].command.join(" ")}`,
      "read:output.gif",
    ]);
  });

  it("deletes all planned files after success", async () => {
    const job = createJob();
    const { calls, executor } = createExecutor();
    const artifactFactory: GifArtifactFactory = {
      createResult: vi.fn(async (_bytes, metadata) => createResult(metadata.duration)),
    };

    await runGifConversion(job, executor, artifactFactory);

    expect(calls.filter((call) => call.startsWith("delete:"))).toEqual([
      "delete:input.mp4",
      "delete:output_palette.png",
      "delete:output.gif",
    ]);
  });

  it("reports global progress milestones across the full conversion", async () => {
    const job = createJob();
    const { executor } = createExecutor();
    const progressUpdates: ConversionProgressUpdate[] = [];
    const artifactFactory: GifArtifactFactory = {
      createResult: vi.fn(async (_bytes, metadata) => createResult(metadata.duration)),
    };

    await runGifConversion(job, executor, artifactFactory, {
      onProgress: (update) => progressUpdates.push(update),
    });

    expect(progressUpdates).toEqual([
      { progress: 0, phase: "preparing" },
      { progress: 0.05, phase: "writing-input" },
      { progress: 0.25, phase: "palette" },
      { progress: 0.97, phase: "encode" },
      { progress: 0.99, phase: "reading-output" },
      { progress: 1, phase: "complete" },
    ]);
  });

  it("keeps global progress monotonic when ffmpeg step progress resets", async () => {
    vi.useFakeTimers();

    try {
      const job = createJob();
      const progressUpdates: ConversionProgressUpdate[] = [];
      const stepProgressValues = [1, 0, 0.25, 0.5, 0.5];
      const calls: string[] = [];
      let commandIndex = 0;

      const executor: ConversionExecutor = {
        async writeFile(path: string, _data: VirtualFileData) {
          calls.push(`write:${path}`);
        },
        async exec(command: FfmpegCommand) {
          calls.push(`exec:${command.join(" ")}`);
          await vi.advanceTimersByTimeAsync(commandIndex === 0 ? 100 : 300);
          commandIndex += 1;
        },
        async readFile(path: string) {
          calls.push(`read:${path}`);
          return new Uint8Array([1, 2, 3]);
        },
        async deleteFile(path: string) {
          calls.push(`delete:${path}`);
        },
      };
      const artifactFactory: GifArtifactFactory = {
        createResult: vi.fn(async (_bytes, metadata) => createResult(metadata.duration)),
      };

      await runGifConversion(job, executor, artifactFactory, {
        getStepProgress: () => stepProgressValues.shift() ?? 0,
        resetStepProgress: vi.fn(),
        onProgress: (update) => progressUpdates.push(update),
      });

      const progressValues = progressUpdates.map((update) => update.progress);
      const sortedProgressValues = [...progressValues].sort(
        (left, right) => left - right
      );

      expect(progressValues).toEqual(sortedProgressValues);
      expect(progressUpdates).toContainEqual({ progress: 0.25, phase: "palette" });
      expect(progressUpdates).toContainEqual({ progress: 0.43, phase: "encode" });
      expect(progressUpdates.at(-1)).toEqual({ progress: 1, phase: "complete" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("advances within a step when ffmpeg progress is silent", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    try {
      const job = createJob();
      const progressUpdates: ConversionProgressUpdate[] = [];
      const executor: ConversionExecutor = {
        async writeFile() {},
        async exec() {
          await vi.advanceTimersByTimeAsync(1_000);
        },
        async readFile() {
          return new Uint8Array([1, 2, 3]);
        },
        async deleteFile() {},
      };
      const artifactFactory: GifArtifactFactory = {
        createResult: vi.fn(async (_bytes, metadata) => createResult(metadata.duration)),
      };

      await runGifConversion(job, executor, artifactFactory, {
        getStepProgress: () => 0,
        onProgress: (update) => progressUpdates.push(update),
      });

      const encodeProgressUpdates = progressUpdates.filter(
        (update) => update.phase === "encode"
      );

      expect(encodeProgressUpdates.some((update) => update.progress > 0.25)).toBe(
        true
      );
      expect(encodeProgressUpdates.some((update) => update.progress < 0.97)).toBe(
        true
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("deletes planned files when palette generation fails", async () => {
    const job = createJob();
    const { calls, executor } = createExecutor({ failCommandIndex: 0 });
    const artifactFactory: GifArtifactFactory = {
      createResult: vi.fn(async (_bytes, metadata) => createResult(metadata.duration)),
    };

    await expect(runGifConversion(job, executor, artifactFactory)).rejects.toThrow(
      "command failed"
    );

    expect(calls).not.toContain("read:output.gif");
    expect(calls.filter((call) => call.startsWith("delete:"))).toEqual([
      "delete:input.mp4",
      "delete:output_palette.png",
      "delete:output.gif",
    ]);
  });

  it("deletes planned files when encoding fails", async () => {
    const job = createJob();
    const { calls, executor } = createExecutor({ failCommandIndex: 1 });
    const artifactFactory: GifArtifactFactory = {
      createResult: vi.fn(async (_bytes, metadata) => createResult(metadata.duration)),
    };

    await expect(runGifConversion(job, executor, artifactFactory)).rejects.toThrow(
      "command failed"
    );

    expect(calls).not.toContain("read:output.gif");
    expect(calls.filter((call) => call.startsWith("delete:"))).toEqual([
      "delete:input.mp4",
      "delete:output_palette.png",
      "delete:output.gif",
    ]);
  });
});
