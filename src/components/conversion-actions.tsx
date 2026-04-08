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
    <Card size="sm">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Render</CardTitle>
            <CardDescription>{helperText}</CardDescription>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline">
                {getEngineLabel(engineState)}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="left">
              FFmpeg warm-up happens after metadata is ready.
            </TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          aria-label={accessibleLabel}
          className="w-full"
          disabled={!canConvert}
          onClick={onConvert}
          size="default"
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
        <div className="border p-2.5 text-xs text-muted-foreground">
          Status: <span className="text-foreground">{conversionState}</span>
        </div>
      </CardContent>
    </Card>
  );
}
