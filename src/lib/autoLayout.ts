import { Node, Edge } from "reactflow";
import { PipelineNodeData } from "@/store/pipelineStore";

const COL_GAP = 320; // horizontal distance between pipeline stages
const ROW_GAP = 150; // vertical distance between sibling nodes in a stage
const ORIGIN_X = 80;
const ORIGIN_Y = 80;

// Left-to-right layered layout (a lightweight Sugiyama). Each node's column is
// its longest-path depth from a source, so data always flows rightward and
// parents sit strictly left of their children — matching the node handles
// (target = left, source = right). Nodes sharing a column are stacked and
// vertically centered so the graph reads as tidy, aligned pipeline stages.
export function autoLayout<T extends PipelineNodeData>(
  nodes: Node<T>[],
  edges: Edge[]
): Node<T>[] {
  if (nodes.length === 0) return nodes;

  const ids = nodes.map((n) => n.id);
  const idSet = new Set(ids);
  const adj: Record<string, string[]> = {};
  const indeg: Record<string, number> = {};
  ids.forEach((id) => {
    adj[id] = [];
    indeg[id] = 0;
  });
  edges.forEach((e) => {
    if (idSet.has(e.source) && idSet.has(e.target)) {
      adj[e.source].push(e.target);
      indeg[e.target]++;
    }
  });

  // Longest-path layering via Kahn's topological order.
  const layer: Record<string, number> = {};
  ids.forEach((id) => (layer[id] = 0));
  const queue = ids.filter((id) => indeg[id] === 0);
  const workIndeg = { ...indeg };
  const order: string[] = [];
  while (queue.length) {
    const u = queue.shift()!;
    order.push(u);
    for (const v of adj[u]) {
      layer[v] = Math.max(layer[v], layer[u] + 1);
      if (--workIndeg[v] === 0) queue.push(v);
    }
  }
  // Any nodes left out (cycle) keep layer 0 — degrade gracefully.

  // Group by layer, preserving the original node order within each.
  const byLayer = new Map<number, string[]>();
  for (const id of ids) {
    const l = layer[id];
    if (!byLayer.has(l)) byLayer.set(l, []);
    byLayer.get(l)!.push(id);
  }

  const maxRows = Math.max(...Array.from(byLayer.values()).map((c) => c.length));
  const canvasHeight = (maxRows - 1) * ROW_GAP;

  const pos: Record<string, { x: number; y: number }> = {};
  for (const [l, group] of byLayer) {
    const colHeight = (group.length - 1) * ROW_GAP;
    const yStart = ORIGIN_Y + (canvasHeight - colHeight) / 2;
    group.forEach((id, i) => {
      pos[id] = { x: ORIGIN_X + l * COL_GAP, y: yStart + i * ROW_GAP };
    });
  }

  return nodes.map((n) => ({ ...n, position: pos[n.id] ?? n.position }));
}
