import { Download, ImagePlay, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBytes, formatDuration } from "@/lib/gif-maker";
import type { ConversionResult } from "@/types";

type OutputPreviewProps = {
  fileName: string | null;
  result: ConversionResult | null;
};

export function OutputPreview({ fileName, result }: OutputPreviewProps) {
  const downloadName = fileName
    ? fileName.replace(/\.[^/.]+$/, "") + ".gif"
    : "output.gif";

  return (
    <Card className="border-foreground/10 bg-white/80 shadow-[0_18px_50px_rgba(57,43,16,0.08)] backdrop-blur">
      <CardHeader>
        <CardTitle>Output</CardTitle>
        <CardDescription>
          Preview the final GIF and export it directly.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {result ? (
          <>
            <div className="overflow-hidden border border-border/70 bg-muted/50">
              <img
                alt="Generated GIF preview"
                className="aspect-video w-full bg-[#16130f] object-contain"
                src={result.objectUrl}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Metric label="Size" value={formatBytes(result.bytes)} />
              <Metric
                label="Frame"
                value={`${result.width} × ${result.height}`}
              />
              <Metric
                label="Duration"
                value={formatDuration(result.duration)}
              />
            </div>
            <Button asChild className="w-full" size="lg">
              <a download={downloadName} href={result.objectUrl}>
                <Download />
                Download GIF
              </a>
            </Button>
          </>
        ) : (
          <div className="flex min-h-80 flex-col items-center justify-center gap-4 border border-dashed border-foreground/15 bg-[linear-gradient(135deg,rgba(203,115,62,0.08),rgba(88,147,127,0.12))] p-8 text-center">
            <div className="relative">
              <ImagePlay className="size-10 text-primary/80" />
              <Sparkles className="absolute -right-2 -top-2 size-4 text-emerald-600" />
            </div>
            <div className="space-y-1">
              <p className="font-heading text-sm font-medium text-foreground">
                GIF preview appears here
              </p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Once conversion finishes, this pane becomes the final download surface.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border/70 bg-background/70 p-3">
      <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-sm text-foreground">{value}</p>
    </div>
  );
}
