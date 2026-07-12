import { NodeRegistryEntry } from "@/lib/nodeRegistry";

const COMPUTE_BACKEND_URL = import.meta.env.VITE_COMPUTE_BACKEND_URL as string | undefined;

export type CustomNodeLanguage = "python" | "r";

export interface CreateCustomNodeInput {
  label: string;
  description: string;
  category: string;
  language: CustomNodeLanguage;
  code: string;
}

interface BackendManifest {
  id: string;
  label: string;
  category: string;
  description: string;
  icon: string;
  input_types: string[];
  output_types: string[];
  params: NodeRegistryEntry["params"];
  trusted: boolean;
}

function requireBackend() {
  if (!COMPUTE_BACKEND_URL) {
    throw new Error("Creating custom nodes requires a compute backend. Set VITE_COMPUTE_BACKEND_URL.");
  }
  return COMPUTE_BACKEND_URL;
}

export async function createCustomNode(input: CreateCustomNodeInput): Promise<NodeRegistryEntry> {
  const base = requireBackend();
  const res = await fetch(`${base}/api/custom-nodes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || "Failed to create node.");
  return manifestToRegistryEntry(body);
}

export async function checkSandboxAvailable(): Promise<boolean | null> {
  if (!COMPUTE_BACKEND_URL) return null;
  try {
    const res = await fetch(`${COMPUTE_BACKEND_URL}/api/health`);
    if (!res.ok) return null;
    const data = await res.json();
    return Boolean(data.dockerAvailable);
  } catch {
    return null;
  }
}

export async function fetchCustomNodes(): Promise<NodeRegistryEntry[]> {
  if (!COMPUTE_BACKEND_URL) return [];
  const res = await fetch(`${COMPUTE_BACKEND_URL}/api/manifests`);
  if (!res.ok) return [];
  const manifests: BackendManifest[] = await res.json();
  return manifests.filter((m) => m.trusted === false).map(manifestToRegistryEntry);
}

function manifestToRegistryEntry(m: BackendManifest): NodeRegistryEntry {
  return {
    id: m.id,
    label: m.label,
    category: m.category as NodeRegistryEntry["category"],
    description: m.description,
    icon: m.icon,
    input_types: m.input_types,
    output_types: m.output_types,
    params: m.params,
  };
}
