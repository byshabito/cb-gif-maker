import {
  AlertCircle,
  Download,
  Film,
  Scissors,
  Sparkles,
  Upload,
  WandSparkles,
  X,
} from "lucide-react";
import { ProgressStatus } from "@/components/progress-status";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { useGifMaker } from "@/hooks/use-gif-maker";
import {
  ACCEPTED_VIDEO_TYPES,
  formatBytes,
  formatDuration,
  formatTrimTimestamp,
  getEngineLabel,
  hasKnownDuration,
} from "@/lib/gif-maker";
import { Field, FieldDescription, FieldLabel } from "./ui/field";

export function GifMakerShell() {
  const {
    accessibleConvertButtonLabel,
    canConvert,
    cancelConversion,
    clearResult,
    convertButtonLabel,
    enforcePreviewBounds,
    previewRef,
    progressStatusMessage,
    resumePreviewPlayback,
    runConversion,
    seekPreviewToLoopStart,
    selectFile,
    state,
    trimDuration,
    updateTrimRange,
  } = useGifMaker();
  const showProgress =
    state.result === null &&
    (state.isBusy ||
      state.progress !== null ||
      state.conversionState === "loading-engine" ||
      state.conversionState === "converting" ||
      state.engineState === "loading");
  const fileSummary = state.file
    ? formatBytes(state.file.size)
    : "No file selected";
  const dimensionSummary = state.metadata
    ? `${state.metadata.width} × ${state.metadata.height}`
    : "Dimensions pending";
  const durationSummary = state.metadata
    ? formatDuration(state.metadata.duration)
    : "Duration pending";
  const outputRule = state.metadata
    ? state.metadata.width * 80 > state.metadata.height * 250
      ? "Scale to 250px wide"
      : "Scale to 80px tall"
    : "Output scale auto-detects after probe";
  const downloadName = state.file
    ? state.file.name.replace(/\.[^/.]+$/, "") + ".gif"
    : "output.gif";

  return (
    <main className="flex h-dvh items-center justify-center overflow-hidden p-4">
      <div>
        <h1>GIF It!</h1>

        <Card className="flex h-full max-h-225 w-full max-w-7xl flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="space-y-1">
                  <CardTitle className="text-xl">
                    Convert your clips into CB-ready GIFs.
                  </CardTitle>
                  <CardDescription>
                    Upload, trim, convert, and download without leaving the
                    page.
                  </CardDescription>
                </div>
              </div>
              <div>
                <Badge variant="outline">How to use</Badge>
                <Badge variant="outline">How to upload to CB</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[18rem_minmax(0,1fr)_16rem] lg:grid-rows-[auto_minmax(0,1fr)_auto]">
            <Field className="lg:col-start-1 lg:row-start-1 lg:row-span-3">
              <FieldLabel htmlFor="video">Select your video clip</FieldLabel>
              <Input
                id="video"
                accept={ACCEPTED_VIDEO_TYPES}
                aria-label="Choose video"
                disabled={state.isBusy}
                onChange={(event) => {
                  void selectFile(event.currentTarget.files?.[0] ?? null);
                  //event.currentTarget.value = "";
                }}
                type="file"
              />
              <FieldDescription className="flex flex-col justify-between h-full">
                {state.file ? (
                  <div>
                    {fileSummary} / {dimensionSummary} / {durationSummary}
                  </div>
                ) : (
                  <div>Supported: {ACCEPTED_VIDEO_TYPES}</div>
                )}
                {state.errorMessage ? (
                  <Alert variant="destructive">
                    <AlertCircle />
                    <AlertTitle>Conversion blocked</AlertTitle>
                    <AlertDescription>{state.errorMessage}</AlertDescription>
                  </Alert>
                ) : null}
                <ProgressStatus
                  message={progressStatusMessage}
                  progress={state.progress}
                  show={showProgress && progressStatusMessage !== ""}
                />
                <div>
                  <Button
                    aria-label={accessibleConvertButtonLabel}
                    className="w-full"
                    disabled={!canConvert}
                    onClick={() => {
                      void runConversion();
                    }}
                    type="button"
                  >
                    <WandSparkles />
                    {convertButtonLabel}
                  </Button>
                  <Button
                    className="w-full"
                    hidden={!state.isBusy}
                    onClick={cancelConversion}
                    type="button"
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </div>
              </FieldDescription>
            </Field>

            <section className="flex min-h-0 flex-col gap-3 lg:col-start-2 lg:row-span-3 lg:col-span-2 lg:row-start-1">
              <div className="flex min-h-0 flex-1 overflow-hidden border">
                {state.inputPreviewUrl ? (
                  <video
                    className="h-full w-full object-contain"
                    muted
                    onClick={() => {
                      if (!previewRef.current) return;
                      if (previewRef.current.paused) {
                        previewRef.current.play();
                      } else {
                        previewRef.current.pause();
                      }
                    }}
                    onEnded={() => {
                      if (!state.trimRange) {
                        return;
                      }

                      seekPreviewToLoopStart(state.trimRange);
                      resumePreviewPlayback();
                    }}
                    onPlay={() => {
                      enforcePreviewBounds({ restartPlayback: false });
                    }}
                    onSeeking={() => {
                      if (previewRef.current?.paused) {
                        return;
                      }

                      enforcePreviewBounds({ restartPlayback: true });
                    }}
                    onTimeUpdate={() => {
                      if (previewRef.current?.paused) {
                        return;
                      }

                      enforcePreviewBounds({ restartPlayback: true });
                    }}
                    playsInline
                    preload="metadata"
                    ref={previewRef}
                    src={state.inputPreviewUrl}
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                    <Film className="size-8" />
                    <div className="space-y-1">
                      <p className="font-heading text-sm font-medium">
                        Video preview
                      </p>
                      <p className="max-w-xs text-xs">Select a clip.</p>
                    </div>
                  </div>
                )}
              </div>

              {hasKnownDuration(state.metadata) && state.trimRange ? (
                <>
                  <Slider
                    aria-label="Trim range"
                    disabled={state.isBusy}
                    max={state.metadata.duration}
                    min={0}
                    onValueChange={updateTrimRange}
                    step={0.1}
                    value={[state.trimRange.startTime, state.trimRange.endTime]}
                  />
                  <div className="flex flex-row justify-between w-full">
                    <Badge variant="outline">
                      {state.trimRange
                        ? formatTrimTimestamp(state.trimRange.startTime)
                        : "--"}
                    </Badge>
                    <Badge variant="outline">
                      {state.trimRange
                        ? formatTrimTimestamp(trimDuration)
                        : "--"}
                    </Badge>
                    <Badge variant="outline">
                      {state.trimRange
                        ? formatTrimTimestamp(state.trimRange.endTime)
                        : "--"}
                    </Badge>
                  </div>
                </>
              ) : (
                <></>
              )}
            </section>
          </CardContent>
        </Card>

        <Drawer
          direction="bottom"
          modal
          onOpenChange={(open) => {
            if (!open && state.result) {
              clearResult();
            }
          }}
          open={Boolean(state.result)}
        >
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Finished GIF</DrawerTitle>
              <DrawerDescription>
                Review the result, download it, or discard it and keep editing.
              </DrawerDescription>
            </DrawerHeader>
            <div className="px-4 pb-2">
              {state.result ? (
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_18rem]">
                  <div className="overflow-hidden border">
                    <img
                      alt="Generated GIF preview"
                      className="aspect-video w-full object-contain"
                      src={state.result.objectUrl}
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="border p-3 text-xs text-muted-foreground">
                      <p>
                        Size:{" "}
                        <span className="text-foreground">
                          {formatBytes(state.result.bytes)}
                        </span>
                      </p>
                      <p>
                        Frame:{" "}
                        <span className="text-foreground">
                          {state.result.width} × {state.result.height}
                        </span>
                      </p>
                      <p>
                        Duration:{" "}
                        <span className="text-foreground">
                          {formatDuration(state.result.duration)}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
            <DrawerFooter className="sm:flex-row">
              {state.result ? (
                <Button asChild className="sm:flex-1">
                  <a download={downloadName} href={state.result.objectUrl}>
                    <Download />
                    Download GIF
                  </a>
                </Button>
              ) : null}
              <DrawerClose asChild>
                <Button onClick={clearResult} type="button" variant="outline">
                  Discard
                </Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>
    </main>
  );
}
