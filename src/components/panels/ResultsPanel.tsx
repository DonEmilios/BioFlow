import { AnimatePresence, motion } from "framer-motion";
import { usePipelineStore } from "@/store/pipelineStore";
import { X, FileText, ChevronDown, ChevronRight, CheckCircle2, AlertCircle, BarChart3, Sparkles, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";

function MetricRow({ label, value }: { label: string; value: any }) {
  if (value === null || value === undefined) return null;

  const formatted =
    typeof value === "number"
      ? value.toLocaleString()
      : typeof value === "boolean"
      ? value ? "Yes" : "No"
      : String(value);

  return (
    <div className="flex justify-between items-center py-1 border-b border-border/40 last:border-0">
      <span className="text-[11px] text-muted-foreground font-mono">{label}</span>
      <span className="text-[11px] text-foreground font-semibold max-w-[180px] truncate text-right">{formatted}</span>
    </div>
  );
}

function DataTable({ data }: { data: any[] }) {
  if (!data.length) return null;
  const cols = Object.keys(data[0]);
  return (
    <div className="overflow-x-auto rounded-md border border-border/60">
      <table className="w-full text-[10px]">
        <thead>
          <tr className="bg-muted/50">
            {cols.map((c) => (
              <th key={c} className="px-2 py-1.5 text-left font-semibold text-muted-foreground uppercase tracking-wider">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 10).map((row, i) => (
            <tr key={i} className="border-t border-border/30 hover:bg-secondary/30 transition-colors">
              {cols.map((c) => (
                <td key={c} className="px-2 py-1 text-foreground font-mono">
                  {typeof row[c] === "number"
                    ? row[c] < 0.001 && row[c] > 0
                      ? row[c].toExponential(1)
                      : row[c].toLocaleString()
                    : String(row[c] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > 10 && (
        <div className="px-2 py-1 text-[10px] text-muted-foreground bg-muted/30 text-center">
          + {data.length - 10} more rows
        </div>
      )}
    </div>
  );
}

function ResultCard({ nodeId, result, nodeLabel }: { nodeId: string; result: any; nodeLabel: string }) {
  const [open, setOpen] = useState(true);
  const { summary, tool, data, top_genes, top_results, chart_config, image_url, interpretation, pathways_affected, files, ...metrics } = result;

  const hasTable = Array.isArray(data) && data.length > 0 && typeof data[0] === "object";
  const hasGenes = Array.isArray(top_genes) && top_genes.length > 0;
  const hasTopResults = Array.isArray(top_results) && top_results.length > 0;
  const hasPathways = Array.isArray(pathways_affected) && pathways_affected.length > 0;
  const hasFiles = Array.isArray(files) && files.length > 0;
  const hasInterpretation = !!interpretation;

  // Filter out complex/array metrics
  const scalarMetrics = Object.entries(metrics).filter(
    ([, v]) => typeof v !== "object" || v === null
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-border rounded-lg overflow-hidden bg-card"
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-secondary/50 transition-colors"
      >
        {open ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
        <CheckCircle2 size={13} className="text-primary shrink-0" />
        <span className="text-xs font-semibold text-foreground truncate flex-1">{nodeLabel}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2.5">
              {/* Summary */}
              {summary && (
                <p className="text-[11px] text-muted-foreground leading-relaxed bg-secondary/30 rounded-md px-2.5 py-2 border-l-2 border-primary/60">
                  {summary}
                </p>
              )}

              {/* AI Interpretation */}
              {hasInterpretation && (
                <div className="bg-accent/20 rounded-md p-2.5 border border-accent/30">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Sparkles size={12} className="text-accent-foreground" />
                    <span className="text-[10px] font-semibold text-accent-foreground uppercase tracking-wider">AI Interpretation</span>
                  </div>
                  <p className="text-[11px] text-foreground leading-relaxed">{interpretation}</p>
                </div>
              )}

              {/* Pathways */}
              {hasPathways && (
                <div className="flex flex-wrap gap-1">
                  {pathways_affected.map((p: string) => (
                    <Badge key={p} variant="secondary" className="text-[9px] px-1.5 py-0.5">{p}</Badge>
                  ))}
                </div>
              )}

              {/* Scalar metrics */}
              {scalarMetrics.length > 0 && (
                <div className="space-y-0">
                  {scalarMetrics.map(([key, val]) => (
                    <MetricRow key={key} label={key.replace(/_/g, " ")} value={val} />
                  ))}
                </div>
              )}

              {/* Data tables */}
              {hasGenes && <DataTable data={top_genes} />}
              {hasTopResults && <DataTable data={top_results} />}
              {hasTable && <DataTable data={data} />}

              {/* Files */}
              {hasFiles && (
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Output Files</span>
                  {files.map((f: string) => (
                    <div key={f} className="flex items-center gap-1.5 text-[11px] text-foreground">
                      <FileText size={11} className="text-muted-foreground" />
                      <span className="font-mono">{f}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Image */}
              {image_url && (
                <img src={image_url} alt="Visualization" className="w-full rounded-md border border-border/50" />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function ResultsPanel() {
  const runResults = usePipelineStore((s) => s.runResults);
  const clearResults = usePipelineStore((s) => s.clearResults);
  const nodes = usePipelineStore((s) => s.nodes);

  // Build a map of nodeId -> label
  const labelMap: Record<string, string> = {};
  nodes.forEach((n) => {
    labelMap[n.id] = n.data.label;
  });

  const executionOrder = usePipelineStore((s) => s.executionOrder);
  const resultEntries = runResults 
    ? Object.entries(runResults).sort((a, b) => {
        const idA = executionOrder.indexOf(a[0]);
        const idB = executionOrder.indexOf(b[0]);
        if (idA === -1 && idB === -1) return 0;
        if (idA === -1) return 1;
        if (idB === -1) return -1;
        return idA - idB;
      })
    : [];

  return (
    <AnimatePresence>
      {runResults && resultEntries.length > 0 && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 360, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          className="shrink-0 border-l border-border bg-card overflow-hidden"
        >
          <div className="w-[360px] h-full flex flex-col">
            <div className="h-11 flex items-center justify-between px-3 border-b border-border shrink-0 bg-secondary/20">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
                  <BarChart3 size={14} className="text-primary" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-foreground">Run Results</span>
                  <span className="text-[10px] text-muted-foreground ml-1.5">{resultEntries.length} steps</span>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearResults}>
                <X size={12} />
              </Button>
            </div>
            <ScrollArea className="flex-1 p-3">
              <div className="space-y-2">
                {resultEntries.map(([nodeId, result], i) => (
                  <ResultCard
                    key={nodeId}
                    nodeId={nodeId}
                    result={result}
                    nodeLabel={labelMap[nodeId] || nodeId}
                  />
                ))}
              </div>
            </ScrollArea>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
