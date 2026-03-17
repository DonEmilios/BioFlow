import { AnimatePresence, motion } from "framer-motion";
import { usePipelineStore } from "@/store/pipelineStore";
import { X, FileText, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";

function ResultCard({ nodeId, result }: { nodeId: string; result: any }) {
  const [open, setOpen] = useState(false);
  const { label, summary, ...details } = result;

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-secondary/50 transition-colors"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="text-xs font-semibold text-foreground truncate">{label || nodeId}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          <p className="text-xs text-muted-foreground leading-relaxed">{summary}</p>
          <div className="space-y-1">
            {Object.entries(details).map(([key, val]) => {
              if (key === "tool") return null;
              return (
                <div key={key} className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground font-mono">{key}</span>
                  <span className="text-foreground font-medium max-w-[180px] truncate text-right">
                    {typeof val === "object" ? JSON.stringify(val).slice(0, 60) + "…" : String(val)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ResultsPanel() {
  const runResults = usePipelineStore((s) => s.runResults);
  const clearResults = usePipelineStore((s) => s.clearResults);

  return (
    <AnimatePresence>
      {runResults && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 320, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          className="shrink-0 border-l border-border bg-card overflow-hidden"
        >
          <div className="w-[320px] h-full flex flex-col">
            <div className="h-10 flex items-center justify-between px-3 border-b border-border shrink-0">
              <div className="flex items-center gap-1.5">
                <FileText size={14} className="text-primary" />
                <span className="text-xs font-semibold text-foreground">Run Results</span>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearResults}>
                <X size={12} />
              </Button>
            </div>
            <ScrollArea className="flex-1 p-3">
              <div className="space-y-2">
                {Object.entries(runResults).map(([nodeId, result]) => (
                  <ResultCard key={nodeId} nodeId={nodeId} result={result} />
                ))}
              </div>
            </ScrollArea>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
