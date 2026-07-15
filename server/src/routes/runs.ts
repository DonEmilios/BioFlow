import { Router } from "express";
import { submitRun, getRun, listRecentRuns } from "../jobQueue.js";

export const runsRouter = Router();

runsRouter.post("/", (req, res) => {
  const { nodes, edges, pipeline_name } = req.body ?? {};
  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    res.status(400).json({ error: "Request body must include nodes[] and edges[]." });
    return;
  }
  const run = submitRun(nodes, edges, typeof pipeline_name === "string" ? pipeline_name : undefined);
  res.status(202).json(run);
});

// Persisted run history — survives restarts.
runsRouter.get("/", (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 25, 100);
  res.json(listRecentRuns(limit));
});

runsRouter.get("/:id", (req, res) => {
  const run = getRun(req.params.id);
  if (!run) {
    res.status(404).json({ error: "Run not found." });
    return;
  }
  res.json(run);
});
