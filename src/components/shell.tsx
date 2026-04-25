import {
  AlertCircle,
  Download,
  Film,
  Scissors,
  Sparkles,
  SlidersHorizontal,
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
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { CONVERSION_PRESETS, getScaleSummary } from "@/conversion/pipeline";
import { useGifIt } from "@/hooks/use-gif-it";
import {
  ACCEPTED_VIDEO_TYPES,
  formatBytes,
  formatDuration,
  formatTrimTimestamp,
  getEngineLabel,
  getPresetTradeoffSummary,
  hasKnownDuration,
} from "@/lib/gif-it";
import type { ConversionPresetId } from "@/types";
import { Field, FieldLabel } from "./ui/field";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

export function Shell() {
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
    selectedPreset,
    selectFile,
    state,
    trimDuration,
    updatePreset,
    updateTrimRange,
  } = useGifIt();
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
    ? getScaleSummary(state.metadata)
    : "Output scale auto-detects after probe";
  const downloadName = state.file
    ? state.file.name.replace(/\.[^/.]+$/, "") + ".gif"
    : "output.gif";

  return (
    <main className="flex h-dvh items-center justify-center overflow-hidden p-4">
      <div>
        <h1>GIF It!</h1>
        <h2>Convert your clips to CB-ready GIFs locally.</h2>
        {/* 
        <Drawer direction="right">
          <DrawerTrigger asChild>
            <Button variant="secondary">How do I upload a clip?</Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>How do I upload a clip?</DrawerTitle>
            </DrawerHeader>
            <div className="no-scrollbar overflow-y-auto px-4 h-full">
              Just do it
            </div>
            <DrawerClose asChild>
              <Button variant="ghost">Close</Button>
            </DrawerClose>
          </DrawerContent>
        </Drawer>
        */}
        <Card className="flex h-full max-h-225 w-full max-w-7xl flex-col">
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
              <div className="flex h-full flex-col justify-between text-left text-xs/relaxed font-normal text-muted-foreground">
                <div className="mb-2">
                  {state.file
                    ? `${fileSummary} / ${dimensionSummary} / ${durationSummary} / ${outputRule}`
                    : `Supported: ${ACCEPTED_VIDEO_TYPES}`}
                </div>
                <PresetSelect
                  disabled={state.isBusy}
                  onPresetChange={updatePreset}
                  selectedPresetId={selectedPreset.id}
                />
                {state.errorMessage ? (
                  <Alert variant="destructive">
                    <AlertCircle />
                    <AlertTitle>Conversion blocked</AlertTitle>
                    <AlertDescription>{state.errorMessage}</AlertDescription>
                  </Alert>
                ) : null}

                <div>
                  <ProgressStatus
                    message={progressStatusMessage}
                    progress={state.progress}
                    show={showProgress && progressStatusMessage !== ""}
                  />
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
              </div>
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
                    <Badge variant="ghost">
                      {state.trimRange
                        ? formatTrimTimestamp(state.trimRange.startTime)
                        : "--"}
                    </Badge>
                    <Badge variant="outline">
                      {state.trimRange
                        ? formatTrimTimestamp(trimDuration)
                        : "--"}
                    </Badge>
                    <Badge variant="ghost">
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

        <Dialog
          onOpenChange={(open) => {
            if (!open && state.result) {
              clearResult();
            }
          }}
          open={Boolean(state.result)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Your GIF is ready!</DialogTitle>

              {state.result ? (
                <DialogDescription>
                  {formatBytes(state.result.bytes)} / {state.result.width} ×{" "}
                  {state.result.height} /{" "}
                  {formatDuration(state.result.duration)}
                </DialogDescription>
              ) : null}
            </DialogHeader>
            {state.result ? (
              <img
                alt="Generated GIF preview"
                className="aspect-video w-full object-contain"
                src={state.result.objectUrl}
              />
            ) : null}
            <DialogFooter>
              {state.result ? (
                <Button asChild className="sm:flex-1">
                  <a download={downloadName} href={state.result.objectUrl}>
                    <Download />
                    Download GIF
                  </a>
                </Button>
              ) : null}

              <DialogClose asChild>
                <Button onClick={clearResult} type="button" variant="outline">
                  Discard
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}

function PresetSelect({
  disabled,
  selectedPresetId,
  onPresetChange,
}: {
  disabled: boolean;
  selectedPresetId: ConversionPresetId;
  onPresetChange: (presetId: ConversionPresetId) => void;
}) {
  const presetIds: ConversionPresetId[] = ["fast", "quality"];

  return (
    <div className="mb-3 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        <SlidersHorizontal className="size-3.5" />
        Preset
      </div>
      <Select
        disabled={disabled}
        onValueChange={(value) => {
          onPresetChange(value as ConversionPresetId);
        }}
        value={selectedPresetId}
      >
        <SelectTrigger aria-label="Conversion preset" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {presetIds.map((presetId) => (
            <SelectItem key={presetId} value={presetId}>
              {CONVERSION_PRESETS[presetId].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        {getPresetTradeoffSummary(selectedPresetId)}
      </p>
    </div>
  );
}
