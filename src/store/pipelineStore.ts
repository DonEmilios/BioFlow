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
import { savePipelineToDb, loadPipelineFromDb, runPipeline } from "@/lib/pipelineApi";

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
  pipelineDbId: string | null;
  isRunning: boolean;
  runResults: Record<string, any> | null;

  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (node: Node<PipelineNodeData>) => void;
  removeNode: (id: string) => void;
  setSelectedNode: (id: string | null) => void;
  updateNodeParams: (id: string, params: Record<string, any>) => void;
  updateNodeStatus: (id: string, status: PipelineNodeData["status"]) => void;
  setPipelineName: (name: string) => void;
  savePipeline: () => Promise<void>;
  loadPipeline: () => Promise<void>;
  clearPipeline: () => void;
  loadDemo: (nodes: Node<PipelineNodeData>[], edges: Edge[], name: string) => void;
  runPipeline: () => Promise<void>;
  clearResults: () => void;
}

export const usePipelineStore = create<PipelineState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  pipelineName: "Untitled Pipeline",
  pipelineDbId: null,
  isRunning: false,
  runResults: null,

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

  savePipeline: async () => {
    const { nodes, edges, pipelineName, pipelineDbId } = get();
    const saved = await savePipelineToDb(pipelineName, nodes, edges, pipelineDbId || undefined);
    set({ pipelineDbId: saved.id });
  },

  loadPipeline: async () => {
    const data = await loadPipelineFromDb();
    if (data) {
      set({
        nodes: data.nodes as unknown as Node<PipelineNodeData>[],
        edges: data.edges as unknown as Edge[],
        pipelineName: data.name,
        pipelineDbId: data.id,
      });
    }
  },

  clearPipeline: () =>
    set({ nodes: [], edges: [], selectedNodeId: null, pipelineName: "Untitled Pipeline", pipelineDbId: null, runResults: null }),

  loadDemo: (nodes, edges, name) =>
    set({ nodes, edges, selectedNodeId: null, pipelineName: name, pipelineDbId: null, runResults: null }),

  runPipeline: async () => {
    const { nodes, edges, pipelineDbId } = get();
    if (nodes.length === 0) return;

    set({ isRunning: true, runResults: null });

    // Set all nodes to queued
    set({
      nodes: get().nodes.map((n) => ({
        ...n,
        data: { ...n.data, status: "queued" as const },
      })),
    });

    // Animate nodes one by one, animate edges leading to current node
    const nodeIds = nodes.map((n) => n.id);
    for (let i = 0; i < nodeIds.length; i++) {
      const currentId = nodeIds[i];
      await new Promise((r) => setTimeout(r, 400));
      // Set node to running + animate incoming edges
      set({
        nodes: get().nodes.map((n) =>
          n.id === currentId ? { ...n, data: { ...n.data, status: "running" as const } } : n
        ),
        edges: get().edges.map((e) =>
          e.target === currentId ? { ...e, animated: true } : e
        ),
      });
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));
      // Set node to complete + stop animating its incoming edges
      set({
        nodes: get().nodes.map((n) =>
          n.id === currentId ? { ...n, data: { ...n.data, status: "complete" as const } } : n
        ),
        edges: get().edges.map((e) =>
          e.target === currentId ? { ...e, animated: false } : e
        ),
      });
    }

    // Call edge function for real results
    try {
      const result = await runPipeline(pipelineDbId, nodes, edges);
      set({ runResults: result.results, isRunning: false });
    } catch (err) {
      console.error("Run pipeline failed:", err);
      set({ isRunning: false });
    }
  },

  clearResults: () => set({ runResults: null }),
}));
