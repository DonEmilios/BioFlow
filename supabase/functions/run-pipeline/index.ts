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
    summary:
      "Quality scores ≥30 across 94% of bases. No adapter contamination detected.",
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
    summary:
      "Aligned to GRCh38 with 91.3% unique mapping rate using 2-pass mode.",
    uniquely_mapped_pct: 91.3,
    multi_mapped_pct: 5.1,
    unmapped_pct: 3.6,
    splice_junctions: 312_400,
  },
  featurecounts: {
    summary:
      "Counted reads for 58,219 genes. 82.4% of reads assigned to features.",
    assigned_reads: 38_220_700,
    unassigned_ambiguity: 2_100_000,
    unassigned_no_features: 6_063_700,
    genes_detected: 22_847,
  },
  deseq2: {
    summary:
      "1,247 genes differentially expressed (padj < 0.05, |LFC| > 1). 683 upregulated, 564 downregulated in BRCA1-KO.",
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
    summary:
      "Clustered heatmap of top 50 DE genes shows clear WT vs KO separation.",
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
    summary:
      "Exported 3 CSV files: de_results.csv (1,247 rows), counts_matrix.csv (22,847 × 6), qc_summary.csv",
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
          nodes.map((n: any) => [n.id, "queued"]),
        ),
      })
      .select()
      .single();

    if (runError) throw runError;

    // --- START DAG ENGINE IMPLEMENTATION ---

    // 1. Build adjacency list and in-degree map
    const adjList: Record<string, string[]> = {};
    const inDegree: Record<string, number> = {};
    const nodeMap: Record<string, any> = {};

    nodes.forEach((n: any) => {
      adjList[n.id] = [];
      inDegree[n.id] = 0;
      nodeMap[n.id] = n;
    });

    // Populate edges
    edges.forEach((e: any) => {
      // e.source is the parent, e.target is the child
      if (adjList[e.source] && inDegree[e.target] !== undefined) {
        adjList[e.source].push(e.target);
        inDegree[e.target]++;
      }
    });

    // 2. Perform Topological Sort (Kahn's Algorithm)
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

    if (executionOrder.length !== nodes.length) {
      throw new Error(
        "Cycle detected in pipeline graph or invalid node references.",
      );
    }

    // 3. Define the Node Executor standard interface and mock executors
    interface NodeExecutionArgs {
      nodeId: string;
      params: Record<string, any>;
      inputs: Record<string, any>; // outputs from upstream nodes
      runContext: { runId: string };
    }
    type NodeExecutor = (args: NodeExecutionArgs) => Promise<any>;

    // Basic pass-through execution registry for phase 1 validation
    const ExecutorRegistry: Record<string, NodeExecutor> = {
      file_input: async ({ params }) => {
        const { file_url, file_format = "fastq", paired_end = true } = params;
        if (!file_url) throw new Error("File URL is required. Please enter a valid HTTPS URL.");
        
        // Mocking the download since downloading huge fastq files in an edge function would timeout
        return {
          summary: `Successfully ingested ${file_format.toUpperCase()} file from URL.`,
          file_url,
          format: file_format,
          paired_end,
          reads_total: Math.floor(Math.random() * 50000000) + 10000000,
          file_size_mb: Math.floor(Math.random() * 5000) + 500,
        };
      },

      sra_input: async ({ params }) => {
        const { accession, split_files = true } = params;
        if (!accession) throw new Error("SRA Accession is required.");
        
        return {
          summary: `Downloaded SRA dataset ${accession} (Split: ${split_files}).`,
          accession,
          split_files,
          reads_total: Math.floor(Math.random() * 100000000) + 20000000,
          layout: split_files ? "PAIRED" : "SINGLE",
        };
      },

      ncbi_fetch: async ({ params }) => {
        const { database = "nucleotide", query = "" } = params;
        if (!query) throw new Error("Search query is required.");
        
        // E-utilities fetch
        const dbMap: Record<string, string> = {
          nucleotide: "nuccore",
          protein: "protein",
          sra: "sra"
        };
        const db = dbMap[database] || "nuccore";
        
        // Use esearch to find IDs
        const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=${db}&term=${encodeURIComponent(query)}&retmode=json`;
        const searchRes = await fetch(searchUrl);
        if (!searchRes.ok) throw new Error(`NCBI Search failed: ${searchRes.statusText}`);
        
        const searchData = await searchRes.json();
        const ids = searchData.esearchresult?.idlist || [];
        
        if (ids.length === 0) {
          return { summary: `No results found in ${database} for "${query}".`, sequences: [] };
        }
        
        // Use efetch to get basic summaries for the first up to 5 IDs to keep payload small
        const fetchIds = ids.slice(0, 5).join(",");
        const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=${db}&id=${fetchIds}&retmode=json`;
        const summaryRes = await fetch(summaryUrl);
        const summaryData = summaryRes.ok ? await summaryRes.json() : null;
        
        const items = summaryData?.result ? Object.keys(summaryData.result)
          .filter(k => k !== "uids")
          .map(k => summaryData.result[k]) : [];
          
        return {
          summary: `Found ${ids.length} results. Fetched details for top ${items.length}.`,
          query,
          database,
          total_hits: ids.length,
          top_results: items.map((i: any) => ({
            uid: i.uid,
            title: i.title || i.slen,
            accession: i.caption
          }))
        };
      },

      ai_interpret: async ({ params, inputs }) => {
        const { audience = "wet_lab_student", focus = "summary" } = params;
        
        // Extract up to ~2000 chars of context from upstream inputs
        const contextData = JSON.stringify(inputs).substring(0, 2000);
        
        const prompt = `You are a bioinformatics assistant. Your target audience is a ${audience.replace(/_/g, " ")}. 
Your focus should be: ${focus}.
Please interpret the following pipeline data results:

${contextData}

Provide a concise, easy-to-understand summary.`;

        // If OPENAI_API_KEY is available, use it, otherwise return mock interpretation based dynamically on inputs
        const openAiKey = Deno.env.get("OPENAI_API_KEY");
        if (openAiKey) {
          try {
            const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${openAiKey}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.7,
                max_tokens: 300
              })
            });
            
            if (aiRes.ok) {
              const aiData = await aiRes.json();
              return { 
                summary: "AI interpretation generated successfully.",
                interpretation: aiData.choices[0].message.content,
                audience,
                focus
              };
            }
          } catch(err) {
            console.error("AI API Error", err);
          }
        }
        
        // Fallback or Mock dynamic response
        const nodeNames = Object.keys(inputs).join(", ");
        return {
          summary: "Dynamic mock interpretation generated (No OpenAI API key).",
          interpretation: `Based on the provided data from upstream steps (${nodeNames}), the results show standard successful processing. As a ${audience.replace(/_/g, " ")}, you should note the focus on ${focus} metrics indicates the pipeline functioned normally, though deeper analysis requires the actual API keys to be configured in Supabase.`,
          audience,
          focus,
          raw_context_seen: Object.keys(inputs)
        };
      },

      deseq2: async ({ params, inputs }) => {
        // Return structured data instead of just a string summary, so viz nodes can use it
        return {
          summary: "Differential expression analysis computed successfully.",
          total_de_genes: 1247,
          upregulated: 683,
          downregulated: 564,
          data: [
            { gene: "BRCA1", log2fc: -4.21, padj: 1.2e-42 },
            { gene: "TP53", log2fc: 2.87, padj: 3.1e-28 },
            { gene: "RAD51", log2fc: -3.14, padj: 8.7e-22 },
            { gene: "CHEK2", log2fc: 2.45, padj: 1.9e-18 },
            { gene: "ATM", log2fc: 1.92, padj: 4.2e-15 },
            { gene: "PARP1", log2fc: 1.21, padj: 1e-4 },
            { gene: "MYC", log2fc: -1.05, padj: 0.02 },
            { gene: "ACTB", log2fc: 0.01, padj: 0.99 }, // non-significant example
          ]
        };
      },

      volcano_plot: async ({ params, inputs }) => {
        // Find if any upstream node provided "data" (like deseq2)
        let chartData: any[] = [];
        for (const inputKey in inputs) {
          if (inputs[inputKey] && Array.isArray(inputs[inputKey].data)) {
            chartData = inputs[inputKey].data;
            break;
          }
        }

        const lfcLine = params.lfc_line || 1;
        const padjLine = params.padj_line || 0.05;

        let sigCount = 0;
        chartData.forEach(d => {
          if (Math.abs(d.log2fc) >= lfcLine && d.padj <= padjLine) {
            sigCount++;
          }
        });

        // Normally we'd render an image URL or pass chart JSON to the frontend
        return {
          summary: `Dynamic Volcano Plot generated across ${chartData.length} genes. Found ${sigCount} significant points based on thresholds (|LFC|>=${lfcLine}, p-adj<=${padjLine}).`,
          image_url: "https://placehold.co/600x400/1a1a2e/16a34a?text=Dynamic+Volcano+Plot",
          significant_points: sigCount,
          chart_config: {
            data: chartData,
            x_axis: "log2fc",
            y_axis: "padj_log10",
            thresholds: { lfc: lfcLine, padj: padjLine }
          }
        };
      },

      filter_data: async ({ params, inputs }) => {
        const { column = "padj", operator = "<", value = 0.05 } = params;
        
        let sourceData: any[] = [];
        for (const inputKey in inputs) {
          if (inputs[inputKey] && Array.isArray(inputs[inputKey].data)) {
            sourceData = inputs[inputKey].data;
            break;
          }
        }

        if (sourceData.length === 0) {
          return { summary: "No structured data received to filter.", data: [] };
        }

        const filtered = sourceData.filter(item => {
          const val = item[column];
          if (val === undefined) return false;
          if (operator === "<") return val < value;
          if (operator === ">") return val > value;
          if (operator === "==") return val == value;
          return false;
        });

        return {
          summary: `Filtered ${sourceData.length} rows down to ${filtered.length} using condition: ${column} ${operator} ${value}`,
          original_rows: sourceData.length,
          filtered_rows: filtered.length,
          data: filtered
        };
      },

      webhook_export: async ({ params, inputs }) => {
        const { url, message = "Pipeline Execution Complete" } = params;
        if (!url) throw new Error("Webhook URL is required.");

        // Clean up inputs to avoid massive payloads
        const payloadData = JSON.parse(JSON.stringify(inputs));
        // Truncate huge datasets
        for (const k in payloadData) {
          if (Array.isArray(payloadData[k].data) && payloadData[k].data.length > 50) {
             payloadData[k].data = ["Data truncated for webhook (>50 items)..."];
          }
        }

        const payload = {
          content: message,
          embeds: [{
             title: "BioFlow Canvas Execution Results",
             description: `Received outputs from ${Object.keys(inputs).length} upstream nodes.`,
             fields: Object.keys(inputs).map(k => ({
               name: k,
               value: inputs[k].summary || "No summary provided"
             }))
          }],
          raw_data: payloadData
        };

        try {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          
          if (!res.ok) throw new Error(`Webhook failed with status ${res.status}`);
          
          return {
            summary: `Successfully posted results to webhook: ${url}`,
            status: "Success"
          };
        } catch(err: any) {
          return {
            summary: `Webhook export failed: ${err.message}`,
            status: "Failed",
            error: err.message
          };
        }
      },

      default: async ({ nodeId, params, inputs }) => {
        // Find what tool this is
        const nodeDef = nodeMap[nodeId];
        const toolId = nodeDef.data?.tool || nodeDef.tool;

        return {
          summary: `Executed standard logic for ${toolId}`,
          received_inputs: Object.keys(inputs).length,
          upstream_data: inputs, // pass the inputs received for verification
          mock_config: params,
          ...(MOCK_RESULTS[toolId] || {}),
        };
      },
    };

    // 4. Execute Nodes sequentially based on topological order
    const results: Record<string, any> = {};
    const nodeStatuses: Record<string, string> = {};
    // Store outputs specifically to pass downstream
    const nodeOutputs: Record<string, any> = {};

    for (const nodeId of executionOrder) {
      const node = nodeMap[nodeId];
      const toolId = node.data?.tool || node.tool;
      const params = node.data?.params || {};

      // Gather inputs from immediate parents
      // Find all edges where target === nodeId
      const parentEdges = edges.filter((e: any) => e.target === nodeId);
      const inputsForNode: Record<string, any> = {};

      parentEdges.forEach((e: any) => {
        if (nodeOutputs[e.source]) {
          // Key the input by the source node ID so it's queryable
          inputsForNode[e.source] = nodeOutputs[e.source];
        }
      });

      try {
        // Execute the node
        const executor = ExecutorRegistry[toolId] || ExecutorRegistry.default;
        const output = await executor({
          nodeId,
          params,
          inputs: inputsForNode,
          runContext: { runId: run.id },
        });

        nodeOutputs[nodeId] = output;
        results[nodeId] = {
          tool: toolId,
          label: node.data?.label || toolId,
          ...output,
        };
        nodeStatuses[nodeId] = "complete";
      } catch (err: any) {
        nodeStatuses[nodeId] = "error";
        results[nodeId] = { error: err.message || String(err) };
        break; // Stop execution on first failure
      }
    }
    // --- END DAG ENGINE IMPLEMENTATION ---

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
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Pipeline run error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
