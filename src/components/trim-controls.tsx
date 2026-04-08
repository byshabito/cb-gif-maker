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
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scissors className="size-4" />
          Trim Range
        </CardTitle>
        <CardDescription>
          Keep the strongest moment. The preview will loop inside the selected span.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="border p-3">
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
        <div className="grid gap-2 md:grid-cols-3">
          <TrimMetric label="Start" value={formatTrimTimestamp(trimRange.startTime)} />
          <TrimMetric label="End" value={formatTrimTimestamp(trimRange.endTime)} />
          <TrimMetric label="Selected" value={formatTrimTimestamp(trimDuration)} />
        </div>
      </CardContent>
    </Card>
  );
}

function TrimMetric({ label, value }: { label: string; value: string }) {
  return (
    <Card size="sm">
      <CardContent className="space-y-1">
        <p className="text-muted-foreground">{label}</p>
        <p>{value}</p>
      </CardContent>
    </Card>
  );
}
