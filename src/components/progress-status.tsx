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
    <div className="space-y-2 p-3">
      <div className="flex items-center gap-2 text-xs">
        <LoaderCircle className="size-4 animate-spin" />
        <span>{message}</span>
      </div>
      <Progress value={Math.round((progress ?? 0) * 100)} />
      <p className="text-xs text-muted-foreground">
        {Math.round((progress ?? 0) * 100)}% complete
      </p>
    </div>
  );
}
