import { randomBytes, createHash } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, "..", "data", "uploads");

if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

export interface UploadRecord {
  id: string;
  filename: string;
  path: string;
  sha256: string;
  size_bytes: number;
}

const insertStmt = db.prepare(
  `INSERT INTO uploads (id, filename, path, size_bytes, sha256, created_at)
   VALUES (@id, @filename, @path, @size_bytes, @sha256, @created_at)`
);
const selectStmt = db.prepare(`SELECT * FROM uploads WHERE id = ?`);

// Bytes are written to disk; metadata is persisted to SQLite so uploads
// survive a server restart. The sha256 is the content address — the seam for
// reproducibility (a run can reference exact input bytes, not a mutable id).
export function saveUpload(originalName: string, buffer: Buffer): UploadRecord {
  const id = `upload_${randomBytes(8).toString("hex")}`;
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = path.join(UPLOAD_DIR, `${id}-${safeName}`);
  writeFileSync(filePath, buffer);

  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const record: UploadRecord = {
    id,
    filename: originalName,
    path: filePath,
    sha256,
    size_bytes: buffer.length,
  };
  insertStmt.run({ ...record, created_at: new Date().toISOString() });
  return record;
}

export function resolveUpload(id: string): UploadRecord | undefined {
  const row = selectStmt.get(id) as
    | { id: string; filename: string; path: string; sha256: string; size_bytes: number }
    | undefined;
  return row
    ? { id: row.id, filename: row.filename, path: row.path, sha256: row.sha256, size_bytes: row.size_bytes }
    : undefined;
}
