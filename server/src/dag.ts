export interface DagNode {
  id: string;
}
export interface DagEdge {
  source: string;
  target: string;
}

// Kahn's algorithm. Throws if the graph has a cycle.
export function topologicalSort(nodes: DagNode[], edges: DagEdge[]): string[] {
  const adjList: Record<string, string[]> = {};
  const inDegree: Record<string, number> = {};

  nodes.forEach((n) => {
    adjList[n.id] = [];
    inDegree[n.id] = 0;
  });

  edges.forEach((e) => {
    if (adjList[e.source] && inDegree[e.target] !== undefined) {
      adjList[e.source].push(e.target);
      inDegree[e.target]++;
    }
  });

  const queue: string[] = nodes.filter((n) => inDegree[n.id] === 0).map((n) => n.id);
  const order: string[] = [];

  while (queue.length > 0) {
    const u = queue.shift()!;
    order.push(u);
    adjList[u].forEach((v) => {
      inDegree[v]--;
      if (inDegree[v] === 0) queue.push(v);
    });
  }

  if (order.length !== nodes.length) {
    throw new Error("Cycle detected in pipeline graph or invalid node references.");
  }

  return order;
}
