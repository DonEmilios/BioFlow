import Database from "better-sqlite3";
import { mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const DB_PATH = path.join(DATA_DIR, "bioflow.db");

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

// Single-node, embedded, durable. SQLite is the right default for a local
// tool: zero operational burden, ACID, survives restarts, and queryable for
// run history. WAL mode gives us concurrent reads while a run is being
// written. When BioFlow needs multi-node/concurrent-user scale, the storage
// interfaces below are the seam to swap for Postgres — the callers don't care.
export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Schema is create-if-not-exists and additive; safe to run on every boot.
// The sha256 / graph columns exist so a run record is self-describing enough
// to support reproducibility work later (what code + what inputs produced
// this result) without another migration.
db.exec(`
  CREATE TABLE IF NOT EXISTS uploads (
    id          TEXT PRIMARY KEY,
    filename    TEXT NOT NULL,
    path        TEXT NOT NULL,
    size_bytes  INTEGER NOT NULL DEFAULT 0,
    sha256      TEXT,
    created_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS custom_nodes (
    id           TEXT PRIMARY KEY,
    manifest     TEXT NOT NULL,
    code_sha256  TEXT,
    created_at   TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS runs (
    id             TEXT PRIMARY KEY,
    status         TEXT NOT NULL,
    pipeline_name  TEXT,
    node_statuses  TEXT NOT NULL,
    results        TEXT,
    error          TEXT,
    graph          TEXT,
    created_at     TEXT NOT NULL,
    completed_at   TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_runs_created_at ON runs (created_at DESC);
`);

export function countRows(table: "uploads" | "custom_nodes" | "runs"): number {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number };
  return row.n;
}
