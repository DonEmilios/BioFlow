# BioFlow

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

**A visual, no-code-first pipeline builder for bioinformatics — with a real code escape hatch when you need one.**

BioFlow lets you assemble bioinformatics workflows — QC, alignment, differential expression, visualization — by dragging nodes onto a canvas and connecting them, the way you'd sketch the pipeline on a whiteboard. No script to write, no environment to configure by hand, no remembering CLI flags for a dozen different tools.

## Why BioFlow exists

A huge amount of bioinformatics knowledge lives in wet-lab scientists' heads, not in code. They know exactly what analysis they need — "trim these reads, align them, call differential expression, show me a volcano plot" — but turning that into a working pipeline usually means learning a scripting language, wrangling `conda` environments, or waiting on a bioinformatics core with its own backlog.

BioFlow's bet is that the *pipeline* — the DAG of steps, the parameters, the data flowing between them — is a visual problem, not a programming problem. You shouldn't need to write a for-loop to say "run FastQC on these reads, then trim them, then align them." The canvas *is* the program.

That's the "no-code" half of the mission.

## "No-code (if you want)"

The other half is being honest about where no-code stops working: **novel analysis**. BioFlow ships a library of common bioinformatics tools out of the box, but nobody can pre-build every algorithm a lab will ever need — especially not proprietary or lab-specific methods. So BioFlow has a **Create Node** feature: paste or import a Python or R script, and it becomes a node on the canvas like any other, wired into the same drag-and-connect graph.

This is why the "if you want" matters. Building pipelines out of existing nodes requires zero coding. Extending BioFlow with your own algorithm requires knowing enough Python or R to write a script that reads a JSON payload and prints a JSON result — a low bar for anyone with research-coding experience, but a real one. BioFlow is designed so that bar is the *only* one: you write the science, not the plumbing, sandboxing, or UI.

## What's actually built today

This is an early-stage, actively-developed project. Here's what genuinely works right now, not aspirational marketing copy:

- **Visual pipeline canvas** — drag nodes from a categorized library (Input, Process, Database, Visualization, Output, AI), connect them, configure per-node parameters, run the graph. Execution order is derived automatically via topological sort — the canvas won't let you build a cycle.
- **A real compute backend** ([`server/`](server/)) — pipelines don't just render an animation; nodes actually execute. A handful of built-in nodes do genuine computation today (GC-content calculation from real uploaded FASTA/FASTQ files, live NCBI Entrez lookups); the heavier bioinformatics tools (STAR, BLAST, DESeq2, etc.) are realistic-but-mocked placeholders until real toolchain integration lands — see [ROADMAP.md](ROADMAP.md) for exactly what's real vs. simulated.
- **Create Node** — import Python or R code as a first-class pipeline node. Custom code runs inside a network-isolated, resource-capped Docker container, never on the host directly — see [Security](#security--sandboxing) below.
- **Runs entirely on your own hardware.** No cloud account, no external service dependency, no data leaving your machine unless a node explicitly calls out (e.g. the NCBI lookup node).

## Who this is for

- **Wet-lab scientists / bench researchers** who know their analysis but don't want to write or maintain scripts: use the built-in node library, no coding required.
- **Bioinformaticians and computational biologists** with existing scripts or proprietary lab methods: wrap them as Create Node entries and reuse them visually across pipelines, without rewriting them as "BioFlow nodes" from scratch.
- **Contributors** who want to expand the built-in node library, wire up a real execution backend for a heavy tool, or help with the production-readiness backlog in [ROADMAP.md](ROADMAP.md).

## Architecture, briefly

- **Frontend** — React + TypeScript + Vite, [React Flow](https://reactflow.dev) for the canvas, Zustand for state, shadcn/ui + Tailwind for the interface.
- **Compute backend** — a small Express/TypeScript service ([`server/`](server/)) that owns the DAG orchestrator, the node manifest registry (built-in and custom), file uploads, and job execution. It's intentionally simple right now (in-memory job store, single-node) — see ROADMAP.md for the durability and scale-out plan.
- **Node manifest contract** — every node, built-in or custom, speaks one interface regardless of how it's implemented: `(params, inputs) -> output JSON`. What differs is the execution runtime (`javascript` in-process, `process` for trusted first-party scripts, `container` for sandboxed/untrusted code). This is what makes Create Node possible without special-casing user code anywhere in the orchestrator.

## Security & sandboxing

Worth reading before you self-host this anywhere shared:

- Built-in nodes run as trusted, first-party code (in-process or as a local subprocess).
- **Custom nodes (Create Node) are required to run inside a Docker container** — no network access, capped CPU/memory, read-only mounts for the script and its input files. This is enforced at the manifest-validation level, not just convention: an untrusted node cannot be registered with an unsandboxed execution runtime.
- If no Docker daemon is available on the machine running the compute backend, custom node runs **fail closed** with a clear error — they never silently fall back to running unsandboxed.
- That said: this is a young security model, not an audited one. If you're deploying BioFlow somewhere multiple people can submit code, read [ROADMAP.md](ROADMAP.md) §1 and §4 first — multi-tenant isolation and auth aren't built yet.

## Getting started

Requirements: Node.js 20+, npm, and Docker (only needed if you plan to use Create Node).

```sh
# Clone
git clone https://github.com/DonEmilios/bioflow-ai-canvas.git
cd bioflow-ai-canvas

# Frontend
npm install
cp .env.example .env
npm run dev            # http://localhost:8080

# Compute backend (separate terminal)
cd server
npm install
npm run dev             # http://localhost:8787
```

The frontend works with the compute backend offline too — it falls back to in-browser mock execution — but real file uploads, real computation, and Create Node all require the backend running.

## Roadmap

The honest list of what's missing before this is genuinely production-ready — durable run storage, an audit trail for experiment reproducibility, HPC/cloud execution (Slurm, AWS Batch, GCP, Azure), and more — lives in [ROADMAP.md](ROADMAP.md). If you're looking for a way to contribute, that's the best place to start.

## Contributing

Issues and PRs welcome. If you're adding a new built-in node, extending a node's real (non-mocked) execution logic, or picking up something from ROADMAP.md, open an issue first so effort doesn't collide.

## License

See [LICENSE](LICENSE).
