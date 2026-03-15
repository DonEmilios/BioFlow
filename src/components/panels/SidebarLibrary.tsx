import { DragEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as LucideIcons from "lucide-react";
import { Search, ChevronRight } from "lucide-react";
import { nodeRegistry, NODE_CATEGORIES, NodeCategory } from "@/lib/nodeRegistry";
import { useUIStore } from "@/store/uiStore";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useState } from "react";

const categoryOrder: NodeCategory[] = ["input", "process", "database", "ai", "viz", "output"];

export default function SidebarLibrary() {
  const { sidebarSearchQuery, setSidebarSearchQuery } = useUIStore();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(categoryOrder)
  );

  const filteredNodes = nodeRegistry.filter(
    (node) =>
      node.label.toLowerCase().includes(sidebarSearchQuery.toLowerCase()) ||
      node.description.toLowerCase().includes(sidebarSearchQuery.toLowerCase())
  );

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const onDragStart = (event: DragEvent, toolId: string) => {
    event.dataTransfer.setData("application/bioflow-node", toolId);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="w-64 h-full bg-card border-r border-border flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground mb-3">Tool Library</h2>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} strokeWidth={1.5} />
          <Input
            placeholder="Search tools..."
            value={sidebarSearchQuery}
            onChange={(e) => setSidebarSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs bg-secondary border-none"
          />
        </div>
      </div>

      {/* Node list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {categoryOrder.map((cat) => {
          const catNodes = filteredNodes.filter((n) => n.category === cat);
          if (catNodes.length === 0) return null;
          const config = NODE_CATEGORIES[cat];
          const isExpanded = expandedCategories.has(cat);

          return (
            <div key={cat}>
              <button
                onClick={() => toggleCategory(cat)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronRight
                  size={12}
                  className={cn(
                    "transition-transform duration-150",
                    isExpanded && "rotate-90"
                  )}
                />
                <span style={{ color: config.color }} className="w-1.5 h-1.5 rounded-full inline-block" 
                  // Use inline bg
                />
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: config.color }} />
                {config.label}
                <span className="ml-auto text-muted-foreground/60">{catNodes.length}</span>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden"
                  >
                    {catNodes.map((node) => {
                      const Icon = (LucideIcons as any)[node.icon] || LucideIcons.Box;
                      return (
                        <div
                          key={node.id}
                          draggable
                          onDragStart={(e) => onDragStart(e, node.id)}
                          className="flex items-center gap-2.5 px-3 py-2 mx-1 rounded-md cursor-grab active:cursor-grabbing hover:bg-secondary transition-colors duration-150 group"
                        >
                          <Icon size={14} strokeWidth={1.5} className="text-muted-foreground group-hover:text-foreground shrink-0" />
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-foreground truncate">{node.label}</div>
                            <div className="text-[10px] text-muted-foreground truncate">{node.description}</div>
                          </div>
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
