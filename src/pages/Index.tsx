import { AnimatePresence, motion } from "framer-motion";
import PipelineCanvas from "@/components/canvas/PipelineCanvas";
import SidebarLibrary from "@/components/panels/SidebarLibrary";
import ConfigPanel from "@/components/panels/ConfigPanel";
import TopBar from "@/components/panels/TopBar";
import RunBar from "@/components/panels/RunBar";
import ResultsPanel from "@/components/panels/ResultsPanel";
import TerminalPanel from "@/components/panels/TerminalPanel";
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from "@/components/ui/resizable";
import { useUIStore } from "@/store/uiStore";

const Index = () => {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background">
      <TopBar />
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 256, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
              className="shrink-0 overflow-hidden"
            >
              <SidebarLibrary />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Workspace (Canvas + Terminal) */}
        <div className="flex-1 flex flex-col relative h-full min-w-0">
          <ResizablePanelGroup direction="vertical">
            <ResizablePanel defaultSize={75} minSize={20} className="relative !overflow-visible flex-col flex">
              <PipelineCanvas />
              <RunBar />
            </ResizablePanel>
            <ResizableHandle withHandle className="bg-border/60 hover:bg-border/80" />
            <ResizablePanel defaultSize={25} minSize={10} className="z-10 bg-background flex flex-col min-h-0">
              <TerminalPanel />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        {/* Config Panel */}
        <ConfigPanel />

        {/* Results Panel */}
        <ResultsPanel />
      </div>
    </div>
  );
};

export default Index;
