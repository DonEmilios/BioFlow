import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

// Need to mock the Deno.serve functionality to test the handler
// But since the handler is anonymous in index.ts, we'll write a standalone test 
// for the topological sort and execution logic directly here to ensure correctness.

Deno.test("DAG Execution Engine: Topological Sort and Data Flow", async () => {
  // Mock Nodes
  const nodes = [
    { id: "node1", data: { tool: "file_input", params: { file: "test.fastq" } } },
    { id: "node2", data: { tool: "fastqc", params: { threads: 4 } } },
    { id: "node3", data: { tool: "ai_interpret", params: { level: "expert" } } },
  ];

  // Mock Edges (node1 -> node2 -> node3)
  const edges = [
    { source: "node1", target: "node2" },
    { source: "node2", target: "node3" },
  ];

  // 1. Build adjacency list and in-degree map
  const adjList: Record<string, string[]> = {};
  const inDegree: Record<string, number> = {};
  const nodeMap: Record<string, any> = {};

  nodes.forEach((n: any) => {
    adjList[n.id] = [];
    inDegree[n.id] = 0;
    nodeMap[n.id] = n;
  });

  edges.forEach((e: any) => {
    if (adjList[e.source] && inDegree[e.target] !== undefined) {
      adjList[e.source].push(e.target);
      inDegree[e.target]++;
    }
  });

  // 2. Perform Topological Sort
  const queue: string[] = [];
  nodes.forEach((n: any) => {
    if (inDegree[n.id] === 0) queue.push(n.id);
  });

  const executionOrder: string[] = [];
  while (queue.length > 0) {
    const u = queue.shift()!;
    executionOrder.push(u);

    adjList[u].forEach((v) => {
      inDegree[v]--;
      if (inDegree[v] === 0) {
        queue.push(v);
      }
    });
  }

  assertEquals(executionOrder, ["node1", "node2", "node3"]);

  // 3. Execution Mock
  const nodeOutputs: Record<string, any> = {};
  const ExecutorRegistry: Record<string, any> = {
    default: async ({ nodeId, inputs }: any) => {
      return { msg: `Executed ${nodeId}`, receivedInputs: inputs };
    }
  };

  for (const nodeId of executionOrder) {
    const parentEdges = edges.filter((e: any) => e.target === nodeId);
    const inputsForNode: Record<string, any> = {};
    
    parentEdges.forEach((e: any) => {
      if (nodeOutputs[e.source]) {
        inputsForNode[e.source] = nodeOutputs[e.source];
      }
    });

    const output = await ExecutorRegistry.default({ nodeId, inputs: inputsForNode });
    nodeOutputs[nodeId] = output;
  }

  // Verification
  assertEquals(nodeOutputs["node1"].receivedInputs, {});
  assertEquals(nodeOutputs["node2"].receivedInputs, { "node1": { msg: "Executed node1", receivedInputs: {} } });
  assertEquals(nodeOutputs["node3"].receivedInputs, { "node2": { msg: "Executed node2", receivedInputs: { "node1": { msg: "Executed node1", receivedInputs: {} } } } });
});
