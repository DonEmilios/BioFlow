import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NodeManifest, NodeCategory, validateManifest } from "./manifest.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CUSTOM_NODE_DIR = path.join(__dirname, "..", "data", "custom-nodes");

if (!existsSync(CUSTOM_NODE_DIR)) mkdirSync(CUSTOM_NODE_DIR, { recursive: true });

export type CustomNodeLanguage = "python" | "r";

// Minimal, well-known base images — no proprietary code is ever baked into
// an image; the user's script is bind-mounted in at run time (see
// containerExecutor.ts's scriptHostPath handling). Pin digests here once
// you're ready to freeze these for reproducibility (see ROADMAP.md).
const LANGUAGE_CONFIG: Record<CustomNodeLanguage, { command: string; filename: string; image: string }> = {
  python: { command: "python3", filename: "main.py", image: "python:3.11-slim" },
  r: { command: "Rscript", filename: "main.R", image: "r-base:4.3.2" },
};

const VALID_CATEGORIES: NodeCategory[] = ["input", "process", "ai", "database", "viz", "output"];
const MAX_CODE_BYTES = 200_000;

export interface CreateCustomNodeInput {
  label: string;
  description?: string;
  category?: string;
  language: string;
  code: string;
}

function slugify(label: string): string {
  const base = label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return (base || "custom_node") + "_" + randomBytes(4).toString("hex");
}

// Custom nodes execute arbitrary user-submitted code inside a Docker
// container: no network, capped CPU/memory, read-only mounts for the script
// and any connected input files (see containerExecutor.ts). If no Docker
// daemon is reachable on this host, the run fails closed with a clear error
// — it never silently falls back to unsandboxed execution.
export function createCustomNode(input: CreateCustomNodeInput): NodeManifest {
  const label = input.label?.trim();
  if (!label) throw new Error("Node name is required.");

  const language = input.language as CustomNodeLanguage;
  if (language !== "python" && language !== "r") {
    throw new Error('Language must be "python" or "r".');
  }

  const code = input.code ?? "";
  if (!code.trim()) throw new Error("Code cannot be empty.");
  if (Buffer.byteLength(code, "utf8") > MAX_CODE_BYTES) {
    throw new Error(`Code exceeds the ${MAX_CODE_BYTES / 1000}KB limit.`);
  }

  const category: NodeCategory = VALID_CATEGORIES.includes(input.category as NodeCategory)
    ? (input.category as NodeCategory)
    : "process";

  const id = slugify(label);
  const { command, filename, image } = LANGUAGE_CONFIG[language];

  const nodeDir = path.join(CUSTOM_NODE_DIR, id);
  mkdirSync(nodeDir, { recursive: true });
  const scriptPath = path.join(nodeDir, filename);
  writeFileSync(scriptPath, code, "utf8");

  const manifest: NodeManifest = {
    id,
    label,
    category,
    description: input.description?.trim() || `Custom ${language === "python" ? "Python" : "R"} node.`,
    icon: "Code2",
    input_types: ["json"],
    output_types: ["json"],
    params: [],
    execution: {
      runtime: "container",
      image,
      command: [command],
      scriptHostPath: scriptPath,
      resources: { cpuCores: 1, memoryGb: 1 },
    },
    trusted: false,
  };

  const errors = validateManifest(manifest);
  if (errors.length) throw new Error(`Invalid node: ${errors.join(", ")}`);

  customManifests.set(id, manifest);
  return manifest;
}

const customManifests = new Map<string, NodeManifest>();

export function getCustomManifest(id: string): NodeManifest | undefined {
  return customManifests.get(id);
}

export function listCustomManifests(): NodeManifest[] {
  return Array.from(customManifests.values());
}
