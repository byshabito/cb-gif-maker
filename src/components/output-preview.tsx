import { Download, ImagePlay, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBytes, formatDuration } from "@/lib/gif-it";
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
    <Card size="sm" className="flex min-h-0 flex-col">
      <CardHeader>
        <CardTitle>Output</CardTitle>
        <CardDescription>
          Preview the final GIF and export it directly.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col space-y-3">
        {result ? (
          <>
            <div className="overflow-hidden border">
              <img
                alt="Generated GIF preview"
                className="aspect-video w-full object-contain"
                src={result.objectUrl}
              />
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              <Metric label="Size" value={formatBytes(result.bytes)} />
              <Metric label="Frame" value={`${result.width} × ${result.height}`} />
              <Metric label="Duration" value={formatDuration(result.duration)} />
            </div>
            <Button asChild className="w-full" size="default">
              <a download={downloadName} href={result.objectUrl}>
                <Download />
                Download GIF
              </a>
            </Button>
          </>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 border p-4 text-center">
            <div className="relative">
              <ImagePlay className="size-8" />
              <Sparkles className="absolute -right-2 -top-2 size-4" />
            </div>
            <div className="space-y-1">
              <p className="font-heading text-sm font-medium">GIF preview appears here</p>
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
    <Card size="sm">
      <CardContent className="space-y-1">
        <p className="text-muted-foreground">{label}</p>
        <p>{value}</p>
      </CardContent>
    </Card>
  );
}
