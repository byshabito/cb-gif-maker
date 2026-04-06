import { readVideoMetadata, type MetadataEnvironment } from "./metadata";

function createFakeFile(): File {
  return new File(["video"], "sample.mp4", { type: "video/mp4" });
}

describe("readVideoMetadata", () => {
  it("rejects when browser-side probing fails", async () => {
    let revokedUrl = "";

    const environment: MetadataEnvironment = {
      createObjectURL: () => "blob:sample",
      revokeObjectURL: (url) => {
        revokedUrl = url;
      },
      createVideo: () => {
        const video: ReturnType<MetadataEnvironment["createVideo"]> = {
          preload: "",
          muted: false,
          src: "",
          videoWidth: 0,
          videoHeight: 0,
          duration: 0,
          onloadedmetadata: null,
          onerror: null,
          load() {
            video.onerror?.(new Event("error"));
          },
          pause() {},
          removeAttribute() {}
        };

        return video;
      }
    };

    await expect(readVideoMetadata(createFakeFile(), environment)).rejects.toThrow(
      "Unsupported input for browser-side probing."
    );
    expect(revokedUrl).toBe("blob:sample");
  });
});
