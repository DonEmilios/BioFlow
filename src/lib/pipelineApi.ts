import { supabase } from "@/integrations/supabase/client";
import { Node, Edge } from "reactflow";
import { PipelineNodeData } from "@/store/pipelineStore";

export async function savePipelineToDb(
  name: string,
  nodes: Node<PipelineNodeData>[],
  edges: Edge[],
  existingId?: string
) {
  if (existingId) {
    const { data, error } = await supabase
      .from("pipelines")
      .update({ name, nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) })
      .eq("id", existingId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("pipelines")
    .insert({ name, nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function loadPipelineFromDb() {
  const { data, error } = await supabase
    .from("pipelines")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();
  if (error) throw error;
  return data;
}

export async function runPipeline(
  pipelineId: string | null,
  nodes: Node<PipelineNodeData>[],
  edges: Edge[]
) {
  const { data, error } = await supabase.functions.invoke("run-pipeline", {
    body: { pipeline_id: pipelineId, nodes, edges },
  });
  if (error) throw error;
  return data as { run_id: string; status: string; results: Record<string, any> };
}
