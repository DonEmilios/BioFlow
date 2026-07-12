import { Node, Edge } from "reactflow";
import { PipelineNodeData } from "@/store/pipelineStore";
import { executePipeline } from "@/lib/pipelineExecutor";
import { v4Fallback } from "@/lib/idgen";

const STORAGE_KEY = "bioflow-saved-pipelines";
const COMPUTE_BACKEND_URL = import.meta.env.VITE_COMPUTE_BACKEND_URL as string | undefined;

interface SavedPipeline {
  id: string;
  name: string;
  nodes: Node<PipelineNodeData>[];
  edges: Edge[];
  updated_at: string;
}

function readSavedPipelines(): SavedPipeline[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeSavedPipelines(pipelines: SavedPipeline[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pipelines));
}

export async function savePipelineToDb(
  name: string,
  nodes: Node<PipelineNodeData>[],
  edges: Edge[],
  existingId?: string
) {
  const pipelines = readSavedPipelines();
  const now = new Date().toISOString();

  if (existingId) {
    const idx = pipelines.findIndex((p) => p.id === existingId);
    if (idx !== -1) {
      pipelines[idx] = { ...pipelines[idx], name, nodes, edges, updated_at: now };
      writeSavedPipelines(pipelines);
      return pipelines[idx];
    }
  }

  const saved: SavedPipeline = { id: v4Fallback(), name, nodes, edges, updated_at: now };
  pipelines.push(saved);
  writeSavedPipelines(pipelines);
  return saved;
}

export async function loadPipelineFromDb() {
  const pipelines = readSavedPipelines();
  if (pipelines.length === 0) throw new Error("No saved pipeline found");
  return pipelines.slice().sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
}

async function runOnComputeBackend(nodes: Node<PipelineNodeData>[], edges: Edge[]) {
  const submitRes = await fetch(`${COMPUTE_BACKEND_URL}/api/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nodes, edges }),
  });
  if (!submitRes.ok) throw new Error(`Compute backend rejected run: ${submitRes.statusText}`);
  const { id } = await submitRes.json();

  // Poll until the backend reports the run finished. A future iteration
  // could replace this with SSE/WebSocket for live per-node status.
  for (;;) {
    await new Promise((r) => setTimeout(r, 500));
    const pollRes = await fetch(`${COMPUTE_BACKEND_URL}/api/runs/${id}`);
    if (!pollRes.ok) throw new Error(`Failed to poll run status: ${pollRes.statusText}`);
    const run = await pollRes.json();
    if (run.status === "complete" || run.status === "error") {
      return { run_id: id, status: run.status, results: run.results ?? {} };
    }
  }
}

export async function runPipeline(
  _pipelineId: string | null,
  nodes: Node<PipelineNodeData>[],
  edges: Edge[]
) {
  if (COMPUTE_BACKEND_URL) {
    try {
      return await runOnComputeBackend(nodes, edges);
    } catch (err) {
      console.error("Compute backend run failed, falling back to local execution:", err);
    }
  }

  const { results } = await executePipeline(nodes, edges);
  return { run_id: v4Fallback(), status: "complete", results };
}
