import { Router } from "express";
import { createCustomNode } from "../customNodes.js";

export const customNodesRouter = Router();

customNodesRouter.post("/", (req, res) => {
  try {
    const manifest = createCustomNode(req.body ?? {});
    res.status(201).json(manifest);
  } catch (err: any) {
    res.status(400).json({ error: err.message || String(err) });
  }
});
