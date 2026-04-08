import type { ReactNode } from "react";
import { AlertCircle, Cpu, Gauge, Scissors } from "lucide-react";
import { ConversionActions } from "@/components/conversion-actions";
import { FilePicker } from "@/components/file-picker";
import { InputPreview } from "@/components/input-preview";
import { OutputPreview } from "@/components/output-preview";
import { ProgressStatus } from "@/components/progress-status";
import { TrimControls } from "@/components/trim-controls";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useGifMaker } from "@/hooks/use-gif-maker";

export function GifMakerShell() {
  const {
    accessibleConvertButtonLabel,
    canConvert,
    cancelConversion,
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

  return (
    <main className="min-h-screen">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <section className="grid gap-5 border border-foreground/10 bg-white/70 p-5 shadow-[0_24px_70px_rgba(57,43,16,0.08)] backdrop-blur lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-primary/10 text-primary" variant="outline">
                MP4 → GIF
              </Badge>
              <Badge className="bg-background/80" variant="outline">
                Browser FFmpeg
              </Badge>
            </div>
            <div className="space-y-3">
              <h1 className="max-w-4xl font-heading text-4xl leading-none font-semibold tracking-[-0.05em] text-foreground sm:text-5xl lg:text-6xl">
                Convert clips into sharp CB-ready GIFs without leaving the page.
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Trim the exact moment, warm FFmpeg in the background, and render a
                download-ready animation with the preset’s sharper editorial style.
              </p>
            </div>
          </div>
          <div className="grid gap-3 border border-border/70 bg-background/70 p-4 sm:grid-cols-3 lg:grid-cols-1">
            <InfoStat
              icon={<Gauge className="size-4" />}
              label="Local render"
              value="No upload"
            />
            <InfoStat
              icon={<Scissors className="size-4" />}
              label="Trim control"
              value="0.1s steps"
            />
            <InfoStat
              icon={<Cpu className="size-4" />}
              label="Warm engine"
              value="Background preload"
            />
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)]">
          <div className="space-y-6">
            <FilePicker
              disabled={state.isBusy}
              fileName={state.file?.name ?? null}
              onFileChange={selectFile}
            />
            {state.errorMessage ? (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>Conversion blocked</AlertTitle>
                <AlertDescription>{state.errorMessage}</AlertDescription>
              </Alert>
            ) : null}
            <InputPreview
              file={state.file}
              inputPreviewUrl={state.inputPreviewUrl}
              metadata={state.metadata}
              onPreviewEnded={() => {
                if (!state.trimRange) {
                  return;
                }

                seekPreviewToLoopStart(state.trimRange);
                resumePreviewPlayback();
              }}
              onPreviewPlay={() => {
                enforcePreviewBounds({ restartPlayback: false });
              }}
              onPreviewSeeking={() => {
                if (previewRef.current?.paused) {
                  return;
                }

                enforcePreviewBounds({ restartPlayback: true });
              }}
              onPreviewTimeUpdate={() => {
                if (previewRef.current?.paused) {
                  return;
                }

                enforcePreviewBounds({ restartPlayback: true });
              }}
              previewRef={previewRef}
              trimRange={state.trimRange}
            />
            <TrimControls
              isBusy={state.isBusy}
              metadata={state.metadata}
              onTrimChange={updateTrimRange}
              trimDuration={trimDuration}
              trimRange={state.trimRange}
            />
          </div>

          <div className="space-y-6">
            <ConversionActions
              accessibleLabel={accessibleConvertButtonLabel}
              canConvert={canConvert}
              conversionState={state.conversionState}
              convertLabel={convertButtonLabel}
              engineState={state.engineState}
              hasFile={Boolean(state.file)}
              isBusy={state.isBusy}
              onCancel={cancelConversion}
              onConvert={() => {
                void runConversion();
              }}
            />
            <ProgressStatus
              message={progressStatusMessage}
              progress={state.progress}
              show={showProgress && progressStatusMessage !== ""}
            />
            <OutputPreview
              fileName={state.file?.name ?? null}
              result={state.result}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

function InfoStat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-2 border border-border/70 bg-white/70 p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-[11px] uppercase tracking-[0.2em]">{label}</span>
      </div>
      <p className="font-heading text-xl leading-none text-foreground">{value}</p>
    </div>
  );
}
