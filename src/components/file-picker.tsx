import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ACCEPTED_VIDEO_TYPES } from "@/lib/gif-maker";

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
    <label
      className={cn(
        "group flex cursor-pointer flex-col gap-3 border border-dashed border-foreground/15 bg-background/70 p-4 transition-colors hover:border-primary/40 hover:bg-background",
        disabled && "cursor-not-allowed opacity-60"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="font-heading text-sm font-medium text-foreground">
            Source clip
          </p>
          <p className="text-xs text-muted-foreground">
            Choose a local MP4 and keep everything in the browser.
          </p>
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
      <div className="flex min-h-12 items-center border-t border-border/70 pt-3 text-xs text-muted-foreground">
        <span className="line-clamp-2">
          {fileName ?? "No file selected. MP4 only."}
        </span>
      </div>
      <Input
        accept={ACCEPTED_VIDEO_TYPES}
        aria-label="Choose video (.mp4)"
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          onFileChange(event.currentTarget.files?.[0] ?? null);
          event.currentTarget.value = "";
        }}
        type="file"
      />
    </label>
  );
}
