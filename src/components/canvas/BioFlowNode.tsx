import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { motion } from "framer-motion";
import * as LucideIcons from "lucide-react";
import { NODE_CATEGORIES } from "@/lib/nodeRegistry";
import { getNodeById } from "@/lib/nodeRegistry";
import { PipelineNodeData } from "@/store/pipelineStore";
import { usePipelineStore } from "@/store/pipelineStore";
import { cn } from "@/lib/utils";

const statusConfig: Record<
  string,
  { dot: string; ring: string; label: string; badge: string }
> = {
  idle: { dot: "bg-muted-foreground/30", ring: "", label: "Idle", badge: "" },
  queued: {
    dot: "bg-amber-400",
    ring: "ring-1 ring-amber-300/50",
    label: "Queued",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
  },
  running: {
    dot: "bg-primary animate-pulse",
    ring: "ring-2 ring-primary/40 shadow-[0_0_24px_-4px_hsl(var(--primary)/0.35)]",
    label: "Running",
    badge: "bg-primary/10 text-primary border-primary/20",
  },
  complete: {
    dot: "bg-success",
    ring: "ring-1 ring-success/40",
    label: "Complete",
    badge: "bg-success/10 text-success border-success/20",
  },
  error: {
    dot: "bg-destructive",
    ring: "ring-2 ring-destructive/40",
    label: "Error",
    badge: "bg-destructive/10 text-destructive border-destructive/20",
  },
};

function TypeChip({ label, color }: { label: string; color?: string }) {
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-mono font-medium uppercase tracking-wide"
      style={
        color
          ? { backgroundColor: `${color}14`, color }
          : undefined
      }
    >
      {label}
    </span>
  );
}

function BioFlowNode({ id, data, selected }: NodeProps<PipelineNodeData>) {
  const setSelectedNode = usePipelineStore((s) => s.setSelectedNode);
  const IconComponent = (LucideIcons as any)[data.icon] || LucideIcons.Box;
  const categoryConfig = NODE_CATEGORIES[data.category as keyof typeof NODE_CATEGORIES];
  const accent = categoryConfig?.color ?? "hsl(var(--primary))";
  const status = statusConfig[data.status] || statusConfig.idle;

  const registry = getNodeById(data.tool);
  const inputTypes = registry?.input_types ?? [];
  const outputTypes = registry?.output_types ?? [];
  const isSource = data.category === "input" || inputTypes.length === 0;
  const isSink = data.category === "output" || outputTypes.length === 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
      onClick={() => setSelectedNode(id)}
      className={cn(
        "group relative w-[260px] cursor-pointer select-none overflow-hidden rounded-xl bg-card transition-shadow duration-300",
        selected ? "shadow-node-active" : "shadow-node hover:shadow-node-active",
        status.ring
      )}
    >
      {/* Category accent stripe */}
      <div className="absolute inset-x-0 top-0 h-[3px]" style={{ backgroundColor: accent }} />

      {/* Input handle */}
      {!isSource && <Handle type="target" position={Position.Left} className="!-left-[6px]" />}

      {/* Header */}
      <div className="flex items-center gap-2.5 px-3 pt-3.5 pb-2">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${accent}1a` }}
        >
          {data.status === "running" ? (
            <LucideIcons.Loader2 size={16} strokeWidth={2} className="animate-spin" style={{ color: accent }} />
          ) : (
            <IconComponent size={16} strokeWidth={2} style={{ color: accent }} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold leading-tight text-foreground">
            {data.label}
          </div>
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {categoryConfig?.label ?? data.category}
          </div>
        </div>
        <div className={cn("h-2.5 w-2.5 shrink-0 rounded-full", status.dot)} />
      </div>

      {/* Body */}
      <div className="px-3 pb-3">
        <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
          {data.description}
        </p>

        {/* I/O type chips */}
        <div className="mt-2.5 flex items-center gap-1.5">
          {isSource ? (
            <TypeChip label="source" />
          ) : (
            inputTypes.slice(0, 2).map((t) => <TypeChip key={`i-${t}`} label={t} />)
          )}
          <LucideIcons.ArrowRight size={11} className="shrink-0 text-muted-foreground/50" />
          {isSink ? (
            <TypeChip label="output" color={accent} />
          ) : (
            outputTypes.slice(0, 2).map((t) => <TypeChip key={`o-${t}`} label={t} color={accent} />)
          )}

          {(data.status === "running" || data.status === "queued" || data.status === "error") && (
            <span
              className={cn(
                "ml-auto inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-medium",
                status.badge
              )}
            >
              {data.status === "running" && <LucideIcons.Loader2 size={9} className="animate-spin" />}
              {status.label}
            </span>
          )}
        </div>
      </div>

      {/* Output handle */}
      {!isSink && <Handle type="source" position={Position.Right} className="!-right-[6px]" />}
    </motion.div>
  );
}

export default memo(BioFlowNode);
