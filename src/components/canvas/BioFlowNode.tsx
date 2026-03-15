import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { motion } from "framer-motion";
import * as LucideIcons from "lucide-react";
import { NODE_CATEGORIES } from "@/lib/nodeRegistry";
import { PipelineNodeData } from "@/store/pipelineStore";
import { usePipelineStore } from "@/store/pipelineStore";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  idle: "bg-muted",
  queued: "bg-accent",
  running: "bg-accent animate-pulse",
  complete: "bg-success",
  error: "bg-destructive",
};

function BioFlowNode({ id, data, selected }: NodeProps<PipelineNodeData>) {
  const setSelectedNode = usePipelineStore((s) => s.setSelectedNode);
  const IconComponent = (LucideIcons as any)[data.icon] || LucideIcons.Box;
  const categoryConfig = NODE_CATEGORIES[data.category as keyof typeof NODE_CATEGORIES];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
      className={cn(
        "bg-card rounded-lg min-w-[200px] cursor-pointer select-none",
        selected ? "shadow-node-active" : "shadow-node"
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
        <IconComponent
          size={14}
          strokeWidth={1.5}
          style={{ color: categoryConfig?.color }}
        />
        <span className="text-sm font-medium text-foreground truncate flex-1" style={{ textWrap: "balance" as any }}>
          {data.label}
        </span>
        <div className={cn("w-2 h-2 rounded-full", statusColors[data.status])} />
      </div>

      {/* Body */}
      <div className="px-3 py-2">
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {data.description}
        </p>
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
