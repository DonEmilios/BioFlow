import express from "express";
import cors from "cors";
import { runsRouter } from "./routes/runs.js";
import { uploadsRouter } from "./routes/uploads.js";
import { customNodesRouter } from "./routes/customNodes.js";
import { listManifests } from "./manifests/index.js";
import { isDockerAvailable } from "./executors/containerExecutor.js";
import { countRows } from "./db.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    dockerAvailable: isDockerAvailable(),
    persistence: {
      uploads: countRows("uploads"),
      customNodes: countRows("custom_nodes"),
      runs: countRows("runs"),
    },
  });
});

app.get("/api/manifests", (_req, res) => {
  res.json(listManifests());
});

app.use("/api/uploads", uploadsRouter);
app.use("/api/runs", runsRouter);
app.use("/api/custom-nodes", customNodesRouter);

const PORT = Number(process.env.PORT) || 8787;
app.listen(PORT, () => {
  console.log(`BioFlow compute server listening on http://localhost:${PORT}`);
  console.log(`Docker available: ${isDockerAvailable()}`);
  console.log(
    `Persisted: ${countRows("uploads")} uploads, ${countRows("custom_nodes")} custom nodes, ${countRows("runs")} runs`
  );
});
