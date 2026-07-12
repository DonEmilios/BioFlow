import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { NodeExecution } from "../manifest.js";
import { ResolvedFile } from "./processExecutor.js";

let dockerAvailable: boolean | null = null;

export function isDockerAvailable(): boolean {
  if (dockerAvailable !== null) return dockerAvailable;
  try {
    const res = spawnSync("docker", ["version", "--format", "{{.Server.Version}}"], { timeout: 3000 });
    dockerAvailable = res.status === 0;
  } catch {
    dockerAvailable = false;
  }
  return dockerAvailable;
}

export interface ContainerExecutorArgs {
  params: Record<string, any>;
  resolvedFiles: ResolvedFile[];
}

// Runs a manifest's container image via the local Docker daemon. Same
// input/output contract as processExecutor: the container receives the JSON
// payload as its final command arg and must print one JSON object to stdout.
// Input files are bind-mounted read-only into /data/inputs so untrusted
// container code never touches the host filesystem directly.
export async function runContainer(
  execution: Extract<NodeExecution, { runtime: "container" }>,
  args: ContainerExecutorArgs
): Promise<any> {
  if (!isDockerAvailable()) {
    throw new Error(
      `Container runtime unavailable: no Docker daemon reachable from this host. ` +
        `Deploy this service where Docker (or a compatible OCI runtime) is present to run "${execution.image}".`
    );
  }

  const mounts: string[] = [];
  const remapped: ResolvedFile[] = args.resolvedFiles.map((f, i) => {
    const containerPath = `/data/inputs/${i}-${path.basename(f.path)}`;
    mounts.push("-v", `${f.path}:${containerPath}:ro`);
    return { ...f, path: containerPath };
  });

  // Custom nodes (Create Node submissions) have no baked image — their code
  // lives on the host and gets mounted in read-only alongside input files,
  // same isolation guarantee as everything else in this container.
  let command = execution.command;
  if (execution.scriptHostPath) {
    const containerScriptPath = `/data/script/${path.basename(execution.scriptHostPath)}`;
    mounts.push("-v", `${execution.scriptHostPath}:${containerScriptPath}:ro`);
    command = [...execution.command, containerScriptPath];
  }

  const payload = JSON.stringify({ params: args.params, resolvedFiles: remapped });

  const dockerArgs = [
    "run",
    "--rm",
    "--network",
    "none",
    "--cpus",
    String(execution.resources.cpuCores),
    "--memory",
    `${execution.resources.memoryGb}g`,
    ...mounts,
    execution.image,
    ...command,
    payload,
  ];

  return new Promise((resolve, reject) => {
    const child = spawn("docker", dockerArgs, { timeout: 60_000 });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Container exited with code ${code}: ${stderr.trim() || "no stderr output"}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch {
        reject(new Error(`Container did not return valid JSON on stdout: ${stdout.slice(0, 200)}`));
      }
    });
  });
}
