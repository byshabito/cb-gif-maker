import type { RefObject } from "react";
import { Film, Scissors, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  formatBytes,
  formatDuration,
  hasKnownDuration,
} from "@/lib/gif-maker";
import type { InputMetadata, TrimRange } from "@/types";

type InputPreviewProps = {
  file: File | null;
  inputPreviewUrl: string | null;
  metadata: InputMetadata | null;
  previewRef: RefObject<HTMLVideoElement | null>;
  trimRange: TrimRange | null;
  onPreviewEnded: () => void;
  onPreviewPlay: () => void;
  onPreviewSeeking: () => void;
  onPreviewTimeUpdate: () => void;
};

export function InputPreview({
  file,
  inputPreviewUrl,
  metadata,
  previewRef,
  trimRange,
  onPreviewEnded,
  onPreviewPlay,
  onPreviewSeeking,
  onPreviewTimeUpdate,
}: InputPreviewProps) {
  const summaryChips = [
    file ? formatBytes(file.size) : "-",
    metadata ? `${metadata.width} × ${metadata.height}` : "-",
    metadata ? formatDuration(metadata.duration) : "-",
  ];
  const hasTrim = hasKnownDuration(metadata) && trimRange !== null;

  return (
    <Card className="border-foreground/10 bg-white/80 shadow-[0_18px_50px_rgba(57,43,16,0.08)] backdrop-blur">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Clip Preview</CardTitle>
            <CardDescription>
              Review the source video before the GIF render starts.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {summaryChips.map((chip, index) => (
              <Badge
                className="bg-background/80"
                key={`${chip}-${index}`}
                variant="outline"
              >
                {chip}
              </Badge>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative overflow-hidden border border-border/70 bg-muted/50">
          {inputPreviewUrl ? (
            <video
              className="aspect-video w-full bg-[#16130f] object-contain"
              controls
              muted
              onEnded={onPreviewEnded}
              onPlay={onPreviewPlay}
              onSeeking={onPreviewSeeking}
              onTimeUpdate={onPreviewTimeUpdate}
              playsInline
              preload="metadata"
              ref={previewRef}
              src={inputPreviewUrl}
            />
          ) : (
            <div className="flex aspect-video flex-col items-center justify-center gap-3 bg-[linear-gradient(135deg,rgba(203,115,62,0.08),rgba(88,147,127,0.12))] text-center">
              <Film className="size-8 text-primary/80" />
              <div className="space-y-1">
                <p className="font-heading text-sm font-medium">
                  Drop in a source clip
                </p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  The selected video stays local and becomes the live trim preview.
                </p>
              </div>
            </div>
          )}
        </div>
        <Separator />
        <div className="grid gap-3 md:grid-cols-3">
          <div className="border border-border/70 bg-background/70 p-3">
            <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              <Film className="size-3.5" />
              Source
            </div>
            <p className="line-clamp-2 text-sm text-foreground">
              {file?.name ?? "No file chosen"}
            </p>
          </div>
          <div className="border border-border/70 bg-background/70 p-3">
            <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              <Scissors className="size-3.5" />
              Trim
            </div>
            <p className="text-sm text-foreground">
              {hasTrim
                ? `${trimRange.startTime.toFixed(1)}s → ${trimRange.endTime.toFixed(1)}s`
                : "Full duration"}
            </p>
          </div>
          <div className="border border-border/70 bg-background/70 p-3">
            <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              <Sparkles className="size-3.5" />
              Output rule
            </div>
            <p className="text-sm text-foreground">
              {metadata
                ? metadata.width * 80 > metadata.height * 250
                  ? "Scale to 250px wide"
                  : "Scale to 80px tall"
                : "Auto after probe"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
