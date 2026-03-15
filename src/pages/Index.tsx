import { AnimatePresence, motion } from "framer-motion";
import PipelineCanvas from "@/components/canvas/PipelineCanvas";
import SidebarLibrary from "@/components/panels/SidebarLibrary";
import ConfigPanel from "@/components/panels/ConfigPanel";
import TopBar from "@/components/panels/TopBar";
import RunBar from "@/components/panels/RunBar";
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

        {/* Canvas */}
        <div className="flex-1 relative">
          <PipelineCanvas />
          <RunBar />
        </div>

        {/* Config Panel */}
        <ConfigPanel />
      </div>
    </div>
  );
};

export default Index;
