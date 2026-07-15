import { NodeManifest, validateManifest } from "../manifest.js";
import { getCustomManifest, listCustomManifests } from "../customNodes.js";

// Built-in, trusted nodes. Tools that need real bioinformatics binaries
// (STAR, BLAST, Trimmomatic...) aren't available in this environment, so
// they stay on the mock JS executor — clearly marked. gc_content is real:
// it reads an uploaded file from disk and computes actual sequence stats.
const manifests: NodeManifest[] = [
  {
    id: "file_input",
    label: "File Input",
    category: "input",
    description: "Upload FASTQ, FASTA, VCF, or CSV files for analysis.",
    icon: "Upload",
    input_types: [],
    output_types: ["fastq", "fasta", "vcf", "csv"],
    params: [
      { id: "files", label: "Upload Files", type: "file_upload", default: "", required: true, help_text: "Drag and drop biological files." },
      { id: "file_format", label: "File format", type: "select", default: "fasta", options: [{ value: "fastq", label: "FASTQ" }, { value: "fasta", label: "FASTA" }, { value: "vcf", label: "VCF" }, { value: "csv", label: "CSV" }], required: true, help_text: "Format of the uploaded file." },
    ],
    execution: { runtime: "javascript" },
    trusted: true,
  },
  {
    id: "gc_content",
    label: "GC Content",
    category: "process",
    description: "Computes real base composition (GC%, sequence count, average length) from an uploaded FASTA/FASTQ file.",
    icon: "Percent",
    input_types: ["fasta", "fastq"],
    output_types: ["json"],
    params: [],
    execution: { runtime: "process", command: "node", args: ["scripts/gcContent.mjs"] },
    trusted: true,
  },
  {
    id: "ncbi_fetch",
    label: "NCBI Fetch",
    category: "database",
    description: "Retrieve sequences from NCBI by accession or search.",
    icon: "Database",
    input_types: [],
    output_types: ["fasta", "genbank"],
    params: [
      { id: "database", label: "Database", type: "select", default: "nucleotide", options: [{ value: "nucleotide", label: "Nucleotide" }, { value: "protein", label: "Protein" }, { value: "sra", label: "SRA" }], required: true, help_text: "NCBI database to query." },
      { id: "query", label: "Search query", type: "string", default: "", required: true, help_text: "Accession number or search term." },
    ],
    execution: { runtime: "javascript" },
    trusted: true,
  },
  {
    id: "filter_data",
    label: "Filter Data",
    category: "process",
    description: "Filter structured JSON tables based on a specified column and mathematical condition.",
    icon: "Filter",
    input_types: ["json", "tsv"],
    output_types: ["json"],
    params: [
      { id: "column", label: "Column Name", type: "string", default: "padj", required: true, help_text: "Which data column to filter on." },
      { id: "operator", label: "Operator", type: "select", default: "<", options: [{ value: "<", label: "Less Than (<)" }, { value: ">", label: "Greater Than (>)" }, { value: "==", label: "Equals (==)" }], required: true, help_text: "Logical comparison operator." },
      { id: "value", label: "Threshold Value", type: "number", default: 0.05, required: true, help_text: "Numeric value to compare against." },
    ],
    execution: { runtime: "javascript" },
    trusted: true,
  },
  {
    id: "deseq2",
    label: "DESeq2",
    category: "process",
    description: "Differential gene expression analysis. (Mocked — real DESeq2 requires R + a compute worker with the Bioconductor image.)",
    icon: "TrendingUp",
    input_types: ["tsv"],
    output_types: ["tsv"],
    params: [
      { id: "control", label: "Control condition", type: "string", default: "", required: true, help_text: "Name of the control/baseline group." },
      { id: "treatment", label: "Treatment condition", type: "string", default: "", required: true, help_text: "Name of the experimental group." },
      { id: "padj_cutoff", label: "Adj. p-value cutoff", type: "number", default: 0.05, required: true, help_text: "Significance threshold for adjusted p-values." },
    ],
    execution: { runtime: "javascript" },
    trusted: true,
  },
  {
    id: "metabolite_stats",
    label: "Metabolite Stats",
    category: "process",
    description: "Real differential abundance from a metabolomics CSV: log2 fold change, Welch's t-test, and BH-adjusted p-values per metabolite.",
    icon: "Activity",
    input_types: ["csv"],
    output_types: ["json"],
    params: [
      { id: "padj_cutoff", label: "Adj. p-value cutoff", type: "number", default: 0.05, required: true, help_text: "Significance threshold (BH-adjusted) for calling a metabolite changed." },
      { id: "control_label", label: "Control group label", type: "string", default: "", required: false, help_text: "Which group value is the baseline (e.g. Control). Auto-detected if left blank." },
    ],
    execution: { runtime: "javascript" },
    trusted: true,
  },
  {
    id: "pathway_enrichment",
    label: "Pathway Enrichment",
    category: "process",
    description: "Maps the changed metabolites onto metabolic pathways and tests which are over-represented (hypergeometric ORA) — the 'why do they change' step.",
    icon: "Network",
    input_types: ["json"],
    output_types: ["json"],
    params: [
      { id: "padj_cutoff", label: "Significance cutoff", type: "number", default: 0.05, required: true, help_text: "Metabolites with adjusted p below this are treated as the 'changed' set for enrichment." },
      { id: "min_hits", label: "Min metabolites per pathway", type: "number", default: 2, required: false, help_text: "Ignore pathways with fewer than this many changed metabolites." },
    ],
    execution: { runtime: "javascript" },
    trusted: true,
  },
  {
    id: "normalize_scale",
    label: "Normalize & Scale",
    category: "process",
    description: "Real preprocessing for an omics matrix: log2 transform and/or scaling (autoscale / Pareto). Feeds PCA and clustering.",
    icon: "SlidersHorizontal",
    input_types: ["csv", "json"],
    output_types: ["json"],
    params: [
      { id: "transform", label: "Transform", type: "select", default: "log2", options: [{ value: "none", label: "None" }, { value: "log2", label: "Log2" }], required: true, help_text: "Log2 handles the right-skewed intensity distributions typical of MS/NMR data." },
      { id: "scaling", label: "Scaling", type: "select", default: "pareto", options: [{ value: "none", label: "None" }, { value: "zscore", label: "Autoscale (z-score)" }, { value: "pareto", label: "Pareto" }], required: true, help_text: "Puts features on a comparable scale. Pareto is the metabolomics default." },
    ],
    execution: { runtime: "javascript" },
    trusted: true,
  },
  {
    id: "pca_analysis",
    label: "PCA",
    category: "viz",
    description: "Principal component analysis via real eigendecomposition. Shows sample structure / group separation and batch effects.",
    icon: "ScatterChart",
    input_types: ["csv", "json"],
    output_types: ["json", "png"],
    params: [
      { id: "n_components", label: "Components", type: "number", default: 2, required: false, help_text: "Number of principal components to compute (>=2)." },
    ],
    execution: { runtime: "javascript" },
    trusted: true,
  },
  {
    id: "kmeans_cluster",
    label: "K-means Cluster",
    category: "process",
    description: "Unsupervised k-means clustering of samples with a silhouette score, and cluster/group agreement when labels are known.",
    icon: "Boxes",
    input_types: ["csv", "json"],
    output_types: ["json"],
    params: [
      { id: "k", label: "Clusters (k)", type: "number", default: 2, required: true, help_text: "Number of clusters to fit." },
    ],
    execution: { runtime: "javascript" },
    trusted: true,
  },
  {
    id: "roc_analysis",
    label: "ROC / AUC",
    category: "viz",
    description: "Biomarker performance: real rank-based AUC and a rendered ROC curve for one feature separating two groups.",
    icon: "TrendingUp",
    input_types: ["csv", "json"],
    output_types: ["json", "png"],
    params: [
      { id: "feature", label: "Biomarker feature", type: "string", default: "", required: false, help_text: "Which feature/metabolite to evaluate. Defaults to the first feature." },
      { id: "positive_group", label: "Positive (case) group", type: "string", default: "", required: false, help_text: "Which group label is the positive/case class. Auto-detected if blank." },
    ],
    execution: { runtime: "javascript" },
    trusted: true,
  },
  {
    id: "volcano_plot",
    label: "Volcano Plot",
    category: "viz",
    description: "Real rendered volcano plot (log2 fold change vs -log10 adjusted p) from an upstream stats table.",
    icon: "Triangle",
    input_types: ["json"],
    output_types: ["png"],
    params: [
      { id: "padj_line", label: "P-adj threshold", type: "number", default: 0.05, required: false, help_text: "Horizontal significance line." },
      { id: "lfc_line", label: "Log2FC threshold", type: "number", default: 1, required: false, help_text: "Vertical fold-change lines at ±this value." },
    ],
    execution: { runtime: "javascript" },
    trusted: true,
  },
];

for (const m of manifests) {
  const errors = validateManifest(m);
  if (errors.length) throw new Error(`Invalid manifest "${m.id}": ${errors.join(", ")}`);
}

const manifestById = new Map(manifests.map((m) => [m.id, m]));

export function getManifest(id: string): NodeManifest | undefined {
  return manifestById.get(id) ?? getCustomManifest(id);
}

export function listManifests(): NodeManifest[] {
  return [...manifests, ...listCustomManifests()];
}
