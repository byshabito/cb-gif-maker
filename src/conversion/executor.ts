import type { FfmpegCommand } from "./types";

export type VirtualFileData = File | Blob | Uint8Array;

export type ConversionExecutor = {
  writeFile(path: string, data: VirtualFileData): Promise<void>;
  exec(command: FfmpegCommand): Promise<void>;
  readFile(path: string): Promise<Uint8Array>;
  deleteFile(path: string): Promise<void>;
};
