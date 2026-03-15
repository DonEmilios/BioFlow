import { useCallback, useRef, DragEvent } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  ReactFlowProvider,
  ReactFlowInstance,
} from "reactflow";
import "reactflow/dist/style.css";
import { usePipelineStore } from "@/store/pipelineStore";
import { getNodeById } from "@/lib/nodeRegistry";
import BioFlowNode from "./BioFlowNode";
import { v4Fallback } from "@/lib/idgen";

const nodeTypes = {
  bioflow: BioFlowNode,
};

function PipelineCanvasInner() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    setSelectedNode,
  } = usePipelineStore();

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const toolId = event.dataTransfer.getData("application/bioflow-node");
      if (!toolId || !reactFlowInstance.current || !reactFlowWrapper.current) return;

      const registryEntry = getNodeById(toolId);
      if (!registryEntry) return;

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance.current.project({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });

      const defaultParams: Record<string, any> = {};
      registryEntry.params.forEach((p) => {
        defaultParams[p.id] = p.default;
      });

      const newNode = {
        id: v4Fallback(),
        type: "bioflow",
        position,
        data: {
          tool: registryEntry.id,
          label: registryEntry.label,
          category: registryEntry.category,
          description: registryEntry.description,
          icon: registryEntry.icon,
          params: defaultParams,
          status: "idle" as const,
        },
      };

      addNode(newNode);
    },
    [addNode]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, [setSelectedNode]);

  return (
    <div ref={reactFlowWrapper} className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={(instance) => {
          reactFlowInstance.current = instance;
        }}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={{ type: "smoothstep", animated: false }}
        fitView
        snapToGrid
        snapGrid={[20, 20]}
        className="bg-canvas"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsl(210, 20%, 85%)" />
        <Controls />
        <MiniMap
          nodeStrokeWidth={3}
          pannable
          zoomable
          style={{ backgroundColor: "hsl(210, 20%, 98%)" }}
        />
      </ReactFlow>
    </div>
  );
}

export default function PipelineCanvas() {
  return (
    <ReactFlowProvider>
      <PipelineCanvasInner />
    </ReactFlowProvider>
  );
}
