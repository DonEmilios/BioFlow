import { Router } from "express";
import { submitRun, getRun } from "../jobQueue.js";

export const runsRouter = Router();

runsRouter.post("/", (req, res) => {
  const { nodes, edges } = req.body ?? {};
  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    res.status(400).json({ error: "Request body must include nodes[] and edges[]." });
    return;
  }
  const run = submitRun(nodes, edges);
  res.status(202).json(run);
});

runsRouter.get("/:id", (req, res) => {
  const run = getRun(req.params.id);
  if (!run) {
    res.status(404).json({ error: "Run not found." });
    return;
  }
  res.json(run);
});
