import { Scissors } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import {
  TRIM_STEP,
  formatTrimTimestamp,
  hasKnownDuration,
} from "@/lib/gif-maker";
import type { InputMetadata, TrimRange } from "@/types";

type TrimControlsProps = {
  isBusy: boolean;
  metadata: InputMetadata | null;
  trimDuration: number;
  trimRange: TrimRange | null;
  onTrimChange: (values: number[]) => void;
};

export function TrimControls({
  isBusy,
  metadata,
  trimDuration,
  trimRange,
  onTrimChange,
}: TrimControlsProps) {
  if (!hasKnownDuration(metadata) || trimRange === null || metadata.duration < 0.1) {
    return null;
  }

  return (
    <Card className="border-foreground/10 bg-white/80 shadow-[0_18px_50px_rgba(57,43,16,0.08)] backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scissors className="size-4" />
          Trim Range
        </CardTitle>
        <CardDescription>
          Keep the strongest moment. The preview will loop inside the selected span.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="border border-border/70 bg-background/70 p-4">
          <Slider
            aria-label="Trim range"
            disabled={isBusy}
            max={metadata.duration}
            min={0}
            onValueChange={onTrimChange}
            step={TRIM_STEP}
            value={[trimRange.startTime, trimRange.endTime]}
          />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="border border-border/70 bg-background/70 p-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Start
            </p>
            <p className="mt-2 text-lg font-medium text-foreground">
              {formatTrimTimestamp(trimRange.startTime)}
            </p>
          </div>
          <div className="border border-border/70 bg-background/70 p-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              End
            </p>
            <p className="mt-2 text-lg font-medium text-foreground">
              {formatTrimTimestamp(trimRange.endTime)}
            </p>
          </div>
          <div className="border border-border/70 bg-background/70 p-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Selected
            </p>
            <p className="mt-2 text-lg font-medium text-foreground">
              {formatTrimTimestamp(trimDuration)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
