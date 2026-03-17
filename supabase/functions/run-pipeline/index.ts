import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Mock results keyed by tool id
const MOCK_RESULTS: Record<string, any> = {
  file_input: {
    summary: "Loaded 2 paired-end FASTQ files (WT_R1.fq.gz, KO_R1.fq.gz)",
    reads_total: 48_200_000,
    file_size_mb: 3200,
  },
  fastqc: {
    summary: "Quality scores ≥30 across 94% of bases. No adapter contamination detected.",
    per_base_quality: "PASS",
    per_sequence_quality: "PASS",
    adapter_content: "PASS",
    gc_content: "WARN",
    overrepresented_sequences: "PASS",
  },
  trimmomatic: {
    summary: "Trimmed adapters and low-quality bases. 96.2% of reads survived.",
    input_reads: 48_200_000,
    surviving_reads: 46_384_400,
    dropped_reads: 1_815_600,
    avg_length_after: 142,
  },
  star_alignment: {
    summary: "Aligned to GRCh38 with 91.3% unique mapping rate using 2-pass mode.",
    uniquely_mapped_pct: 91.3,
    multi_mapped_pct: 5.1,
    unmapped_pct: 3.6,
    splice_junctions: 312_400,
  },
  featurecounts: {
    summary: "Counted reads for 58,219 genes. 82.4% of reads assigned to features.",
    assigned_reads: 38_220_700,
    unassigned_ambiguity: 2_100_000,
    unassigned_no_features: 6_063_700,
    genes_detected: 22_847,
  },
  deseq2: {
    summary: "1,247 genes differentially expressed (padj < 0.05, |LFC| > 1). 683 upregulated, 564 downregulated in BRCA1-KO.",
    total_de_genes: 1247,
    upregulated: 683,
    downregulated: 564,
    top_genes: [
      { gene: "BRCA1", log2fc: -4.21, padj: 1.2e-42 },
      { gene: "TP53", log2fc: 2.87, padj: 3.1e-28 },
      { gene: "RAD51", log2fc: -3.14, padj: 8.7e-22 },
      { gene: "CHEK2", log2fc: 2.45, padj: 1.9e-18 },
      { gene: "ATM", log2fc: 1.92, padj: 4.2e-15 },
    ],
  },
  volcano_plot: {
    summary: "Volcano plot generated. 1,247 significant genes highlighted.",
    image_url: "https://placehold.co/600x400/1a1a2e/16a34a?text=Volcano+Plot",
    significant_points: 1247,
  },
  heatmap: {
    summary: "Clustered heatmap of top 50 DE genes shows clear WT vs KO separation.",
    image_url: "https://placehold.co/600x400/1a1a2e/3b82f6?text=Heatmap",
    clusters: 3,
    silhouette_score: 0.82,
  },
  ai_interpret: {
    summary:
      "The BRCA1-KO condition shows significant disruption of DNA damage repair pathways. Key findings: (1) BRCA1 itself is strongly downregulated (LFC = -4.21), confirming successful knockout. (2) Compensatory upregulation of TP53 and CHEK2 suggests activation of alternative DNA damage checkpoints. (3) Downregulation of RAD51 indicates impaired homologous recombination repair. These results are consistent with BRCA1-deficient phenotypes in the literature and suggest potential sensitivity to PARP inhibitors.",
    confidence: 0.94,
    pathways_affected: [
      "Homologous recombination",
      "p53 signaling",
      "Cell cycle checkpoint",
      "DNA damage response",
    ],
  },
  csv_export: {
    summary: "Exported 3 CSV files: de_results.csv (1,247 rows), counts_matrix.csv (22,847 × 6), qc_summary.csv",
    files: ["de_results.csv", "counts_matrix.csv", "qc_summary.csv"],
    total_rows: 24_094,
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pipeline_id, nodes, edges } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Create a pipeline run record
    const { data: run, error: runError } = await supabase
      .from("pipeline_runs")
      .insert({
        pipeline_id,
        status: "running",
        node_statuses: Object.fromEntries(
          nodes.map((n: any) => [n.id, "queued"])
        ),
      })
      .select()
      .single();

    if (runError) throw runError;

    // Simulate sequential execution by topological order
    // For the demo, just process nodes in array order with mock results
    const results: Record<string, any> = {};
    const nodeStatuses: Record<string, string> = {};

    for (const node of nodes) {
      const toolId = node.data?.tool || node.tool;
      results[node.id] = {
        tool: toolId,
        label: node.data?.label || toolId,
        ...(MOCK_RESULTS[toolId] || { summary: "Processing complete." }),
      };
      nodeStatuses[node.id] = "complete";
    }

    // Update the run with results
    const { error: updateError } = await supabase
      .from("pipeline_runs")
      .update({
        status: "complete",
        node_statuses: nodeStatuses,
        results,
        completed_at: new Date().toISOString(),
      })
      .eq("id", run.id);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ run_id: run.id, status: "complete", results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Pipeline run error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
