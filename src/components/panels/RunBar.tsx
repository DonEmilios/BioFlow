import { usePipelineStore } from "@/store/pipelineStore";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function RunBar() {
  const nodes = usePipelineStore((s) => s.nodes);
  const totalNodes = nodes.length;

  if (totalNodes === 0) return null;

  const completeNodes = nodes.filter((n) => n.data.status === "complete").length;
  const runningNode = nodes.find((n) => n.data.status === "running");
  const errorNodes = nodes.filter((n) => n.data.status === "error").length;
  const queuedNodes = nodes.filter((n) => n.data.status === "queued").length;

  const hasActivity = completeNodes > 0 || runningNode || errorNodes > 0 || queuedNodes > 0;
  if (!hasActivity) return null;

  const progress = Math.round((completeNodes / totalNodes) * 100);
  const isFinished = completeNodes === totalNodes;
  const hasError = errorNodes > 0;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-card/90 backdrop-blur-md rounded-lg shadow-node px-4 py-2.5 flex items-center gap-4 z-10 min-w-[320px]">
      {/* Icon */}
      {hasError ? (
        <XCircle size={16} className="text-destructive shrink-0" />
      ) : isFinished ? (
        <CheckCircle2 size={16} className="text-success shrink-0" />
      ) : runningNode ? (
        <Loader2 size={16} className="text-primary animate-spin shrink-0" />
      ) : null}

      {/* Progress bar */}
      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              hasError ? "bg-destructive" : "bg-primary"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs font-mono text-muted-foreground w-8 text-right">{progress}%</span>
      </div>

      {/* Current step label */}
      <div className="text-xs text-muted-foreground truncate max-w-[180px]">
        {hasError
          ? `Error at step ${completeNodes + 1}`
          : isFinished
            ? "All steps complete"
            : runningNode
              ? `Step ${completeNodes + 1}/${totalNodes}: ${runningNode.data.label}`
              : `${queuedNodes} steps queued`}
      </div>
    </div>
  );
}
