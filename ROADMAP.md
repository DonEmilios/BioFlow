# BioFlow Production Roadmap

Working backlog of what's needed to take BioFlow from "working demo" to
"production-ready, open-source tool scientists run on their own hardware."
Each section states what exists today, what's missing, and a concrete
implementation sketch — written so a future session (or a contributor) can
pick any item up without re-deriving the design from scratch.

Status tags: ✅ done · 🟡 partial · ⬜ not started

---

## 1. Sandbox layer for custom/untrusted code — 🟡 partial

**What exists today**

- Every node speaks one execution contract regardless of runtime:
  `(params, inputs) -> output JSON`. Three runtimes implement it:
  [`javascript`](server/src/executors/javascriptExecutor.ts) (in-process,
  trusted only), [`process`](server/src/executors/processExecutor.ts) (real
  subprocess, trusted only), and
  [`container`](server/src/executors/containerExecutor.ts) (Docker, the only
  runtime untrusted code may use).
- [`manifest.ts`](server/src/manifest.ts)'s `validateManifest` **enforces**
  this at the schema level: a manifest with `trusted: false` is rejected
  unless `execution.runtime === "container"`. This isn't just a convention —
  it's structurally impossible to register an untrusted node that runs
  unsandboxed.
- Custom nodes created via "Create Node"
  ([`customNodes.ts`](server/src/customNodes.ts)) run in `python:3.11-slim`
  or `r-base:4.3.2`, with `--network none`, capped `--cpus`/`--memory`, and
  the user's script + any connected input files bind-mounted **read-only**.
- If no Docker daemon is reachable, execution **fails closed** with a clear
  error (verified live — see run `run_f01ee1809d9e275e` in session history:
  the sandbox test node's `print()` never ran, no code executed, no silent
  unsandboxed fallback).

**What's missing**

- **No Docker/Apptainer available to test against in this dev environment.**
  Everything above is code-complete and type-checked but has never actually
  run a container. First priority on a machine with Docker: confirm a real
  `docker run` round-trip works end-to-end (mount, network isolation, exit
  code handling, timeout).
- **HPC compatibility.** Real research clusters mostly run
  [Singularity/Apptainer](https://apptainer.org/), not Docker, because Docker
  needs a root daemon that shared HPC systems don't grant users.
  `containerExecutor.ts` hardcodes the `docker` binary today. Needs an
  `execution.runtime: "apptainer"` variant (or a config flag that swaps the
  binary + arg translation — Apptainer's CLI is close enough to Docker's
  that this is mostly argument mapping, not a rewrite).
- **Image digest pinning.** `python:3.11-slim` is a moving tag. For actual
  reproducibility (see §2), base images should be pinned by digest
  (`python:3.11-slim@sha256:...`) once a stable version is chosen.
- **Custom node dependency management.** There's currently no way for a
  custom node to declare `pip install` / `install.packages()` dependencies —
  it's stdlib-or-nothing. The R starter template needs `jsonlite`, which
  isn't in `r-base` by default (flagged directly in the template for now).
  Real fix: accept an optional `requirements.txt` / `DESCRIPTION` alongside
  the script and layer it into an ephemeral image at creation time (`docker
  build` from a small Dockerfile template), cached by dependency-list hash so
  repeat creates don't rebuild.
- **GPU passthrough.** `resources.gpu` exists in the schema but nothing
  reads it yet (`--gpus` flag for Docker, different mechanism for Apptainer).
- **Per-node configurable resource limits.** Currently hardcoded to 1
  CPU / 1GB for every custom node. Needs a UI control (Create Node dialog)
  and validation (don't let a laptop user request 64GB).

---

## 2. Audit trail & experiment reproducibility — ⬜ not started

**Why this matters:** without it, "reproduce this result" is impossible to
answer with confidence — you can't tell whether a re-run used the same code,
the same input bytes, or the same tool versions as the original.

**Current state is actively hostile to this goal.** [`jobQueue.ts`](server/src/jobQueue.ts)'s
run store and [`storage.ts`](server/src/storage.ts)'s upload index are both
plain in-memory `Map`s — proven to vanish on restart *live in this session*
(editing server source under `tsx watch` wiped an uploaded file mid-test).
A run record that doesn't outlive a process restart cannot be an audit trail.

**Design, in dependency order (each step unblocks the next):**

1. **Durable run storage.** SQLite to start (zero ops burden, file-based,
   fine for single-node open-source deploys; swap for Postgres if/when
   multi-user concurrent access matters). Every run ever executed, persisted,
   never overwritten, never deleted. This alone fixes the "lost on restart"
   failure mode.

2. **Content-addressable everything.**
   - Hash uploaded files (SHA-256) at upload time in
     [`storage.ts`](server/src/storage.ts); store the hash alongside the
     existing `{id, filename, path}` record.
   - Hash each custom node's code (SHA-256) at creation time in
     [`customNodes.ts`](server/src/customNodes.ts); embed it in the manifest.
   - Effect: a run record can reference *exact bytes*, not a mutable "latest
     version of node X" pointer. Edit a custom node tomorrow and every past
     run still points at what actually executed.

3. **Self-contained run snapshots.** Each run record embeds the *full*
   resolved graph at execution time — every node's manifest (including its
   code hash and execution runtime), every param value, every input file
   hash. Not references that can drift; a frozen copy. This is what makes a
   run record replayable in isolation, independent of the live node
   registry's current state.

4. **Environment capture.** Record `python3 --version` / `Rscript
   --version` / OS / hostname per node execution, written into the run
   record. Catches "worked on my machine" drift (e.g. a script's behavior
   differing across Python 3.9 vs 3.11) instead of leaving it as a mystery
   later.

5. **Exportable provenance.** A "Download provenance" action on a completed
   run, producing a structured document. Start with plain JSON; the
   longer-term target is [RO-Crate](https://www.researchobject.org/ro-crate/),
   the actual research-software-community standard for "everything needed to
   reproduce this result," machine-readable and citable in a paper's methods
   section.

6. **Reproducibility replay.** Once 1–4 exist, "reproduce run X" is
   mechanical: re-fetch the hash-verified inputs, re-run the frozen manifest
   snapshot's exact code, diff the outputs. Worth a dedicated "Re-run
   (verify)" button once the primitives exist.

**Where to start:** step 1 (durable storage) is the correct entry point —
it's small, it directly fixes a bug you already hit, and every later step
depends on records actually persisting.

---

## 3. HPC & multi-cloud execution backends — ⬜ not started

**Why this matters:** the stated goal is scientists running BioFlow both on
a laptop *and* on institutional clusters / cloud compute. Today, execution
only ever means "spawn a process or container on the machine running the
Node backend" — there is no concept of submitting work elsewhere.

**Design direction:** don't build a scheduler from scratch. The
manifest/executor abstraction already generalizes — adding a new
`execution.runtime` (or a backend-selection layer above it) is exactly how
this should slot in, same pattern as `container` did.

- **HPC (Slurm / PBS):** a new executor that, instead of `spawn()`-ing
  locally, writes a job script and calls `sbatch`/`qsub`, then polls job
  status (`squeue`/`qstat`) until completion, reading output from the
  cluster's shared filesystem. This is the highest-value target for
  "scientist on an institutional cluster" and the most mechanically similar
  to what already exists (still just "run a command, wait, read stdout").
- **AWS:** [AWS Batch](https://aws.amazon.com/batch/) is the natural fit —
  it's literally "submit a containerized job, it runs somewhere, you get
  results," which matches the existing container executor's mental model
  almost exactly. Needs: S3 for input/output staging (replacing local
  filesystem paths in `resolvedFiles`), IAM role scoping per job, and job
  submission/polling via the AWS SDK.
- **Google Cloud:** [Cloud Batch](https://cloud.google.com/batch) (successor
  to the Life Sciences API) — same shape as AWS Batch. GCS for staging.
- **Azure:** [Azure Batch](https://azure.microsoft.com/en-us/products/batch) —
  same shape again. Blob Storage for staging.
- **Common infrastructure needed regardless of provider:**
  - A storage abstraction: today `storage.ts` assumes a local filesystem
    path. Needs an interface (`upload`, `resolve`, `readBytes`) with local,
    S3, GCS, and Azure Blob implementations behind it, selected by config.
  - A "where does this run" decision, either per-pipeline (user picks a
    backend before running) or per-node (a node manifest could declare
    `preferredBackend: "cluster" | "aws" | "local"` for e.g. "this always
    needs a GPU, always send it to AWS Batch with a GPU queue").
  - Credentials/config management — cloud credentials are a real secret-
    handling problem, not just an env var; needs a deliberate design before
    any provider integration ships (never commit credentials, never expose
    them client-side, scope IAM roles tightly per job).
- **Sequencing recommendation:** Slurm/HPC first (smallest infrastructure
  lift, most directly serves "scientist with cluster access," reuses the
  existing "run a command, wait" executor shape almost unchanged), then AWS
  Batch (best-documented, most common default cloud choice), then GCP/Azure
  as the storage abstraction and job-submission pattern are already proven
  out by the first two.

**This should not be attempted without deliberately scoping cloud
credentials, billing, and security boundaries first** — those are
infrastructure/cost decisions, not code decisions.

---

## 4. Other production-readiness items surfaced this session — ⬜ not started

Smaller, but real. Rough priority order:

- **Parallel execution of independent branches.** The DAG orchestrator
  (both [client](src/store/pipelineStore.ts) and
  [server](server/src/orchestrator.ts) copies) runs nodes strictly
  sequentially via Kahn's algorithm, even when two branches have no
  dependency relationship (proven live: File Input → {GC Content, Codon
  Usage Bias} ran one after another, not concurrently). On a multi-core
  laptop or a cluster, this leaves real throughput on the table. Fix: batch-
  execute everything in the current "ready" queue concurrently instead of
  one at a time.
- **Resource-aware scheduling.** `execution.resources` (cpuCores, memoryGb)
  exists in the schema but nothing reads it before deciding whether a node
  can even attempt to run on the current host. A laptop should refuse (or
  warn on) a node declaring 64GB before wasting the user's time.
- **Custom node lifecycle.** Only "create" exists today — no edit, no
  delete, no versioning UI. Combined with §2's content-hashing, "edit" should
  probably mean "create a new version," not mutate in place, to keep past
  runs' provenance intact.
- **Multi-tenant / auth.** No user accounts, no per-user isolation of
  uploads or runs. Fine for single-scientist-on-their-own-laptop; not fine
  the moment BioFlow runs on shared infrastructure with multiple users.
- **Lockfile hygiene.** Both `bun.lock`/`bun.lockb` and `package-lock.json`
  are committed; only npm is actually used (`node_modules/.package-lock.json`
  confirms it). The bun lockfiles are stale after the Supabase removal and
  should probably just be deleted rather than kept in sync with a package
  manager nobody runs.
- **R runtime is untested.** No `Rscript` available in any environment used
  this session. The R execution path (`Rscript <script> <payload>`,
  `commandArgs(trailingOnly = TRUE)[1]` contract) is implemented symmetrically
  with Python but has never actually run. Needs a smoke test wherever R is
  available.
