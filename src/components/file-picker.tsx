import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ACCEPTED_VIDEO_TYPES, SUPPORTED_VIDEO_FORMAT_LABEL } from "@/lib/gif-it";

type FilePickerProps = {
  disabled: boolean;
  fileName: string | null;
  onFileChange: (file: File | null) => void;
};

export function FilePicker({
  disabled,
  fileName,
  onFileChange,
}: FilePickerProps) {
  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Source Clip</CardTitle>
            <CardDescription>
              Choose a local {SUPPORTED_VIDEO_FORMAT_LABEL} and keep everything in the browser.
            </CardDescription>
          </div>
          <Button
            className="pointer-events-none shrink-0"
            size="sm"
            type="button"
            variant="outline"
          >
            <Upload />
            Choose video
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <label
          className={cn("block cursor-pointer", disabled && "cursor-not-allowed opacity-60")}
        >
          <div className="text-xs text-muted-foreground">
            <span className="line-clamp-2">
              {fileName ?? `No file selected. ${SUPPORTED_VIDEO_FORMAT_LABEL} only.`}
            </span>
          </div>
          <Input
            accept={ACCEPTED_VIDEO_TYPES}
            aria-label="Choose video (.mp4, .mkv, .mov, .webm)"
            className="sr-only"
            disabled={disabled}
            onChange={(event) => {
              onFileChange(event.currentTarget.files?.[0] ?? null);
              event.currentTarget.value = "";
            }}
            type="file"
          />
        </label>
      </CardContent>
    </Card>
  );
}
