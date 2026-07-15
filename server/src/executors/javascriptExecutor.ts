import { readFileSync } from "node:fs";
import { resolveUpload } from "../storage.js";
import { differentialAbundance, pathwayOra, PathwaySet } from "../lib/metabolomics.js";
import {
  OmicsMatrix,
  parseMatrixCsv,
  transformScale,
  Transform,
  Scaling,
  pca,
  kmeans,
  rocAuc,
  renderVolcanoSvg,
  renderPcaSvg,
  renderRocSvg,
} from "../lib/omics.js";
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

// Resolves a samples×features matrix for a tabular node: prefer a matrix already
// emitted upstream (so nodes chain — e.g. Normalize → PCA), else parse the CSV
// from a connected File Input. This is what lets tabular nodes compose freely.
function resolveMatrix(inputs: Record<string, any>): OmicsMatrix {
  for (const key in inputs) {
    const up = inputs[key];
    if (up && Array.isArray(up.matrix) && Array.isArray(up.features) && Array.isArray(up.samples)) {
      return { samples: up.samples, features: up.features, matrix: up.matrix, groups: up.groups ?? null };
    }
  }
  const uploadId = firstUpstreamUploadId(inputs);
  if (!uploadId)
    throw new Error("Connect a File Input node (metabolomics/omics CSV) or a matrix-producing node upstream.");
  const rec = resolveUpload(uploadId);
  if (!rec) throw new Error("Uploaded file not found. Re-upload and run again.");
  return parseMatrixCsv(readFileSync(rec.path, "utf8"));
}

// Row-oriented view of a matrix for the results table (first 200 rows).
function matrixToRows(m: OmicsMatrix): Record<string, any>[] {
  return m.matrix.slice(0, 200).map((row, i) => {
    const obj: Record<string, any> = { sample: m.samples[i] };
    if (m.groups) obj.group = m.groups[i];
    m.features.forEach((f, j) => (obj[f] = Number(row[j].toFixed(4))));
    return obj;
  });
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

  // ─── Real tabular-omics analysis (batch 1) ───

  // Preprocessing: log2 transform and/or scaling (autoscale / Pareto). Emits a
  // matrix so downstream nodes (PCA, clustering) consume the normalized data.
  normalize_scale: async ({ params, inputs }) => {
    const m = resolveMatrix(inputs);
    const transform = (params.transform ?? "none") as Transform;
    const scaling = (params.scaling ?? "none") as Scaling;
    const scaled = transformScale(m.matrix, transform, scaling);
    const out: OmicsMatrix = { samples: m.samples, features: m.features, matrix: scaled, groups: m.groups };
    return {
      summary: `Normalized ${m.samples.length} samples × ${m.features.length} features (transform: ${transform}, scaling: ${scaling}).`,
      transform,
      scaling,
      samples: out.samples,
      features: out.features,
      groups: out.groups,
      matrix: out.matrix,
      data: matrixToRows(out),
    };
  },

  // Principal component analysis: real eigendecomposition of the feature
  // covariance. Emits a rendered scatter (coloured by group) + per-sample
  // PC coordinates.
  pca_analysis: async ({ params, inputs }) => {
    const m = resolveMatrix(inputs);
    const nComponents = Math.max(2, Number(params.n_components ?? 2));
    const result = pca(m.matrix, nComponents);
    const rows = m.samples.map((s, i) => {
      const obj: Record<string, any> = { sample: s };
      if (m.groups) obj.group = m.groups[i];
      result.scores[i].forEach((v, c) => (obj[`PC${c + 1}`] = Number(v.toFixed(4))));
      return obj;
    });
    const pctPC1 = (result.explainedVariance[0] * 100).toFixed(1);
    const pctPC2 = ((result.explainedVariance[1] ?? 0) * 100).toFixed(1);
    return {
      summary: `PCA complete. PC1 explains ${pctPC1}% of variance, PC2 ${pctPC2}%.`,
      explained_variance: result.explainedVariance.map((v) => Number((v * 100).toFixed(2))),
      n_components: result.nComponents,
      image_url: renderPcaSvg(result.scores, m.groups, result.explainedVariance),
      data: rows,
    };
  },

  // k-means clustering on samples; reports silhouette (cluster quality) and,
  // when known group labels exist, cluster/group agreement (purity).
  kmeans_cluster: async ({ params, inputs }) => {
    const m = resolveMatrix(inputs);
    const k = Math.max(2, Number(params.k ?? 2));
    const result = kmeans(m.matrix, k);
    let purity: number | undefined;
    if (m.groups) {
      // Purity: fraction of samples in the majority group of their cluster.
      let correct = 0;
      for (let c = 0; c < k; c++) {
        const memberGroups = m.groups.filter((_, i) => result.assignments[i] === c);
        if (memberGroups.length === 0) continue;
        const counts: Record<string, number> = {};
        memberGroups.forEach((g) => (counts[g] = (counts[g] ?? 0) + 1));
        correct += Math.max(...Object.values(counts));
      }
      purity = correct / m.samples.length;
    }
    return {
      summary: `k-means (k=${k}): silhouette ${result.silhouette.toFixed(3)}${
        purity !== undefined ? `, cluster/group purity ${(purity * 100).toFixed(0)}%` : ""
      }.`,
      k,
      silhouette: Number(result.silhouette.toFixed(4)),
      inertia: Number(result.inertia.toFixed(2)),
      purity: purity !== undefined ? Number(purity.toFixed(4)) : undefined,
      data: m.samples.map((s, i) => ({
        sample: s,
        cluster: result.assignments[i],
        ...(m.groups ? { group: m.groups[i] } : {}),
      })),
    };
  },

  // ROC / AUC for a single biomarker feature separating two groups. Real
  // rank-based AUC + a rendered ROC curve.
  roc_analysis: async ({ params, inputs }) => {
    const m = resolveMatrix(inputs);
    if (!m.groups) throw new Error("ROC needs a group column in the data to define positive vs negative class.");
    const feature = (params.feature as string) || m.features[0];
    const featureIdx = m.features.indexOf(feature);
    if (featureIdx === -1) throw new Error(`Feature "${feature}" not found. Available: ${m.features.slice(0, 8).join(", ")}…`);

    const uniqueGroups = Array.from(new Set(m.groups));
    const HEALTHY = ["control", "healthy", "normal", "wt", "baseline"];
    const positive =
      (params.positive_group as string) && uniqueGroups.includes(params.positive_group)
        ? (params.positive_group as string)
        : uniqueGroups.find((g) => !HEALTHY.includes(g.toLowerCase())) ?? uniqueGroups[1] ?? uniqueGroups[0];

    const values = m.matrix.map((row) => row[featureIdx]);
    const labels = m.groups.map((g) => (g === positive ? 1 : 0));
    const roc = rocAuc(values, labels);
    return {
      summary: `${feature} as a biomarker for ${positive}: AUC = ${roc.auc.toFixed(3)} (${roc.direction} in cases).`,
      feature,
      positive_group: positive,
      auc: Number(roc.auc.toFixed(4)),
      direction: roc.direction,
      image_url: renderRocSvg(roc.points, roc.auc, feature),
    };
  },

  // Real volcano plot rendered server-side from an upstream stats table
  // (log2fc vs -log10 adjusted p). Replaces the old placeholder image.
  volcano_plot: async ({ params, inputs }) => {
    const rows = firstUpstreamArray(inputs) as Array<{ log2fc?: number; padj?: number; pvalue?: number }>;
    const pts = rows
      .filter((r) => typeof r.log2fc === "number" && (typeof r.padj === "number" || typeof r.pvalue === "number"))
      .map((r) => ({ ...r, padj: (r.padj ?? r.pvalue)! })) as Array<{ log2fc: number; padj: number }>;
    if (pts.length === 0)
      throw new Error("Connect a stats node upstream (needs log2fc + adjusted p per feature).");
    const lfcLine = Number(params.lfc_line ?? 1);
    const padjLine = Number(params.padj_line ?? 0.05);
    const sig = pts.filter((p) => Math.abs(p.log2fc) >= lfcLine && p.padj <= padjLine).length;
    return {
      summary: `Volcano plot rendered: ${sig} of ${pts.length} features significant (|log2FC| ≥ ${lfcLine}, p ≤ ${padjLine}).`,
      significant_points: sig,
      total_points: pts.length,
      image_url: renderVolcanoSvg(pts, lfcLine, padjLine),
    };
  },

  default: async ({ params, inputs }) => ({
    summary: "Executed default mock logic.",
    received_inputs: Object.keys(inputs).length,
    mock_config: params,
  }),
};
