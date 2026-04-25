import type { ConversionResult } from "@/types";
import type { OutputDimensions } from "./types";

export type GifArtifactMetadata = {
  duration?: number;
  dimensions: OutputDimensions;
};

export type GifArtifactFactory = {
  createResult(
    bytes: Uint8Array,
    metadata: GifArtifactMetadata
  ): Promise<ConversionResult>;
};

export class BrowserGifArtifactFactory implements GifArtifactFactory {
  async createResult(
    bytes: Uint8Array,
    metadata: GifArtifactMetadata
  ): Promise<ConversionResult> {
    const blobBytes = new Uint8Array(bytes.byteLength);
    blobBytes.set(bytes);

    const blob = new Blob([blobBytes], { type: "image/gif" });
    const objectUrl = URL.createObjectURL(blob);

    return {
      blob,
      objectUrl,
      bytes: blob.size,
      width: metadata.dimensions.width,
      height: metadata.dimensions.height,
      duration: metadata.duration,
    };
  }
}
