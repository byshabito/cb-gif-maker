import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import {
  buildGifPipeline,
  getConversionFiles
} from "../conversion/pipeline";
import type {
  ConversionJob,
  ConversionResult,
  FfmpegAssetPaths
} from "../types";

type ProgressHandlers = {
  onLog?: (line: string) => void;
  onProgress?: (value: number) => void;
};

type ResolvedFfmpegLoadPaths = {
  coreURL: string;
  wasmURL: string;
};

export class BrowserGifConverter {
  private readonly ffmpeg = new FFmpeg();
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
    const files = getConversionFiles(job.file.name);
    const startTime = performance.now();

    try {
      this.handlers.onProgress?.(0);
      await this.ffmpeg.writeFile(files.input, await fetchFile(job.file));

      for (const command of buildGifPipeline(files.input, job.scaleFilter)) {
        const exitCode = await this.ffmpeg.exec(command);

        if (exitCode !== 0) {
          throw new Error(`ffmpeg exited with code ${exitCode}.`);
        }
      }

      const data = await this.ffmpeg.readFile(files.output, "binary");
      const bytes =
        data instanceof Uint8Array
          ? data
          : new TextEncoder().encode(data);
      const blobBytes = new Uint8Array(bytes.byteLength);
      blobBytes.set(bytes);
      const blob = new Blob([blobBytes], { type: "image/gif" });
      const objectUrl = URL.createObjectURL(blob);
      const imageBitmap = await createImageBitmap(blob);

      this.handlers.onProgress?.(1);

      try {
        return {
          blob,
          objectUrl,
          bytes: blob.size,
          width: imageBitmap.width,
          height: imageBitmap.height,
          duration: job.metadata.duration
        };
      } finally {
        imageBitmap.close();
      }
    } finally {
      await Promise.allSettled(
        [files.input, files.clean, files.reduced, files.palette, files.output]
          .map((path) => this.ffmpeg.deleteFile(path))
      );
    }
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
