import { motion, AnimatePresence } from "framer-motion";
import * as LucideIcons from "lucide-react";
import { X, Sparkles, Trash2 } from "lucide-react";
import { usePipelineStore } from "@/store/pipelineStore";
import { getNodeById, NODE_CATEGORIES, ParamSchema } from "@/lib/nodeRegistry";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

function ParamField({
  param,
  value,
  onChange,
}: {
  param: ParamSchema;
  value: any;
  onChange: (val: any) => void;
}) {
  switch (param.type) {
    case "select":
      return (
        <Select value={String(value)} onValueChange={onChange}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {param.options?.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "boolean":
      return (
        <Switch checked={Boolean(value)} onCheckedChange={onChange} />
      );
    case "number":
      return (
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="h-8 text-xs"
        />
      );
    default:
      return (
        <Input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 text-xs"
          placeholder={param.help_text}
        />
      );
  }
}

export default function ConfigPanel() {
  const { nodes, selectedNodeId, setSelectedNode, updateNodeParams, removeNode } =
    usePipelineStore();

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const registryEntry = selectedNode ? getNodeById(selectedNode.data.tool) : null;

  return (
    <AnimatePresence>
      {selectedNode && registryEntry && (
        <motion.div
          initial={{ x: 320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 320, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          className="w-80 h-full bg-card border-l border-border flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              {(() => {
                const Icon = (LucideIcons as any)[selectedNode.data.icon] || LucideIcons.Box;
                const catConfig = NODE_CATEGORIES[selectedNode.data.category as keyof typeof NODE_CATEGORIES];
                return <Icon size={16} strokeWidth={1.5} style={{ color: catConfig?.color }} />;
              })()}
              <h3 className="text-sm font-semibold text-foreground">{selectedNode.data.label}</h3>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="p-1 rounded-md hover:bg-secondary transition-colors"
            >
              <X size={14} className="text-muted-foreground" />
            </button>
          </div>

          {/* AI Guidance callout */}
          <div className="mx-4 mt-4 p-3 rounded-md bg-accent/10 border border-accent/20">
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles size={12} className="text-accent" />
              <span className="text-[10px] font-medium text-accent uppercase tracking-wider">AI Guidance</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {registryEntry.description}
            </p>
          </div>

          {/* Parameters */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Parameters
            </div>
            {registryEntry.params.map((param) => (
              <div key={param.id} className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1">
                  {param.label}
                  {param.required && <span className="text-destructive">*</span>}
                </Label>
                <ParamField
                  param={param}
                  value={selectedNode.data.params[param.id]}
                  onChange={(val) =>
                    updateNodeParams(selectedNode.id, { [param.id]: val })
                  }
                />
                <p className="text-[10px] text-muted-foreground">{param.help_text}</p>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-border">
            <Button
              variant="destructive"
              size="sm"
              className="w-full text-xs"
              onClick={() => {
                removeNode(selectedNode.id);
                setSelectedNode(null);
              }}
            >
              <Trash2 size={12} />
              Remove Node
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
