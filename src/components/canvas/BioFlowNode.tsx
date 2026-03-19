import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { motion } from "framer-motion";
import * as LucideIcons from "lucide-react";
import { NODE_CATEGORIES } from "@/lib/nodeRegistry";
import { PipelineNodeData } from "@/store/pipelineStore";
import { usePipelineStore } from "@/store/pipelineStore";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { dot: string; border: string; label: string }> = {
  idle: { dot: "bg-muted-foreground/40", border: "", label: "Idle" },
  queued: { dot: "bg-accent", border: "ring-1 ring-accent/30", label: "Queued" },
  running: { dot: "bg-primary animate-pulse", border: "ring-2 ring-primary/40 shadow-[0_0_12px_hsl(var(--primary)/0.25)]", label: "Running…" },
  complete: { dot: "bg-success", border: "", label: "Complete" },
  error: { dot: "bg-destructive", border: "ring-2 ring-destructive/40", label: "Error" },
};

function BioFlowNode({ id, data, selected }: NodeProps<PipelineNodeData>) {
  const setSelectedNode = usePipelineStore((s) => s.setSelectedNode);
  const IconComponent = (LucideIcons as any)[data.icon] || LucideIcons.Box;
  const categoryConfig = NODE_CATEGORIES[data.category as keyof typeof NODE_CATEGORIES];
  const status = statusConfig[data.status] || statusConfig.idle;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
      className={cn(
        "bg-card rounded-lg min-w-[200px] cursor-pointer select-none transition-shadow duration-300",
        selected ? "shadow-node-active" : "shadow-node",
        status.border
      )}
      onClick={() => setSelectedNode(id)}
    >
      {/* Input handles */}
      {data.category !== "input" && (
        <Handle
          type="target"
          position={Position.Left}
          className="!-left-[6px]"
        />
      )}

      {/* Header */}
      <div className="h-10 px-3 flex items-center gap-2 border-b border-border bg-secondary/50 rounded-t-lg">
        {data.status === "running" ? (
          <LucideIcons.Loader2
            size={14}
            strokeWidth={1.5}
            className="animate-spin text-primary"
          />
        ) : (
          <IconComponent
            size={14}
            strokeWidth={1.5}
            style={{ color: categoryConfig?.color }}
          />
        )}
        <span className="text-sm font-medium text-foreground truncate flex-1" style={{ textWrap: "balance" as any }}>
          {data.label}
        </span>
        <div className={cn("w-2 h-2 rounded-full shrink-0", status.dot)} />
      </div>

      {/* Body */}
      <div className="px-3 py-2">
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {data.description}
        </p>
        {/* Status badge when running or queued */}
        {(data.status === "running" || data.status === "queued") && (
          <div className={cn(
            "mt-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium",
            data.status === "running"
              ? "bg-primary/10 text-primary"
              : "bg-accent/10 text-accent-foreground"
          )}>
            {data.status === "running" && <LucideIcons.Loader2 size={10} className="animate-spin" />}
            {status.label}
          </div>
        )}
      </div>

      {/* Output handles */}
      {data.category !== "output" && (
        <Handle
          type="source"
          position={Position.Right}
          className="!-right-[6px]"
        />
      )}
    </motion.div>
  );
}

export default memo(BioFlowNode);
