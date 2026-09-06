import { Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

type ProcessProgressProps = {
  label: string;
  completed: number;
  total: number;
  failed?: number;
  current?: string;
  indeterminate?: boolean;
};

export const ProcessProgress = ({
  label,
  completed,
  total,
  failed = 0,
  current,
  indeterminate = false,
}: ProcessProgressProps) => {
  const processed = completed + failed;
  const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;

  return (
    <div className="space-y-3 rounded-sm border border-border bg-muted/30 p-3" aria-live="polite">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex min-w-0 items-center gap-2 font-medium">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
          <span className="truncate">{label}</span>
        </span>
        {!indeterminate && <span className="shrink-0 text-xs text-muted-foreground">{percentage}%</span>}
      </div>
      <Progress value={indeterminate ? undefined : percentage} aria-label={indeterminate ? `${label} in progress` : `${label}: ${percentage}% complete`} />
      {indeterminate ? <p className="text-xs text-muted-foreground">Working with the AI provider...</p> : <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{processed} of {total} processed</span>
        <span>{completed} completed{failed ? `, ${failed} failed` : ""}</span>
      </div>}
      {current && <p className="truncate text-xs text-muted-foreground">Current: {current}</p>}
    </div>
  );
};
