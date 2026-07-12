import { readFileSync } from "node:fs";
import { resolveUpload } from "../storage.js";
import { differentialAbundance, pathwayOra, PathwaySet } from "../lib/metabolomics.js";
import pathwayLibrary from "../data/pathways.json" with { type: "json" };

export interface JsExecutorArgs {
  params: Record<string, any>;
  inputs: Record<string, any>;
}
type JsExecutor = (args: JsExecutorArgs) => Promise<any>;

function firstUpstreamArray(inputs: Record<string, any>): any[] {
  for (const key in inputs) {
    if (inputs[key] && Array.isArray(inputs[key].data)) return inputs[key].data;
  }
  return [];
}

// Finds the first uploaded-file id emitted by any upstream node (e.g. File Input).
function firstUpstreamUploadId(inputs: Record<string, any>): string | undefined {
  for (const key in inputs) {
    const files = inputs[key]?.files;
    if (Array.isArray(files) && files.length > 0) return files[0];
  }
  return undefined;
}

export const javascriptExecutors: Record<string, JsExecutor> = {
  file_input: async ({ params }) => {
    const { files, file_format = "fasta" } = params;
    const fileList = Array.isArray(files) ? files : files ? [files] : [];
    return {
      summary: fileList.length
        ? `Registered ${fileList.length} ${file_format.toUpperCase()} file(s) for downstream processing.`
        : "No files uploaded.",
      files: fileList,
      format: file_format,
    };
  },

  ncbi_fetch: async ({ params }) => {
    const { database = "nucleotide", query = "" } = params;
    if (!query) throw new Error("Search query is required.");

    const dbMap: Record<string, string> = { nucleotide: "nuccore", protein: "protein", sra: "sra" };
    const db = dbMap[database] || "nuccore";

    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=${db}&term=${encodeURIComponent(query)}&retmode=json`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) throw new Error(`NCBI Search failed: ${searchRes.statusText}`);
    const searchData: any = await searchRes.json();
    const ids: string[] = searchData.esearchresult?.idlist || [];
    if (ids.length === 0) return { summary: `No results found in ${database} for "${query}".`, sequences: [] };

    const fetchIds = ids.slice(0, 5).join(",");
    const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=${db}&id=${fetchIds}&retmode=json`;
    const summaryRes = await fetch(summaryUrl);
    const summaryData: any = summaryRes.ok ? await summaryRes.json() : null;
    const items = summaryData?.result
      ? Object.keys(summaryData.result).filter((k) => k !== "uids").map((k) => summaryData.result[k])
      : [];

    return {
      summary: `Found ${ids.length} results. Fetched details for top ${items.length}.`,
      query,
      database,
      total_hits: ids.length,
      top_results: items.map((i: any) => ({ uid: i.uid, title: i.title || i.slen, accession: i.caption })),
    };
  },

  filter_data: async ({ params, inputs }) => {
    const { column = "padj", operator = "<", value = 0.05 } = params;
    const sourceData = firstUpstreamArray(inputs);
    if (sourceData.length === 0) return { summary: "No structured data received to filter.", data: [] };

    const filtered = sourceData.filter((item) => {
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
      data: filtered,
    };
  },

  deseq2: async () => ({
    summary: "Differential expression analysis computed successfully. (Mocked pending a real R/DESeq2 container worker.)",
    total_de_genes: 1247,
    upregulated: 683,
    downregulated: 564,
    data: [
      { gene: "BRCA1", log2fc: -4.21, padj: 1.2e-42 },
      { gene: "TP53", log2fc: 2.87, padj: 3.1e-28 },
      { gene: "RAD51", log2fc: -3.14, padj: 8.7e-22 },
    ],
  }),

  // ─── Metabolomics biomarker discovery ───

  // "Which molecules change" — real differential abundance from an uploaded
  // samples-x-metabolites CSV (Welch's t-test on log2 intensities + BH FDR).
  metabolite_stats: async ({ params, inputs }) => {
    const uploadId = firstUpstreamUploadId(inputs);
    if (!uploadId)
      throw new Error(
        "Connect a File Input node with an uploaded metabolomics CSV (rows = samples, columns = metabolites, plus a group column)."
      );
    const rec = resolveUpload(uploadId);
    if (!rec)
      throw new Error("Uploaded file not found (the compute server may have restarted). Re-upload and run again.");
    const csv = readFileSync(rec.path, "utf8");
    return differentialAbundance(csv, {
      padjCutoff: Number(params.padj_cutoff ?? 0.05),
      controlLabel: params.control_label || undefined,
    });
  },

  // "Why do they change" — map the changed metabolites onto metabolic pathways
  // and test which are over-represented (hypergeometric ORA).
  pathway_enrichment: async ({ params, inputs }) => {
    const rows = firstUpstreamArray(inputs);
    if (rows.length === 0)
      throw new Error("Connect a Metabolite Stats node upstream (its metabolite table feeds this enrichment).");
    const cutoff = Number(params.padj_cutoff ?? 0.05);
    const significant = rows
      .filter((r) => {
        const q = r.padj ?? r.pvalue;
        return typeof q === "number" && q <= cutoff;
      })
      .map((r) => r.metabolite ?? r.gene)
      .filter(Boolean);
    const sets = (pathwayLibrary as { pathways: PathwaySet[] }).pathways;
    return {
      pathway_library: (pathwayLibrary as { source: string }).source,
      ...pathwayOra(significant, sets, { minHits: Number(params.min_hits ?? 2) }),
    };
  },

  default: async ({ params, inputs }) => ({
    summary: "Executed default mock logic.",
    received_inputs: Object.keys(inputs).length,
    mock_config: params,
  }),
};
