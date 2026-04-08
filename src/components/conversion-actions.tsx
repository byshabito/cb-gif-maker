import { CircleSlash2, WandSparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getEngineLabel, type EngineState } from "@/lib/gif-maker";

type ConversionActionsProps = {
  accessibleLabel: string;
  canConvert: boolean;
  convertLabel: string;
  conversionState: string;
  engineState: EngineState;
  hasFile: boolean;
  isBusy: boolean;
  onCancel: () => void;
  onConvert: () => void;
};

function getEngineBadgeClassName(engineState: EngineState) {
  switch (engineState) {
    case "ready":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
    case "loading":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700";
    case "error":
      return "border-destructive/30 bg-destructive/10 text-destructive";
    case "idle":
      return "border-border/80 bg-background/70 text-muted-foreground";
  }
}

export function ConversionActions({
  accessibleLabel,
  canConvert,
  convertLabel,
  conversionState,
  engineState,
  hasFile,
  isBusy,
  onCancel,
  onConvert,
}: ConversionActionsProps) {
  const helperText = hasFile
    ? "Conversion stays local and uses FFmpeg in the browser."
    : "Choose a clip first to enable the render.";

  return (
    <Card className="border-foreground/10 bg-white/80 shadow-[0_18px_50px_rgba(57,43,16,0.08)] backdrop-blur">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Render</CardTitle>
            <CardDescription>{helperText}</CardDescription>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                className={getEngineBadgeClassName(engineState)}
                variant="outline"
              >
                {getEngineLabel(engineState)}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="left">
              FFmpeg warm-up happens after metadata is ready.
            </TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          aria-label={accessibleLabel}
          className="h-12 w-full text-sm"
          disabled={!canConvert}
          onClick={onConvert}
          size="lg"
          type="button"
        >
          <WandSparkles />
          {convertLabel}
        </Button>
        <Button
          className="w-full"
          hidden={!isBusy}
          onClick={onCancel}
          type="button"
          variant="outline"
        >
          <CircleSlash2 />
          Cancel
        </Button>
        <div className="border border-border/70 bg-background/70 p-3 text-xs text-muted-foreground">
          Status: <span className="text-foreground">{conversionState}</span>
        </div>
      </CardContent>
    </Card>
  );
}
