export type ParamType = "string" | "number" | "select" | "boolean" | "file_ref";

export interface ParamOption {
  value: string;
  label: string;
}

export interface ParamSchema {
  id: string;
  label: string;
  type: ParamType;
  default: string | number | boolean;
  options?: ParamOption[];
  required: boolean;
  help_text: string;
}

export type NodeCategory = "input" | "process" | "ai" | "database" | "viz" | "output";

export interface NodeRegistryEntry {
  id: string;
  label: string;
  category: NodeCategory;
  description: string;
  icon: string; // lucide icon name
  input_types: string[];
  output_types: string[];
  params: ParamSchema[];
}

export const NODE_CATEGORIES: Record<NodeCategory, { label: string; color: string }> = {
  input: { label: "Input", color: "hsl(var(--primary))" },
  process: { label: "Process", color: "hsl(var(--foreground))" },
  ai: { label: "AI", color: "hsl(var(--accent))" },
  database: { label: "Database", color: "hsl(142, 71%, 45%)" },
  viz: { label: "Visualization", color: "hsl(280, 67%, 55%)" },
  output: { label: "Output", color: "hsl(25, 95%, 53%)" },
};

export const nodeRegistry: NodeRegistryEntry[] = [
  // Input nodes
  {
    id: "file_input",
    label: "File Input",
    category: "input",
    description: "Upload FASTQ, FASTA, VCF, or CSV files for analysis.",
    icon: "Upload",
    input_types: [],
    output_types: ["fastq", "fasta", "vcf", "csv"],
    params: [
      { id: "file_format", label: "File format", type: "select", default: "fastq", options: [{ value: "fastq", label: "FASTQ" }, { value: "fasta", label: "FASTA" }, { value: "vcf", label: "VCF" }, { value: "csv", label: "CSV" }], required: true, help_text: "Format of the uploaded file." },
      { id: "paired_end", label: "Paired-end reads", type: "boolean", default: true, required: false, help_text: "Enable for paired-end sequencing data." },
    ],
  },
  {
    id: "sra_input",
    label: "SRA Download",
    category: "input",
    description: "Download sequencing data from NCBI SRA by accession.",
    icon: "Download",
    input_types: [],
    output_types: ["fastq"],
    params: [
      { id: "accession", label: "SRA Accession", type: "string", default: "", required: true, help_text: "e.g. SRR1234567" },
      { id: "split_files", label: "Split paired files", type: "boolean", default: true, required: false, help_text: "Split into forward and reverse reads." },
    ],
  },
  // Process nodes
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
  },
  {
    id: "fastqc",
    label: "FastQC",
    category: "process",
    description: "Quality control checks on raw sequencing data.",
    icon: "ShieldCheck",
    input_types: ["fastq"],
    output_types: ["html", "json"],
    params: [
      { id: "threads", label: "Threads", type: "number", default: 4, required: false, help_text: "Number of parallel threads." },
    ],
  },
  {
    id: "trimmomatic",
    label: "Trimmomatic",
    category: "process",
    description: "Trim adapters and low-quality bases from reads.",
    icon: "Scissors",
    input_types: ["fastq"],
    output_types: ["fastq"],
    params: [
      { id: "quality_threshold", label: "Quality threshold", type: "number", default: 20, required: true, help_text: "Minimum Phred quality score." },
      { id: "min_length", label: "Min read length", type: "number", default: 36, required: true, help_text: "Discard reads shorter than this." },
      { id: "adapter", label: "Adapter sequence", type: "select", default: "TruSeq3", options: [{ value: "TruSeq3", label: "TruSeq3" }, { value: "TruSeq2", label: "TruSeq2" }, { value: "Nextera", label: "Nextera" }], required: true, help_text: "Adapter set to trim." },
    ],
  },
  {
    id: "star_alignment",
    label: "STAR Alignment",
    category: "process",
    description: "Aligns RNA-seq reads to a reference genome using STAR.",
    icon: "GitBranch",
    input_types: ["fastq"],
    output_types: ["bam"],
    params: [
      { id: "reference_genome", label: "Reference genome", type: "select", default: "GRCh38", options: [{ value: "GRCh38", label: "GRCh38 (human)" }, { value: "GRCm39", label: "GRCm39 (mouse)" }, { value: "custom", label: "Custom (upload)" }], required: true, help_text: "Must match the organism your samples came from." },
      { id: "alignment_mode", label: "Alignment mode", type: "select", default: "2-pass", options: [{ value: "2-pass", label: "2-pass (recommended)" }, { value: "1-pass", label: "1-pass (faster)" }], required: false, help_text: "2-pass mode improves splice junction discovery." },
    ],
  },
  {
    id: "featurecounts",
    label: "featureCounts",
    category: "process",
    description: "Counts reads mapped to genomic features (genes/exons).",
    icon: "BarChart3",
    input_types: ["bam"],
    output_types: ["tsv"],
    params: [
      { id: "annotation", label: "Annotation", type: "select", default: "gencode_v44", options: [{ value: "gencode_v44", label: "GENCODE v44" }, { value: "ensembl_110", label: "Ensembl 110" }], required: true, help_text: "Gene annotation file." },
      { id: "strand", label: "Strandedness", type: "select", default: "reverse", options: [{ value: "unstranded", label: "Unstranded" }, { value: "forward", label: "Forward" }, { value: "reverse", label: "Reverse" }], required: true, help_text: "Must match your library prep." },
    ],
  },
  {
    id: "deseq2",
    label: "DESeq2",
    category: "process",
    description: "Differential gene expression analysis.",
    icon: "TrendingUp",
    input_types: ["tsv"],
    output_types: ["tsv"],
    params: [
      { id: "control", label: "Control condition", type: "string", default: "", required: true, help_text: "Name of the control/baseline group." },
      { id: "treatment", label: "Treatment condition", type: "string", default: "", required: true, help_text: "Name of the experimental group." },
      { id: "padj_cutoff", label: "Adj. p-value cutoff", type: "number", default: 0.05, required: true, help_text: "Significance threshold for adjusted p-values." },
      { id: "lfc_threshold", label: "Log2FC threshold", type: "number", default: 1, required: false, help_text: "Minimum log2 fold change to report." },
    ],
  },
  {
    id: "blast",
    label: "BLAST",
    category: "process",
    description: "Search sequence databases for homologous sequences.",
    icon: "Search",
    input_types: ["fasta"],
    output_types: ["json"],
    params: [
      { id: "program", label: "Program", type: "select", default: "blastn", options: [{ value: "blastn", label: "blastn (nucleotide)" }, { value: "blastp", label: "blastp (protein)" }, { value: "blastx", label: "blastx (translated)" }], required: true, help_text: "BLAST variant to run." },
      { id: "evalue", label: "E-value threshold", type: "number", default: 0.001, required: true, help_text: "Maximum expect value for reported hits." },
      { id: "max_hits", label: "Max hits", type: "number", default: 50, required: false, help_text: "Maximum number of alignments to return." },
    ],
  },
  // Database nodes
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
  },
  {
    id: "uniprot_fetch",
    label: "UniProt Lookup",
    category: "database",
    description: "Fetch protein information from UniProt.",
    icon: "Atom",
    input_types: [],
    output_types: ["json"],
    params: [
      { id: "accession", label: "UniProt Accession", type: "string", default: "", required: true, help_text: "e.g. P12345" },
    ],
  },
  // Visualization nodes
  {
    id: "heatmap",
    label: "Heatmap",
    category: "viz",
    description: "Generate a clustered heatmap from expression data.",
    icon: "Grid3x3",
    input_types: ["tsv"],
    output_types: ["png", "html"],
    params: [
      { id: "clustering", label: "Clustering", type: "select", default: "both", options: [{ value: "both", label: "Rows & Columns" }, { value: "rows", label: "Rows only" }, { value: "columns", label: "Columns only" }, { value: "none", label: "None" }], required: false, help_text: "Hierarchical clustering method." },
      { id: "top_genes", label: "Top N genes", type: "number", default: 50, required: false, help_text: "Number of most variable genes to display." },
    ],
  },
  {
    id: "volcano_plot",
    label: "Volcano Plot",
    category: "viz",
    description: "Visualize differential expression as a volcano plot.",
    icon: "Triangle",
    input_types: ["tsv"],
    output_types: ["png", "html"],
    params: [
      { id: "padj_line", label: "P-adj threshold line", type: "number", default: 0.05, required: false, help_text: "Draw horizontal line at this threshold." },
      { id: "lfc_line", label: "Log2FC threshold lines", type: "number", default: 1, required: false, help_text: "Draw vertical lines at ±this value." },
    ],
  },
  // Output nodes
  {
    id: "webhook_export",
    label: "Webhook Alert",
    category: "output",
    description: "Send pipeline results to a Slack, Discord, or custom webhook URL.",
    icon: "BellRing",
    input_types: ["json", "text", "csv"],
    output_types: [],
    params: [
      { id: "url", label: "Webhook URL", type: "string", default: "", required: true, help_text: "The destination URL for the HTTP POST." },
      { id: "message", label: "Custom Message", type: "string", default: "Pipeline Execution Complete", required: false, help_text: "Text to accompany the payload." },
    ],
  },
  {
    id: "csv_export",
    label: "CSV Export",
    category: "output",
    description: "Export results as formatted CSV files.",
    icon: "FileDown",
    input_types: ["tsv", "json", "csv"],
    output_types: ["csv"],
    params: [
      { id: "delimiter", label: "Delimiter", type: "select", default: "comma", options: [{ value: "comma", label: "Comma (CSV)" }, { value: "tab", label: "Tab (TSV)" }], required: false, help_text: "Column separator in the output file." },
    ],
  },
  // AI node
  {
    id: "ai_interpret",
    label: "AI Interpret",
    category: "ai",
    description: "Get plain-language interpretation of analysis results.",
    icon: "Sparkles",
    input_types: ["tsv", "json", "html"],
    output_types: ["text"],
    params: [
      { id: "audience", label: "Audience level", type: "select", default: "wet_lab_student", options: [{ value: "wet_lab_student", label: "Wet lab student" }, { value: "bioinformatician", label: "Bioinformatician" }, { value: "pi", label: "PI / Reviewer" }], required: true, help_text: "Adjusts explanation complexity." },
      { id: "focus", label: "Focus area", type: "select", default: "summary", options: [{ value: "summary", label: "General summary" }, { value: "biological", label: "Biological significance" }, { value: "methods", label: "Methods description" }], required: false, help_text: "What aspect to emphasize." },
    ],
  },
];

export function getNodesByCategory(category: NodeCategory): NodeRegistryEntry[] {
  return nodeRegistry.filter((n) => n.category === category);
}

export function getNodeById(id: string): NodeRegistryEntry | undefined {
  return nodeRegistry.find((n) => n.id === id);
}
