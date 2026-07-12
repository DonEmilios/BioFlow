export type ParamType = "string" | "number" | "select" | "boolean" | "file_ref" | "file_upload";

export interface ParamOption {
  value: string;
  label: string;
}

export interface ParamSchema {
  id: string;
  label: string;
  type: ParamType;
  default: string | number | boolean;
  options?: ParamOption[];
  required: boolean;
  help_text: string;
}

export type NodeCategory = "input" | "process" | "ai" | "database" | "viz" | "output";

// The execution contract: describes HOW a node's logic actually runs.
// Every runtime ultimately exposes the same shape to the orchestrator:
// (params, inputs) -> output JSON. What differs is the isolation boundary.
export type NodeExecution =
  // In-process JS function, looked up by id in the built-in JavaScriptExecutor registry.
  // Fast, zero-isolation — only for trusted, first-party logic.
  | { runtime: "javascript" }
  // Spawns a local script as a child process. The script receives a JSON blob
  // (params + resolved input file paths) on argv[2] and must print a single
  // JSON object to stdout. Real OS-level process isolation, no network by default.
  // Trusted, first-party nodes only — see validateManifest.
  | {
      runtime: "process";
      command: string;
      args?: string[];
    }
  // Runs a container image: no network, capped CPU/memory, read-only input
  // mounts. This is the ONLY runtime untrusted / user-submitted code may use
  // (enforced in validateManifest). scriptHostPath, if set, is bind-mounted
  // read-only into the container and appended to `command` as the final arg
  // before the JSON payload — this is how a node whose code has no baked
  // image (e.g. a Create Node submission) still runs inside one.
  | {
      runtime: "container";
      image: string;
      command: string[];
      scriptHostPath?: string;
      resources: { cpuCores: number; memoryGb: number; gpu?: boolean };
    };

export interface NodeManifest {
  id: string;
  label: string;
  category: NodeCategory;
  description: string;
  icon: string;
  input_types: string[];
  output_types: string[];
  params: ParamSchema[];
  execution: NodeExecution;
  // Marks nodes that were registered outside the built-in set (e.g. via a
  // future "install node" flow). Built-in nodes are trusted; custom nodes
  // are not and must never run with runtime: "javascript".
  trusted: boolean;
}

export function validateManifest(m: NodeManifest): string[] {
  const errors: string[] = [];
  if (!m.id) errors.push("id is required");
  if (!m.execution) errors.push("execution block is required");
  // Sandbox policy: only "container" may run untrusted code. "javascript" runs
  // in-process (no isolation at all) and "process" runs unsandboxed on the
  // host — both are host-trust-level access, so both require trusted: true.
  if ((m.execution?.runtime === "javascript" || m.execution?.runtime === "process") && !m.trusted) {
    errors.push(`runtime "${m.execution.runtime}" is only permitted for trusted, first-party nodes — untrusted code must use runtime: "container"`);
  }
  if (m.execution?.runtime === "container" && !m.execution.resources) {
    errors.push("container execution requires a resources block");
  }
  const ids = new Set<string>();
  for (const p of m.params ?? []) {
    if (ids.has(p.id)) errors.push(`duplicate param id "${p.id}"`);
    ids.add(p.id);
  }
  return errors;
}
