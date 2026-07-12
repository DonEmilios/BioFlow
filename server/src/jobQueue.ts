import { randomBytes } from "node:crypto";
import { DagEdge } from "./dag.js";
import { executeRun, RunNode } from "./orchestrator.js";

export type RunStatus = "queued" | "running" | "complete" | "error";

export interface RunRecord {
  id: string;
  status: RunStatus;
  nodeStatuses: Record<string, string>;
  results: Record<string, any> | null;
  error: string | null;
  createdAt: string;
}

// In-memory run store. One process runs one pipeline at a time here;
// swap for a real queue (BullMQ/SQS) + worker pool to run many runs
// concurrently across machines without changing the HTTP contract below.
const runs = new Map<string, RunRecord>();

export function submitRun(nodes: RunNode[], edges: DagEdge[]): RunRecord {
  const id = `run_${randomBytes(8).toString("hex")}`;
  const record: RunRecord = {
    id,
    status: "queued",
    nodeStatuses: Object.fromEntries(nodes.map((n) => [n.id, "queued"])),
    results: null,
    error: null,
    createdAt: new Date().toISOString(),
  };
  runs.set(id, record);

  record.status = "running";
  executeRun(nodes, edges, (u) => {
    record.nodeStatuses[u.nodeId] = u.status;
  })
    .then((results) => {
      record.results = results;
      const hasError = Object.values(results).some((r: any) => r?.error);
      record.status = hasError ? "error" : "complete";
      if (hasError) {
        const failed = Object.values(results).find((r: any) => r?.error) as any;
        record.error = failed?.error ?? "Pipeline execution failed.";
      }
    })
    .catch((err) => {
      record.status = "error";
      record.error = err.message || String(err);
    });

  return record;
}

export function getRun(id: string): RunRecord | undefined {
  return runs.get(id);
}
