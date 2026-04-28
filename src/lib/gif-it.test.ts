import { isSupportedVideo } from "./gif-it";

function createFile(name: string, type = "") {
  return new File(["video"], name, { type });
}

describe("video format helpers", () => {
  it("accepts supported video extensions", () => {
    expect(isSupportedVideo(createFile("clip.mp4"))).toBe(true);
    expect(isSupportedVideo(createFile("clip.mkv"))).toBe(true);
    expect(isSupportedVideo(createFile("clip.mov"))).toBe(true);
  });

  it("accepts uppercase supported video extensions", () => {
    expect(isSupportedVideo(createFile("clip.MP4"))).toBe(true);
    expect(isSupportedVideo(createFile("clip.MKV"))).toBe(true);
    expect(isSupportedVideo(createFile("clip.MOV"))).toBe(true);
  });

  it("accepts supported video MIME types", () => {
    expect(isSupportedVideo(createFile("clip", "video/mp4"))).toBe(true);
    expect(isSupportedVideo(createFile("clip", "video/x-matroska"))).toBe(true);
    expect(isSupportedVideo(createFile("clip", "video/quicktime"))).toBe(true);
  });

  it("rejects unsupported extensions and MIME types", () => {
    expect(isSupportedVideo(createFile("clip.avi"))).toBe(false);
    expect(isSupportedVideo(createFile("clip.webm"))).toBe(false);
    expect(isSupportedVideo(createFile("notes.txt", "text/plain"))).toBe(false);
    expect(isSupportedVideo(createFile("clip", "video/webm"))).toBe(false);
  });
});
