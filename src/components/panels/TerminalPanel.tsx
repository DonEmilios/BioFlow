import { usePipelineStore } from "@/store/pipelineStore";
import { Terminal, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

export default function TerminalPanel() {
  const logs = usePipelineStore((s) => s.logs);
  const clearLogs = usePipelineStore((s) => s.clearLogs);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-[#a9b7c6] font-mono text-xs border-r border-border shrink-0 w-full">
      <div className="h-9 flex items-center justify-between px-4 bg-[#2b2b2b] shrink-0 border-b border-[#1e1e1e]/60">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-[#a9b7c6]" />
          <span className="font-semibold text-[#a9b7c6]">Execution Terminal</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-[#a9b7c6] hover:text-white hover:bg-white/10" onClick={clearLogs}>
          <Trash2 size={12} />
        </Button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1.5 scroll-smooth">
        {(!logs || logs.length === 0) ? (
          <div className="flex items-center justify-center opacity-40 italic h-full">Waiting for execution...</div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="flex gap-3 hover:bg-[#2b2b2b] px-1 rounded transition-colors -mx-1 py-0.5">
              <span className="text-[#608b4e] shrink-0 font-medium">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
              <span className="break-all whitespace-pre-wrap">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
