import { usePipelineStore } from "@/store/pipelineStore";

export default function RunBar() {
  const nodes = usePipelineStore((s) => s.nodes);
  const totalNodes = nodes.length;
  
  if (totalNodes === 0) return null;

  const completeNodes = nodes.filter((n) => n.data.status === "complete").length;
  const runningNodes = nodes.filter((n) => n.data.status === "running").length;
  const errorNodes = nodes.filter((n) => n.data.status === "error").length;

  const hasActivity = completeNodes > 0 || runningNodes > 0 || errorNodes > 0;
  if (!hasActivity) return null;

  const progress = Math.round((completeNodes / totalNodes) * 100);

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-card/80 backdrop-blur-md rounded-lg shadow-node px-4 py-2.5 flex items-center gap-4 z-10">
      <div className="flex items-center gap-2">
        <div className="w-32 h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs font-mono text-muted-foreground">{progress}%</span>
      </div>
      <span className="text-xs text-muted-foreground">
        {completeNodes}/{totalNodes} nodes
      </span>
    </div>
  );
}
