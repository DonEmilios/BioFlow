import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NodeExecution } from "../manifest.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.join(__dirname, "..", "..");

export interface ResolvedFile {
  id: string;
  filename: string;
  path: string;
}

export interface ProcessExecutorArgs {
  params: Record<string, any>;
  resolvedFiles: ResolvedFile[];
}

// Spawns a script as a real OS subprocess. The contract: the script gets one
// argv entry containing the JSON payload, and must print exactly one JSON
// object to stdout. This is the same contract a "container" executor uses
// (see containerExecutor.ts) — swapping runtime: "process" for
// runtime: "container" in a manifest requires no change to the script itself.
export async function runProcess(
  execution: Extract<NodeExecution, { runtime: "process" }>,
  args: ProcessExecutorArgs
): Promise<any> {
  const payload = JSON.stringify({ params: args.params, resolvedFiles: args.resolvedFiles });

  return new Promise((resolve, reject) => {
    const child = spawn(execution.command, [...(execution.args ?? []), payload], {
      cwd: SERVER_ROOT,
      timeout: 30_000,
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Process exited with code ${code}: ${stderr.trim() || "no stderr output"}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch {
        reject(new Error(`Process did not return valid JSON on stdout: ${stdout.slice(0, 200)}`));
      }
    });
  });
}
