import { initializeApp } from "./app";
import { BrowserGifConverter } from "./ffmpeg/client";
import { readVideoMetadata } from "./video/metadata";

vi.mock("./ffmpeg/client", () => ({
  BrowserGifConverter: vi.fn()
}));

vi.mock("./video/metadata", () => ({
  readVideoMetadata: vi.fn()
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

type MockConverterInstance = {
  setHandlers: ReturnType<typeof vi.fn>;
  ensureLoaded: ReturnType<typeof vi.fn>;
  convert: ReturnType<typeof vi.fn>;
  terminate: ReturnType<typeof vi.fn>;
  handlers: {
    onLog?: (line: string) => void;
    onProgress?: (value: number) => void;
  };
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

  return { promise, resolve, reject };
}

function createMockConverterInstance(): MockConverterInstance {
  return {
    setHandlers: vi.fn(),
    ensureLoaded: vi.fn(),
    convert: vi.fn(),
    terminate: vi.fn(),
    handlers: {}
  };
}

function mountApp(): HTMLDivElement {
  document.body.innerHTML = '<div id="app"></div>';
  const root = document.querySelector<HTMLDivElement>("#app");

  if (!root) {
    throw new Error("App root not found in test.");
  }

  initializeApp(root);
  return root;
}

function getConvertButtonLabel(root: HTMLDivElement): HTMLElement {
  const label = root.querySelector<HTMLElement>("#convert-button-label");

  if (!label) {
    throw new Error("Convert button label not found.");
  }

  return label;
}

function getConvertButton(root: HTMLDivElement): HTMLButtonElement {
  const button = root.querySelector<HTMLButtonElement>("#convert-button");

  if (!button) {
    throw new Error("Convert button not found.");
  }

  return button;
}

function getCancelButton(root: HTMLDivElement): HTMLButtonElement {
  const button = root.querySelector<HTMLButtonElement>("#cancel-button");

  if (!button) {
    throw new Error("Cancel button not found.");
  }

  return button;
}

function getFileInput(root: HTMLDivElement): HTMLInputElement {
  const input = root.querySelector<HTMLInputElement>("#file-input");

  if (!input) {
    throw new Error("File input not found.");
  }

  return input;
}

function getConverterInstance(): MockConverterInstance {
  const instance = converterInstances[0];

  if (!instance) {
    throw new Error("Converter instance was not created.");
  }

  return instance;
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function selectValidFile(root: HTMLDivElement): Promise<File> {
  const fileInput = getFileInput(root);
  const file = new File(["video"], "sample.mp4", { type: "video/mp4" });

  mockedReadVideoMetadata.mockResolvedValueOnce({
    width: 500,
    height: 100,
    duration: 2
  });

  Object.defineProperty(fileInput, "files", {
    configurable: true,
    value: [file]
  });

  fileInput.dispatchEvent(new Event("change"));
  await flushPromises();

  return file;
}

async function startPendingConversion() {
  const root = mountApp();
  const converter = getConverterInstance();
  const ensureLoadedDeferred = createDeferred<void>();
  const convertDeferred = createDeferred<{
    blob: Blob;
    objectUrl: string;
    bytes: number;
    width: number;
    height: number;
    duration?: number;
  }>();
  const convertButton = getConvertButton(root);

  converter.ensureLoaded.mockReturnValue(ensureLoadedDeferred.promise);
  converter.convert.mockReturnValue(convertDeferred.promise);

  await selectValidFile(root);
  convertButton.click();

  return {
    root,
    converter,
    ensureLoadedDeferred,
    convertDeferred
  };
}

describe("initializeApp", () => {
  beforeEach(() => {
    converterInstances = [];
    objectUrlIndex = 0;
    vi.useFakeTimers();
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
      value: vi.fn(() => `blob:mock-${++objectUrlIndex}`)
    });

    Object.defineProperty(globalThis.URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn()
    });

    Object.defineProperty(HTMLMediaElement.prototype, "pause", {
      configurable: true,
      value: vi.fn()
    });

    Object.defineProperty(HTMLMediaElement.prototype, "load", {
      configurable: true,
      value: vi.fn()
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("renders reserve labels so the convert button width stays stable", () => {
    const root = mountApp();
    const convertButton = getConvertButton(root);
    const visibleLabel = getConvertButtonLabel(root);
    const reserveLabels = Array.from(
      root.querySelectorAll<HTMLElement>(".convert-button__label--reserve")
    );
    const accessibleLabel = root.querySelector<HTMLElement>("#convert-button-a11y-label");

    expect(convertButton.classList.contains("convert-button")).toBe(true);
    expect(visibleLabel.textContent).toBe("Convert to GIF");
    expect(reserveLabels).toHaveLength(2);
    expect(reserveLabels.map((element) => element.textContent)).toEqual([
      "Convert to GIF",
      "Converting..."
    ]);
    expect(accessibleLabel?.textContent).toBe("Convert to GIF");
  });

  it("shows Preparing... while the ffmpeg engine is loading", async () => {
    const { root, converter } = await startPendingConversion();
    const visibleLabel = getConvertButtonLabel(root);

    expect(converter.ensureLoaded).toHaveBeenCalledOnce();
    expect(converter.convert).not.toHaveBeenCalled();
    expect(visibleLabel.textContent).toBe("Preparing...");

    vi.advanceTimersByTime(1600);
    expect(visibleLabel.textContent).toBe("Preparing...");
  });

  it("animates the label only during conversion and loops through all frames", async () => {
    const { root, converter, ensureLoadedDeferred } = await startPendingConversion();
    const visibleLabel = getConvertButtonLabel(root);

    ensureLoadedDeferred.resolve();
    await flushPromises();

    expect(converter.convert).toHaveBeenCalledOnce();
    expect(visibleLabel.textContent).toBe("Converting");

    vi.advanceTimersByTime(400);
    expect(visibleLabel.textContent).toBe("Converting.");

    vi.advanceTimersByTime(400);
    expect(visibleLabel.textContent).toBe("Converting..");

    vi.advanceTimersByTime(400);
    expect(visibleLabel.textContent).toBe("Converting...");

    vi.advanceTimersByTime(400);
    expect(visibleLabel.textContent).toBe("Converting");
  });

  it("stops the animation and restores the idle label after a successful conversion", async () => {
    const { root, ensureLoadedDeferred, convertDeferred } = await startPendingConversion();
    const visibleLabel = getConvertButtonLabel(root);

    ensureLoadedDeferred.resolve();
    await flushPromises();

    convertDeferred.resolve({
      blob: new Blob(["gif"], { type: "image/gif" }),
      objectUrl: "blob:result",
      bytes: 3,
      width: 120,
      height: 80,
      duration: 2
    });
    await flushPromises();

    expect(visibleLabel.textContent).toBe("Convert to GIF");

    vi.advanceTimersByTime(800);
    expect(visibleLabel.textContent).toBe("Convert to GIF");
  });

  it("stops the animation and restores the idle label after a failed conversion", async () => {
    const { root, ensureLoadedDeferred, convertDeferred } = await startPendingConversion();
    const visibleLabel = getConvertButtonLabel(root);

    ensureLoadedDeferred.resolve();
    await flushPromises();

    convertDeferred.reject(new Error("boom"));
    await flushPromises();

    expect(visibleLabel.textContent).toBe("Convert to GIF");

    vi.advanceTimersByTime(800);
    expect(visibleLabel.textContent).toBe("Convert to GIF");
  });

  it("stops the animation immediately when conversion is cancelled", async () => {
    const { root, converter, ensureLoadedDeferred } = await startPendingConversion();
    const visibleLabel = getConvertButtonLabel(root);
    const cancelButton = getCancelButton(root);

    ensureLoadedDeferred.resolve();
    await flushPromises();

    expect(visibleLabel.textContent).toBe("Converting");
    expect(cancelButton.hidden).toBe(false);

    cancelButton.click();
    await flushPromises();

    expect(converter.terminate).toHaveBeenCalledOnce();
    expect(visibleLabel.textContent).toBe("Convert to GIF");

    vi.advanceTimersByTime(800);
    expect(visibleLabel.textContent).toBe("Convert to GIF");
  });
});
