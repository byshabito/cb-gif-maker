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
    <Card size="sm" className="flex min-h-0 flex-col">
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
              <Badge key={`${chip}-${index}`} variant="outline">
                {chip}
              </Badge>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col space-y-3">
        <div className="relative overflow-hidden border">
          {inputPreviewUrl ? (
            <video
              className="aspect-video w-full object-contain"
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
            <div className="flex aspect-video flex-col items-center justify-center gap-2 text-center text-muted-foreground">
              <Film className="size-6" />
              <div className="space-y-1">
                <p className="font-heading text-sm font-medium">Drop in a source clip</p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  The selected video stays local and becomes the live trim preview.
                </p>
              </div>
            </div>
          )}
        </div>
        <Separator />
        <div className="grid gap-2 md:grid-cols-3">
          <div className="border p-2.5">
            <div className="mb-2 flex items-center gap-2 text-muted-foreground">
              <Film className="size-3.5" />
              Source
            </div>
            <p className="line-clamp-2 text-sm">{file?.name ?? "No file chosen"}</p>
          </div>
          <div className="border p-2.5">
            <div className="mb-2 flex items-center gap-2 text-muted-foreground">
              <Scissors className="size-3.5" />
              Trim
            </div>
            <p className="text-sm">
              {hasTrim
                ? `${trimRange.startTime.toFixed(1)}s → ${trimRange.endTime.toFixed(1)}s`
                : "Full duration"}
            </p>
          </div>
          <div className="border p-2.5">
            <div className="mb-2 flex items-center gap-2 text-muted-foreground">
              <Sparkles className="size-3.5" />
              Output rule
            </div>
            <p className="text-sm">
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
