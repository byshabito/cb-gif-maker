import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { BrowserGifArtifactFactory } from "../conversion/artifacts";
import type { ConversionExecutor, VirtualFileData } from "../conversion/executor";
import { createGifConversionPlan } from "../conversion/pipeline";
import { runGifConversion } from "../conversion/run";
import type {
  ConversionJob,
  ConversionResult,
  FfmpegAssetPaths
} from "../types";
import type { FfmpegCommand } from "../conversion/types";

type ProgressHandlers = {
  onLog?: (line: string) => void;
  onProgress?: (value: number) => void;
};

type ResolvedFfmpegLoadPaths = {
  coreURL: string;
  wasmURL: string;
};

class FfmpegConversionExecutor implements ConversionExecutor {
  constructor(private readonly ffmpeg: FFmpeg) {}

  async writeFile(path: string, data: VirtualFileData): Promise<void> {
    await this.ffmpeg.writeFile(
      path,
      data instanceof Uint8Array ? data : await fetchFile(data)
    );
  }

  async exec(command: FfmpegCommand): Promise<void> {
    const exitCode = await this.ffmpeg.exec([...command]);

    if (exitCode !== 0) {
      throw new Error(`ffmpeg exited with code ${exitCode}.`);
    }
  }

  async readFile(path: string): Promise<Uint8Array> {
    const data = await this.ffmpeg.readFile(path, "binary");

    return data instanceof Uint8Array
      ? data
      : new TextEncoder().encode(data);
  }

  async deleteFile(path: string): Promise<void> {
    await this.ffmpeg.deleteFile(path);
  }
}

export class BrowserGifConverter {
  private readonly ffmpeg = new FFmpeg();
  private readonly artifactFactory = new BrowserGifArtifactFactory();
  private readonly executor = new FfmpegConversionExecutor(this.ffmpeg);
  private loadPromise: Promise<void> | null = null;
  private loaded = false;
  private handlers: ProgressHandlers = {};
  private resolvedPaths: ResolvedFfmpegLoadPaths | null = null;

  constructor() {
    this.ffmpeg.on("log", ({ message }) => {
      this.handlers.onLog?.(message);
    });

    this.ffmpeg.on("progress", ({ progress }) => {
      this.handlers.onProgress?.(Math.max(0, Math.min(progress, 1)));
    });
  }

  setHandlers(handlers: ProgressHandlers): void {
    this.handlers = handlers;
  }

  async ensureLoaded(paths: FfmpegAssetPaths): Promise<void> {
    if (this.loaded) {
      return;
    }

    if (!this.loadPromise) {
      const resolveLoadPaths = async (): Promise<ResolvedFfmpegLoadPaths> => {
        if (this.resolvedPaths) {
          return this.resolvedPaths;
        }

        this.resolvedPaths = {
          coreURL: await toBlobURL(paths.coreURL, "text/javascript"),
          wasmURL: await toBlobURL(paths.wasmURL, "application/wasm")
        };

        return this.resolvedPaths;
      };

      this.loadPromise = this.ffmpeg
        .load(await resolveLoadPaths())
        .then(() => {
          this.loaded = true;
        })
        .catch((error: unknown) => {
          this.loadPromise = null;
          throw error;
        });
    }

    await this.loadPromise;
  }

  async reload(paths: FfmpegAssetPaths): Promise<void> {
    this.terminate();
    await this.ensureLoaded(paths);
  }

  async convert(job: ConversionJob): Promise<ConversionResult> {
    this.handlers.onProgress?.(0);

    const request = {
      file: job.file,
      metadata: job.metadata,
      trimRange: job.trimRange,
      outputName: job.outputName,
    };
    const plan = createGifConversionPlan(request);
    const result = await runGifConversion(
      { request, plan },
      this.executor,
      this.artifactFactory
    );

    this.handlers.onProgress?.(1);

    return result;
  }

  terminate(): void {
    this.ffmpeg.terminate();
    if (this.resolvedPaths) {
      URL.revokeObjectURL(this.resolvedPaths.coreURL);
      URL.revokeObjectURL(this.resolvedPaths.wasmURL);
      this.resolvedPaths = null;
    }
    this.loaded = false;
    this.loadPromise = null;
  }
}
