import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "@/App";
import { BrowserGifConverter } from "@/ffmpeg/client";
import { readVideoMetadata } from "@/video/metadata";

vi.mock("@/ffmpeg/client", () => ({
  BrowserGifConverter: vi.fn(),
}));

vi.mock("@/video/metadata", () => ({
  readVideoMetadata: vi.fn(),
}));

type Deferred<T> = {
  promise: Promise<T>;
  reject: (reason?: unknown) => void;
  resolve: (value: T | PromiseLike<T>) => void;
};

type MockConverterInstance = {
  convert: ReturnType<typeof vi.fn>;
  ensureLoaded: ReturnType<typeof vi.fn>;
  handlers: {
    onLog?: (line: string) => void;
    onProgress?: (value: number) => void;
  };
  setHandlers: ReturnType<typeof vi.fn>;
  terminate: ReturnType<typeof vi.fn>;
};

const mockedBrowserGifConverter = vi.mocked(BrowserGifConverter);
const mockedReadVideoMetadata = vi.mocked(readVideoMetadata);

let converterInstances: MockConverterInstance[] = [];
let objectUrlIndex = 0;

function createDeferred<T>(): Deferred<T> {
  let resolve!: Deferred<T>["resolve"];
  let reject!: Deferred<T>["reject"];

  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, reject, resolve };
}

function createMockConverterInstance(): MockConverterInstance {
  return {
    convert: vi.fn(),
    ensureLoaded: vi.fn(),
    handlers: {},
    setHandlers: vi.fn(),
    terminate: vi.fn(),
  };
}

function getConverterInstance() {
  const instance = converterInstances[0];

  if (!instance) {
    throw new Error("Converter instance not found.");
  }

  return instance;
}

function getFileInput() {
  return screen.getByLabelText("Choose video (.mp4)") as HTMLInputElement;
}

function getConvertButton() {
  return screen.getByRole("button", {
    name: /convert to gif/i,
  }) as HTMLButtonElement;
}

async function selectFile(file: File) {
  const input = getFileInput();

  Object.defineProperty(input, "files", {
    configurable: true,
    value: [file],
  });

  fireEvent.change(input);

  await waitFor(() => {
    expect(mockedReadVideoMetadata).toHaveBeenCalledWith(file);
  });
}

describe("App", () => {
  beforeEach(() => {
    objectUrlIndex = 0;
    converterInstances = [];
    mockedBrowserGifConverter.mockReset();
    mockedReadVideoMetadata.mockReset();
    mockedBrowserGifConverter.mockImplementation(function MockBrowserGifConverter() {
      const instance = createMockConverterInstance();
      instance.setHandlers.mockImplementation((handlers) => {
        instance.handlers = handlers;
      });
      converterInstances.push(instance);
      return instance as never;
    });

    Object.defineProperty(globalThis.URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => `blob:mock-${++objectUrlIndex}`),
    });

    Object.defineProperty(globalThis.URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });

    Object.defineProperty(HTMLMediaElement.prototype, "pause", {
      configurable: true,
      value: vi.fn(),
    });

    Object.defineProperty(HTMLMediaElement.prototype, "load", {
      configurable: true,
      value: vi.fn(),
    });

    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: vi.fn(() => Promise.resolve()),
    });

    class ResizeObserverMock {
      disconnect() {}
      observe() {}
      unobserve() {}
    }

    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      value: ResizeObserverMock,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the preset shell with conversion disabled by default", () => {
    render(<App />);

    expect(screen.getByText(/Convert your clips into GIFs\./i)).toBeTruthy();
    expect(getConvertButton().disabled).toBe(true);
    expect(screen.getByText("Video preview")).toBeTruthy();
  });

  it("loads metadata for a valid mp4 and enables conversion", async () => {
    render(<App />);
    mockedReadVideoMetadata.mockResolvedValueOnce({
      duration: 2,
      height: 100,
      width: 500,
    });
    const converter = getConverterInstance();
    converter.ensureLoaded.mockResolvedValue(undefined);
    const file = new File(["video"], "sample.mp4", { type: "video/mp4" });

    await selectFile(file);

    expect((await screen.findAllByText("sample.mp4")).length).toBeGreaterThan(0);
    expect(screen.getByText("Scale to 250px wide")).toBeTruthy();
    expect(getConvertButton().disabled).toBe(false);
  });

  it("shows a validation error for unsupported files", async () => {
    render(<App />);
    const input = getFileInput();
    const file = new File(["text"], "notes.txt", { type: "text/plain" });

    Object.defineProperty(input, "files", {
      configurable: true,
      value: [file],
    });

    fireEvent.change(input);

    expect(
      await screen.findByText("Unsupported file type. Use an MP4 video.")
    ).toBeTruthy();
    expect(getConvertButton().disabled).toBe(true);
  });

  it("shows Preparing while ffmpeg is still loading and reports progress", async () => {
    render(<App />);
    mockedReadVideoMetadata.mockResolvedValueOnce({
      duration: 2,
      height: 100,
      width: 500,
    });
    const ensureLoadedDeferred = createDeferred<void>();
    const convertDeferred = createDeferred<{
      blob: Blob;
      bytes: number;
      duration?: number;
      height: number;
      objectUrl: string;
      width: number;
    }>();
    const converter = getConverterInstance();
    converter.ensureLoaded.mockReturnValue(ensureLoadedDeferred.promise);
    converter.convert.mockReturnValue(convertDeferred.promise);
    const file = new File(["video"], "sample.mp4", { type: "video/mp4" });

    await selectFile(file);
    fireEvent.click(getConvertButton());

    expect(
      await screen.findByRole("button", { name: /preparing/i })
    ).toBeTruthy();

    converter.handlers.onProgress?.(0.42);
    expect(await screen.findByText("42% complete")).toBeTruthy();

    ensureLoadedDeferred.resolve();
    await waitFor(() => {
      expect(converter.convert).toHaveBeenCalled();
    });

    convertDeferred.reject(new Error("stop"));
    await waitFor(() => {
      expect(screen.getByText("Conversion failed: stop")).toBeTruthy();
    });
  });

  it("cancels an in-flight conversion and resets to ready state", async () => {
    render(<App />);
    mockedReadVideoMetadata.mockResolvedValueOnce({
      duration: 2,
      height: 100,
      width: 500,
    });
    const ensureLoadedDeferred = createDeferred<void>();
    const converter = getConverterInstance();
    converter.ensureLoaded.mockReturnValue(ensureLoadedDeferred.promise);
    const file = new File(["video"], "sample.mp4", { type: "video/mp4" });

    await selectFile(file);
    fireEvent.click(getConvertButton());

    const cancelButton = await screen.findByRole("button", { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(converter.terminate).toHaveBeenCalled();
    await waitFor(() => {
      expect(getConvertButton().disabled).toBe(false);
    });
    expect(screen.queryByRole("button", { name: /cancel/i })).toBeNull();

    ensureLoadedDeferred.resolve();
  });

  it("renders the generated gif preview and download action after success", async () => {
    render(<App />);
    mockedReadVideoMetadata.mockResolvedValueOnce({
      duration: 2,
      height: 100,
      width: 500,
    });
    const converter = getConverterInstance();
    converter.ensureLoaded.mockResolvedValue(undefined);
    converter.convert.mockResolvedValue({
      blob: new Blob(["gif"], { type: "image/gif" }),
      bytes: 2048,
      duration: 1.5,
      height: 80,
      objectUrl: "blob:result-gif",
      width: 250,
    });
    const file = new File(["video"], "sample.mp4", { type: "video/mp4" });

    await selectFile(file);
    fireEvent.click(getConvertButton());

    const downloadLink = await screen.findByRole("link", {
      name: /download gif/i,
    });

    expect(downloadLink.getAttribute("download")).toBe("sample.gif");
    expect(screen.getByAltText("Generated GIF preview").getAttribute("src")).toBe(
      "blob:result-gif"
    );
    expect(screen.getByText("2.00 KB")).toBeTruthy();
  });
});
