import { create } from "zustand";
import { persist } from "zustand/middleware";
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

export interface PipelineLog {
  timestamp: string;
  message: string;
}

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
  executionOrder: string[];
  logs: PipelineLog[];

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
  addLog: (msg: string) => void;
  clearLogs: () => void;
}

export const usePipelineStore = create<PipelineState>()(
  persist(
    (set, get) => ({
      nodes: [],
      edges: [],
  selectedNodeId: null,
  pipelineName: "Untitled Pipeline",
  pipelineDbId: null,
  isRunning: false,
  runResults: null,
  executionOrder: [],
  logs: [],

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

    set({ isRunning: true, runResults: null, executionOrder: [], logs: [] });
    get().addLog("Initializing pipeline execution...");
    get().addLog("Building graph adjacency list...");

    // Set all nodes to queued
    set({
      nodes: get().nodes.map((n) => ({
        ...n,
        data: { ...n.data, status: "queued" as const },
      })),
    });

    get().addLog("Performing topological sort (Kahn's Algorithm)...");

    // 1. Topological Sort (Kahn's Algorithm)
    const adjList: Record<string, string[]> = {};
    const inDegree: Record<string, number> = {};

    nodes.forEach((n) => {
      adjList[n.id] = [];
      inDegree[n.id] = 0;
    });

    edges.forEach((e) => {
      if (adjList[e.source] && inDegree[e.target] !== undefined) {
        adjList[e.source].push(e.target);
        inDegree[e.target]++;
      }
    });

    const queue: string[] = [];
    nodes.forEach((n) => {
      if (inDegree[n.id] === 0) queue.push(n.id);
    });

    const executionOrder: string[] = [];
    while (queue.length > 0) {
      const u = queue.shift()!;
      executionOrder.push(u);

      adjList[u].forEach((v) => {
        inDegree[v]--;
        if (inDegree[v] === 0) {
          queue.push(v);
        }
      });
    }

    // Fallback to strict array order if there's a cycle detected
    const finalNodeIds = executionOrder.length === nodes.length ? executionOrder : nodes.map((n) => n.id);
    set({ executionOrder: finalNodeIds });
    get().addLog(`Execution order calculated: ${finalNodeIds.join(" -> ")}`);

    // Animate nodes one by one in dependency order, animate edges leading to current node
    for (let i = 0; i < finalNodeIds.length; i++) {
      const currentId = finalNodeIds[i];
      const nodeLabel = get().nodes.find(n => n.id === currentId)?.data.label || currentId;
      get().addLog(`Executing: ${nodeLabel}`);

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
      get().addLog(`Completed: ${nodeLabel}`);
    }

    // Call edge function for real results
    try {
      get().addLog(`Submitting payload to BioFlow backend for processing...`);
      const result = await runPipeline(pipelineDbId, nodes, edges);
      get().addLog(`Pipeline execution finished successfully.`);
      set({ runResults: result.results, isRunning: false });
    } catch (err) {
      console.error("Run pipeline failed:", err);
      get().addLog(`Pipeline execution failed: ${err}`);
      set({ isRunning: false });
    }
  },

  clearResults: () => set({ runResults: null }),
  
  addLog: (msg) =>
    set((state) => ({
      logs: [...state.logs, { timestamp: new Date().toISOString(), message: msg }],
    })),

  clearLogs: () => set({ logs: [] }),
    }),
    {
      name: "pipeline-storage",
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
        selectedNodeId: state.selectedNodeId,
        pipelineName: state.pipelineName,
        pipelineDbId: state.pipelineDbId,
        runResults: state.runResults,
        executionOrder: state.executionOrder,
        logs: state.logs,
      }),
    }
  )
);
