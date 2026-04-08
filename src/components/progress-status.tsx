import { LoaderCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

type ProgressStatusProps = {
  message: string;
  progress: number | null;
  show: boolean;
};

export function ProgressStatus({
  message,
  progress,
  show,
}: ProgressStatusProps) {
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-3 border border-border/70 bg-background/70 p-4">
      <div className="flex items-center gap-2 text-sm text-foreground">
        <LoaderCircle className="size-4 animate-spin text-primary" />
        <span>{message}</span>
      </div>
      <Progress value={Math.round((progress ?? 0) * 100)} />
      <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        {Math.round((progress ?? 0) * 100)}% complete
      </p>
    </div>
  );
}
