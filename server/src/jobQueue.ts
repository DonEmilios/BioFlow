import { randomBytes } from "node:crypto";
import { DagEdge } from "./dag.js";
import { executeRun, RunNode } from "./orchestrator.js";
import { db } from "./db.js";

export type RunStatus = "queued" | "running" | "complete" | "error";

export interface RunRecord {
  id: string;
  status: RunStatus;
  pipelineName: string | null;
  nodeStatuses: Record<string, string>;
  results: Record<string, any> | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface RunRow {
  id: string;
  status: RunStatus;
  pipeline_name: string | null;
  node_statuses: string;
  results: string | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

const insertRun = db.prepare(
  `INSERT INTO runs (id, status, pipeline_name, node_statuses, results, error, graph, created_at, completed_at)
   VALUES (@id, @status, @pipeline_name, @node_statuses, @results, @error, @graph, @created_at, @completed_at)`
);
const updateStatuses = db.prepare(`UPDATE runs SET node_statuses = @node_statuses WHERE id = @id`);
const finalizeRun = db.prepare(
  `UPDATE runs SET status = @status, results = @results, error = @error,
   node_statuses = @node_statuses, completed_at = @completed_at WHERE id = @id`
);
const selectRun = db.prepare(`SELECT * FROM runs WHERE id = ?`);
const selectRecent = db.prepare(
  `SELECT id, status, pipeline_name, created_at, completed_at FROM runs ORDER BY created_at DESC LIMIT ?`
);

function rowToRecord(row: RunRow): RunRecord {
  return {
    id: row.id,
    status: row.status,
    pipelineName: row.pipeline_name,
    nodeStatuses: JSON.parse(row.node_statuses),
    results: row.results ? JSON.parse(row.results) : null,
    error: row.error,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

// Persists the run before executing so it survives a restart, records a
// snapshot of the exact graph that ran (reproducibility groundwork), and
// writes each node-status transition through to the DB so a polling client
// sees live progress. Execution stays async/fire-and-forget; the HTTP contract
// is unchanged. One run at a time per process — swap this for a real queue
// (BullMQ/SQS) + worker pool when concurrent multi-run scale is needed.
export function submitRun(nodes: RunNode[], edges: DagEdge[], pipelineName?: string): RunRecord {
  const id = `run_${randomBytes(8).toString("hex")}`;
  const nodeStatuses: Record<string, string> = Object.fromEntries(nodes.map((n) => [n.id, "queued"]));
  const createdAt = new Date().toISOString();

  insertRun.run({
    id,
    status: "running",
    pipeline_name: pipelineName ?? null,
    node_statuses: JSON.stringify(nodeStatuses),
    results: null,
    error: null,
    graph: JSON.stringify({ nodes, edges }),
    created_at: createdAt,
    completed_at: null,
  });

  executeRun(nodes, edges, (u) => {
    nodeStatuses[u.nodeId] = u.status;
    updateStatuses.run({ id, node_statuses: JSON.stringify(nodeStatuses) });
  })
    .then((results) => {
      const failed = Object.values(results).find((r: any) => r?.error) as any;
      finalizeRun.run({
        id,
        status: failed ? "error" : "complete",
        results: JSON.stringify(results),
        error: failed ? failed.error ?? "Pipeline execution failed." : null,
        node_statuses: JSON.stringify(nodeStatuses),
        completed_at: new Date().toISOString(),
      });
    })
    .catch((err) => {
      finalizeRun.run({
        id,
        status: "error",
        results: null,
        error: err.message || String(err),
        node_statuses: JSON.stringify(nodeStatuses),
        completed_at: new Date().toISOString(),
      });
    });

  return getRun(id)!;
}

export function getRun(id: string): RunRecord | undefined {
  const row = selectRun.get(id) as RunRow | undefined;
  return row ? rowToRecord(row) : undefined;
}

export function listRecentRuns(limit = 25): Array<Pick<RunRecord, "id" | "status" | "pipelineName" | "createdAt" | "completedAt">> {
  const rows = selectRecent.all(limit) as Array<Omit<RunRow, "node_statuses" | "results" | "error">>;
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    pipelineName: r.pipeline_name,
    createdAt: r.created_at,
    completedAt: r.completed_at,
  }));
}
