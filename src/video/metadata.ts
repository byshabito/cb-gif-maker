import type { InputMetadata } from "../types";

type MetadataVideoElement = {
  preload: string;
  muted: boolean;
  src: string;
  videoWidth: number;
  videoHeight: number;
  duration: number;
  onloadedmetadata: ((event: Event) => void) | null;
  onerror: ((event: Event | string) => void) | null;
  load?: () => void;
  pause?: () => void;
  removeAttribute?: (name: string) => void;
};

export type MetadataEnvironment = {
  createVideo: () => MetadataVideoElement;
  createObjectURL: (file: Blob) => string;
  revokeObjectURL: (url: string) => void;
};

const browserEnvironment: MetadataEnvironment = {
  createVideo: () => document.createElement("video"),
  createObjectURL: (file) => URL.createObjectURL(file),
  revokeObjectURL: (url) => URL.revokeObjectURL(url)
};

export async function readVideoMetadata(
  file: File,
  environment: MetadataEnvironment = browserEnvironment
): Promise<InputMetadata> {
  const video = environment.createVideo();
  const objectUrl = environment.createObjectURL(file);

  video.preload = "metadata";
  video.muted = true;

  return await new Promise<InputMetadata>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      environment.revokeObjectURL(objectUrl);
      video.pause?.();
      video.removeAttribute?.("src");
    };

    const resolveWithCleanup = (value: InputMetadata) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve(value);
    };

    const rejectWithCleanup = (error: Error) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      reject(error);
    };

    video.onloadedmetadata = () => {
      if (!video.videoWidth || !video.videoHeight) {
        rejectWithCleanup(
          new Error("Unsupported input for browser-side probing.")
        );
        return;
      }

      resolveWithCleanup({
        width: video.videoWidth,
        height: video.videoHeight,
        duration:
          Number.isFinite(video.duration) && video.duration > 0
            ? video.duration
            : undefined
      });
    };

    video.onerror = () => {
      rejectWithCleanup(new Error("Unsupported input for browser-side probing."));
    };

    video.src = objectUrl;
    video.load?.();
  });
}
