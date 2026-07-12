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
