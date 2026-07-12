import { Router, raw } from "express";
import { saveUpload } from "../storage.js";

export const uploadsRouter = Router();

// Raw binary body, filename passed via header to avoid pulling in a
// multipart parser for a single-file MVP endpoint.
uploadsRouter.post("/", raw({ type: "*/*", limit: "100mb" }), (req, res) => {
  const filename = req.header("x-filename");
  if (!filename) {
    res.status(400).json({ error: "Missing X-Filename header." });
    return;
  }
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    res.status(400).json({ error: "Empty request body." });
    return;
  }

  const record = saveUpload(filename, req.body);
  res.status(201).json({ id: record.id, filename: record.filename });
});
