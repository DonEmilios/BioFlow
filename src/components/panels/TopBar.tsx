import { Save, FolderOpen, Trash2, Play, PanelLeftClose, PanelLeft, FlaskConical, ChevronDown } from "lucide-react";
import { usePipelineStore } from "@/store/pipelineStore";
import { useUIStore } from "@/store/uiStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ALL_DEMOS } from "@/lib/demoPipeline";

export default function TopBar() {
  const { pipelineName, setPipelineName, savePipeline, loadPipeline, clearPipeline, loadDemo, nodes, isRunning, runPipeline } =
    usePipelineStore();
  const { sidebarOpen, toggleSidebar } = useUIStore();

  return (
    <div className="h-12 bg-card border-b border-border flex items-center px-3 gap-2 shrink-0">
      <button
        onClick={toggleSidebar}
        className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
      >
        {sidebarOpen ? <PanelLeftClose size={16} strokeWidth={1.5} /> : <PanelLeft size={16} strokeWidth={1.5} />}
      </button>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Logo */}
      <div className="flex items-center gap-1.5 mr-3">
        <div className="w-5 h-5 rounded bg-primary flex items-center justify-center">
          <span className="text-[10px] font-bold text-primary-foreground">B</span>
        </div>
        <span className="text-sm font-semibold text-foreground">BioFlow</span>
      </div>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Pipeline name */}
      <Input
        value={pipelineName}
        onChange={(e) => setPipelineName(e.target.value)}
        className="h-7 w-48 text-xs border-none bg-transparent hover:bg-secondary focus:bg-secondary transition-colors font-medium"
      />

      <div className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1.5 text-muted-foreground"
          onClick={async () => {
            try {
              await savePipeline();
              toast.success("Pipeline saved to cloud");
            } catch (e) {
              toast.error("Failed to save pipeline");
            }
          }}
        >
          <Save size={12} strokeWidth={1.5} />
          Save
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1.5 text-muted-foreground"
          onClick={async () => {
            try {
              await loadPipeline();
              toast.success("Pipeline loaded from cloud");
            } catch (e) {
              toast.error("No saved pipeline found");
            }
          }}
        >
          <FolderOpen size={12} strokeWidth={1.5} />
          Load
        </Button>

        {/* Demo dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-muted-foreground"
            >
              <FlaskConical size={12} strokeWidth={1.5} />
              Demo
              <ChevronDown size={10} strokeWidth={1.5} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {ALL_DEMOS.map((demo, i) => (
              <DropdownMenuItem
                key={i}
                onClick={() => {
                  loadDemo(demo.nodes, demo.edges, demo.name);
                  toast.success(`Demo loaded — ${demo.name}`);
                }}
                className="text-xs cursor-pointer"
              >
                <FlaskConical size={12} strokeWidth={1.5} className="mr-2 shrink-0" />
                {demo.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1.5 text-muted-foreground"
          onClick={() => {
            clearPipeline();
            toast.info("Pipeline cleared");
          }}
        >
          <Trash2 size={12} strokeWidth={1.5} />
          Clear
        </Button>

        <div className="w-px h-5 bg-border mx-1" />

        <Button
          size="sm"
          className="h-7 text-xs gap-1.5"
          disabled={nodes.length === 0 || isRunning}
          onClick={async () => {
            toast.info("Running pipeline…");
            try {
              await runPipeline();
              toast.success("Pipeline complete — results ready");
            } catch (e) {
              toast.error("Pipeline run failed");
            }
          }}
        >
          <Play size={12} strokeWidth={1.5} />
          {isRunning ? "Running…" : "Run Pipeline"}
        </Button>
      </div>
    </div>
  );
}
