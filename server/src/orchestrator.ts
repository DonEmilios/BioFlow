import { topologicalSort, DagEdge } from "./dag.js";
import { getManifest } from "./manifests/index.js";
import { javascriptExecutors } from "./executors/javascriptExecutor.js";
import { runProcess, ResolvedFile } from "./executors/processExecutor.js";
import { runContainer } from "./executors/containerExecutor.js";
import { resolveUpload } from "./storage.js";

export interface RunNode {
  id: string;
  data: { tool: string; params: Record<string, any>; label?: string };
}

export interface NodeStatusUpdate {
  nodeId: string;
  status: "running" | "complete" | "error";
}

// Scans an upstream output for any `files: string[]` (upload ids) and
// resolves them to real on-disk paths. Only relevant for process/container
// runtimes, which need actual bytes rather than in-memory JS objects.
function resolveFilesFromInputs(inputs: Record<string, any>): ResolvedFile[] {
  const resolved: ResolvedFile[] = [];
  for (const key in inputs) {
    const files = inputs[key]?.files;
    if (Array.isArray(files)) {
      for (const id of files) {
        const rec = resolveUpload(id);
        if (rec) resolved.push(rec);
      }
    }
  }
  return resolved;
}

export async function executeRun(
  nodes: RunNode[],
  edges: DagEdge[],
  onStatus: (u: NodeStatusUpdate) => void
): Promise<Record<string, any>> {
  const order = topologicalSort(nodes, edges);
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const nodeOutputs: Record<string, any> = {};
  const results: Record<string, any> = {};

  for (const nodeId of order) {
    const node = nodeMap.get(nodeId)!;
    const toolId = node.data.tool;
    const params = node.data.params ?? {};
    const manifest = getManifest(toolId);

    const parentEdges = edges.filter((e) => e.target === nodeId);
    const inputsForNode: Record<string, any> = {};
    parentEdges.forEach((e) => {
      if (nodeOutputs[e.source]) inputsForNode[e.source] = nodeOutputs[e.source];
    });

    onStatus({ nodeId, status: "running" });

    try {
      let output: any;

      if (!manifest || manifest.execution.runtime === "javascript") {
        const executor = javascriptExecutors[toolId] || javascriptExecutors.default;
        output = await executor({ params, inputs: inputsForNode });
      } else if (manifest.execution.runtime === "process") {
        const resolvedFiles = resolveFilesFromInputs(inputsForNode);
        output = await runProcess(manifest.execution, { params, resolvedFiles });
      } else if (manifest.execution.runtime === "container") {
        const resolvedFiles = resolveFilesFromInputs(inputsForNode);
        output = await runContainer(manifest.execution, { params, resolvedFiles });
      } else {
        throw new Error(`Unknown execution runtime for tool "${toolId}"`);
      }

      nodeOutputs[nodeId] = output;
      results[nodeId] = { tool: toolId, label: node.data.label || toolId, ...output };
      onStatus({ nodeId, status: "complete" });
    } catch (err: any) {
      results[nodeId] = { error: err.message || String(err) };
      onStatus({ nodeId, status: "error" });
      break;
    }
  }

  return results;
}
