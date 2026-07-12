import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, "..", "data", "uploads");

if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

interface UploadRecord {
  id: string;
  filename: string;
  path: string;
}

// In-memory index of uploaded files for this process's lifetime. Swap for a
// real object-store (S3/GCS) + a durable DB row when this leaves single-node.
const uploads = new Map<string, UploadRecord>();

export function saveUpload(originalName: string, buffer: Buffer): UploadRecord {
  const id = `upload_${randomBytes(8).toString("hex")}`;
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = path.join(UPLOAD_DIR, `${id}-${safeName}`);
  writeFileSync(filePath, buffer);
  const record: UploadRecord = { id, filename: originalName, path: filePath };
  uploads.set(id, record);
  return record;
}

export function resolveUpload(id: string): UploadRecord | undefined {
  return uploads.get(id);
}
