import { create } from "zustand";
import {
  Node,
  Edge,
  Connection,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
} from "reactflow";

export interface PipelineNodeData {
  tool: string;
  label: string;
  category: string;
  description: string;
  icon: string;
  params: Record<string, any>;
  status: "idle" | "queued" | "running" | "complete" | "error";
}

interface PipelineState {
  nodes: Node<PipelineNodeData>[];
  edges: Edge[];
  selectedNodeId: string | null;
  pipelineName: string;

  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (node: Node<PipelineNodeData>) => void;
  removeNode: (id: string) => void;
  setSelectedNode: (id: string | null) => void;
  updateNodeParams: (id: string, params: Record<string, any>) => void;
  updateNodeStatus: (id: string, status: PipelineNodeData["status"]) => void;
  setPipelineName: (name: string) => void;
  savePipeline: () => void;
  loadPipeline: () => void;
  clearPipeline: () => void;
  loadDemo: (nodes: Node<PipelineNodeData>[], edges: Edge[], name: string) => void;
}

export const usePipelineStore = create<PipelineState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  pipelineName: "Untitled Pipeline",

  onNodesChange: (changes) =>
    set({ nodes: applyNodeChanges(changes, get().nodes) }),

  onEdgesChange: (changes) =>
    set({ edges: applyEdgeChanges(changes, get().edges) }),

  onConnect: (connection) =>
    set({ edges: addEdge({ ...connection, type: "smoothstep", animated: false }, get().edges) }),

  addNode: (node) => set({ nodes: [...get().nodes, node] }),

  removeNode: (id) =>
    set({
      nodes: get().nodes.filter((n) => n.id !== id),
      edges: get().edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: get().selectedNodeId === id ? null : get().selectedNodeId,
    }),

  setSelectedNode: (id) => set({ selectedNodeId: id }),

  updateNodeParams: (id, params) =>
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, params: { ...n.data.params, ...params } } } : n
      ),
    }),

  updateNodeStatus: (id, status) =>
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, status } } : n
      ),
    }),

  setPipelineName: (name) => set({ pipelineName: name }),

  savePipeline: () => {
    const { nodes, edges, pipelineName } = get();
    localStorage.setItem(
      "bioflow_pipeline",
      JSON.stringify({ nodes, edges, pipelineName })
    );
  },

  loadPipeline: () => {
    const saved = localStorage.getItem("bioflow_pipeline");
    if (saved) {
      const { nodes, edges, pipelineName } = JSON.parse(saved);
      set({ nodes, edges, pipelineName });
    }
  },

  clearPipeline: () =>
    set({ nodes: [], edges: [], selectedNodeId: null, pipelineName: "Untitled Pipeline" }),

  loadDemo: (nodes, edges, name) =>
    set({ nodes, edges, selectedNodeId: null, pipelineName: name }),
}));
