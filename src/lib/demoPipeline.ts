import { Node, Edge } from "reactflow";
import { PipelineNodeData } from "@/store/pipelineStore";

const Y_SPACING = 160;
const X_CENTER = 400;
const X_OFFSET = 260;

function demoNode(
  id: string,
  tool: string,
  label: string,
  category: string,
  description: string,
  icon: string,
  params: Record<string, any>,
  x: number,
  y: number,
  status: PipelineNodeData["status"] = "idle"
): Node<PipelineNodeData> {
  return {
    id,
    type: "bioflow",
    position: { x, y },
    data: { tool, label, category, description, icon, params, status },
  };
}

// ─── Demo 1: RNA-seq WT vs Knockout ───
export const DEMO_PIPELINE_NAME = "RNA-seq — WT vs Knockout";

export const demoPipelineNodes: Node<PipelineNodeData>[] = [
  demoNode("demo-1", "file_input", "File Input", "input", "Upload FASTQ, FASTA, VCF, or CSV files for analysis.", "Upload",
    { file_url: "https://example.com/WT_KO_reads.fq.gz", file_format: "fastq", paired_end: true }, X_CENTER, 0),
  demoNode("demo-2", "fastqc", "FastQC", "process", "Quality control checks on raw sequencing data.", "ShieldCheck",
    { threads: 4 }, X_CENTER - X_OFFSET, Y_SPACING),
  demoNode("demo-3", "trimmomatic", "Trimmomatic", "process", "Trim adapters and low-quality bases from reads.", "Scissors",
    { quality_threshold: 20, min_length: 36, adapter: "TruSeq3" }, X_CENTER + X_OFFSET, Y_SPACING),
  demoNode("demo-4", "star_alignment", "STAR Alignment", "process", "Aligns RNA-seq reads to a reference genome using STAR.", "GitBranch",
    { reference_genome: "GRCh38", alignment_mode: "2-pass" }, X_CENTER, Y_SPACING * 2),
  demoNode("demo-5", "featurecounts", "featureCounts", "process", "Counts reads mapped to genomic features (genes/exons).", "BarChart3",
    { annotation: "gencode_v44", strand: "reverse" }, X_CENTER, Y_SPACING * 3),
  demoNode("demo-6", "deseq2", "DESeq2", "process", "Differential gene expression analysis.", "TrendingUp",
    { control: "Wild Type", treatment: "BRCA1-KO", padj_cutoff: 0.05, lfc_threshold: 1 }, X_CENTER, Y_SPACING * 4),
  demoNode("demo-7", "volcano_plot", "Volcano Plot", "viz", "Visualize differential expression as a volcano plot.", "Triangle",
    { padj_line: 0.05, lfc_line: 1 }, X_CENTER - X_OFFSET, Y_SPACING * 5),
  demoNode("demo-8", "heatmap", "Heatmap", "viz", "Generate a clustered heatmap from expression data.", "Grid3x3",
    { clustering: "both", top_genes: 50 }, X_CENTER + X_OFFSET, Y_SPACING * 5),
  demoNode("demo-9", "ai_interpret", "AI Interpret", "ai", "Get plain-language interpretation of analysis results.", "Sparkles",
    { audience: "pi", focus: "biological" }, X_CENTER - X_OFFSET, Y_SPACING * 6),
  demoNode("demo-10", "csv_export", "CSV Export", "output", "Export results as formatted CSV files.", "FileDown",
    { delimiter: "comma" }, X_CENTER + X_OFFSET, Y_SPACING * 6),
];

export const demoPipelineEdges: Edge[] = [
  { id: "e1-2", source: "demo-1", target: "demo-2", type: "smoothstep" },
  { id: "e1-3", source: "demo-1", target: "demo-3", type: "smoothstep" },
  { id: "e3-4", source: "demo-3", target: "demo-4", type: "smoothstep" },
  { id: "e4-5", source: "demo-4", target: "demo-5", type: "smoothstep" },
  { id: "e5-6", source: "demo-5", target: "demo-6", type: "smoothstep" },
  { id: "e6-7", source: "demo-6", target: "demo-7", type: "smoothstep" },
  { id: "e6-8", source: "demo-6", target: "demo-8", type: "smoothstep" },
  { id: "e6-9", source: "demo-6", target: "demo-9", type: "smoothstep" },
  { id: "e6-10", source: "demo-6", target: "demo-10", type: "smoothstep" },
];

// ─── Demo 2: ChIP-seq Peak Calling ───
export const DEMO2_PIPELINE_NAME = "ChIP-seq — H3K27ac Peak Analysis";

export const demo2PipelineNodes: Node<PipelineNodeData>[] = [
  demoNode("chip-1", "file_input", "Treatment FASTQ", "input", "Upload ChIP-seq treatment reads.", "Upload",
    { file_url: "https://example.com/H3K27ac_treatment.fq.gz", file_format: "fastq", paired_end: false }, X_CENTER - X_OFFSET / 2, 0),
  demoNode("chip-2", "file_input", "Input Control FASTQ", "input", "Upload ChIP-seq input control reads.", "Upload",
    { file_url: "https://example.com/H3K27ac_input.fq.gz", file_format: "fastq", paired_end: false }, X_CENTER + X_OFFSET / 2, 0),

  demoNode("chip-3", "fastqc", "FastQC — Treatment", "process", "Quality control on treatment reads.", "ShieldCheck",
    { threads: 4 }, X_CENTER - X_OFFSET / 2, Y_SPACING),
  demoNode("chip-4", "fastqc", "FastQC — Control", "process", "Quality control on input control reads.", "ShieldCheck",
    { threads: 4 }, X_CENTER + X_OFFSET / 2, Y_SPACING),

  demoNode("chip-5", "trimmomatic", "Trim — Treatment", "process", "Trim adapters from treatment reads.", "Scissors",
    { quality_threshold: 25, min_length: 30, adapter: "Nextera" }, X_CENTER - X_OFFSET / 2, Y_SPACING * 2),
  demoNode("chip-6", "trimmomatic", "Trim — Control", "process", "Trim adapters from control reads.", "Scissors",
    { quality_threshold: 25, min_length: 30, adapter: "Nextera" }, X_CENTER + X_OFFSET / 2, Y_SPACING * 2),

  demoNode("chip-7", "star_alignment", "BWA Align Treatment", "process", "Align treatment reads to reference genome.", "GitBranch",
    { reference_genome: "GRCh38", alignment_mode: "1-pass" }, X_CENTER - X_OFFSET / 2, Y_SPACING * 3),
  demoNode("chip-8", "star_alignment", "BWA Align Control", "process", "Align control reads to reference genome.", "GitBranch",
    { reference_genome: "GRCh38", alignment_mode: "1-pass" }, X_CENTER + X_OFFSET / 2, Y_SPACING * 3),

  demoNode("chip-9", "filter_data", "MACS2 Peak Calling", "process", "Call peaks using MACS2 with treatment vs control.", "Filter",
    { column: "q_value", operator: "<", value: 0.01 }, X_CENTER, Y_SPACING * 4),

  demoNode("chip-10", "heatmap", "Peak Heatmap", "viz", "Heatmap of signal intensity around peaks.", "Grid3x3",
    { clustering: "rows", top_genes: 100 }, X_CENTER - X_OFFSET, Y_SPACING * 5),
  demoNode("chip-11", "ai_interpret", "AI Peak Summary", "ai", "Interpret enrichment patterns and biological context.", "Sparkles",
    { audience: "pi", focus: "biological" }, X_CENTER, Y_SPACING * 5),
  demoNode("chip-12", "csv_export", "Export Peaks", "output", "Export peak coordinates and statistics.", "FileDown",
    { delimiter: "tab" }, X_CENTER + X_OFFSET, Y_SPACING * 5),
];

export const demo2PipelineEdges: Edge[] = [
  { id: "ce1-3", source: "chip-1", target: "chip-3", type: "smoothstep" },
  { id: "ce2-4", source: "chip-2", target: "chip-4", type: "smoothstep" },
  { id: "ce3-5", source: "chip-3", target: "chip-5", type: "smoothstep" },
  { id: "ce4-6", source: "chip-4", target: "chip-6", type: "smoothstep" },
  { id: "ce5-7", source: "chip-5", target: "chip-7", type: "smoothstep" },
  { id: "ce6-8", source: "chip-6", target: "chip-8", type: "smoothstep" },
  { id: "ce7-9", source: "chip-7", target: "chip-9", type: "smoothstep" },
  { id: "ce8-9", source: "chip-8", target: "chip-9", type: "smoothstep" },
  { id: "ce9-10", source: "chip-9", target: "chip-10", type: "smoothstep" },
  { id: "ce9-11", source: "chip-9", target: "chip-11", type: "smoothstep" },
  { id: "ce9-12", source: "chip-9", target: "chip-12", type: "smoothstep" },
];

// ─── Demo 3: Variant Calling (WGS) ───
export const DEMO3_PIPELINE_NAME = "Variant Calling — WGS Tumor vs Normal";

export const demo3PipelineNodes: Node<PipelineNodeData>[] = [
  demoNode("var-1", "file_input", "Tumor FASTQ", "input", "Upload whole-genome tumor sample reads.", "Upload",
    { file_url: "https://example.com/tumor_wgs.fq.gz", file_format: "fastq", paired_end: true }, X_CENTER - X_OFFSET / 2, 0),
  demoNode("var-2", "file_input", "Normal FASTQ", "input", "Upload matched normal sample reads.", "Upload",
    { file_url: "https://example.com/normal_wgs.fq.gz", file_format: "fastq", paired_end: true }, X_CENTER + X_OFFSET / 2, 0),

  demoNode("var-3", "trimmomatic", "Trim — Tumor", "process", "Trim adapters from tumor reads.", "Scissors",
    { quality_threshold: 20, min_length: 50, adapter: "TruSeq3" }, X_CENTER - X_OFFSET / 2, Y_SPACING),
  demoNode("var-4", "trimmomatic", "Trim — Normal", "process", "Trim adapters from normal reads.", "Scissors",
    { quality_threshold: 20, min_length: 50, adapter: "TruSeq3" }, X_CENTER + X_OFFSET / 2, Y_SPACING),

  demoNode("var-5", "star_alignment", "BWA Align Tumor", "process", "Align tumor reads to GRCh38 reference.", "GitBranch",
    { reference_genome: "GRCh38", alignment_mode: "1-pass" }, X_CENTER - X_OFFSET / 2, Y_SPACING * 2),
  demoNode("var-6", "star_alignment", "BWA Align Normal", "process", "Align normal reads to GRCh38 reference.", "GitBranch",
    { reference_genome: "GRCh38", alignment_mode: "1-pass" }, X_CENTER + X_OFFSET / 2, Y_SPACING * 2),

  demoNode("var-7", "filter_data", "GATK Mutect2", "process", "Somatic variant calling: tumor vs matched normal.", "Filter",
    { column: "TLOD", operator: ">", value: 6.3 }, X_CENTER, Y_SPACING * 3),

  demoNode("var-8", "filter_data", "Filter PASS Variants", "process", "Keep only PASS-filtered high-confidence variants.", "Filter",
    { column: "FILTER", operator: "==", value: "PASS" }, X_CENTER, Y_SPACING * 4),

  demoNode("var-9", "ncbi_fetch", "ClinVar Annotation", "database", "Annotate variants with ClinVar clinical significance.", "Database",
    { database: "nucleotide", query: "clinvar somatic" }, X_CENTER - X_OFFSET, Y_SPACING * 5),
  demoNode("var-10", "ai_interpret", "AI Variant Report", "ai", "Generate clinical-grade variant interpretation.", "Sparkles",
    { audience: "pi", focus: "biological" }, X_CENTER, Y_SPACING * 5),
  demoNode("var-11", "csv_export", "Export VCF", "output", "Export annotated variant calls.", "FileDown",
    { delimiter: "tab" }, X_CENTER + X_OFFSET, Y_SPACING * 5),
];

export const demo3PipelineEdges: Edge[] = [
  { id: "ve1-3", source: "var-1", target: "var-3", type: "smoothstep" },
  { id: "ve2-4", source: "var-2", target: "var-4", type: "smoothstep" },
  { id: "ve3-5", source: "var-3", target: "var-5", type: "smoothstep" },
  { id: "ve4-6", source: "var-4", target: "var-6", type: "smoothstep" },
  { id: "ve5-7", source: "var-5", target: "var-7", type: "smoothstep" },
  { id: "ve6-7", source: "var-6", target: "var-7", type: "smoothstep" },
  { id: "ve7-8", source: "var-7", target: "var-8", type: "smoothstep" },
  { id: "ve8-9", source: "var-8", target: "var-9", type: "smoothstep" },
  { id: "ve8-10", source: "var-8", target: "var-10", type: "smoothstep" },
  { id: "ve8-11", source: "var-8", target: "var-11", type: "smoothstep" },
];

// All demos for easy access
export const ALL_DEMOS = [
  { name: DEMO_PIPELINE_NAME, nodes: demoPipelineNodes, edges: demoPipelineEdges },
  { name: DEMO2_PIPELINE_NAME, nodes: demo2PipelineNodes, edges: demo2PipelineEdges },
  { name: DEMO3_PIPELINE_NAME, nodes: demo3PipelineNodes, edges: demo3PipelineEdges },
];
