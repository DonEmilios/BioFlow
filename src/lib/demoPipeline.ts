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
  status: PipelineNodeData["status"] = "complete"
): Node<PipelineNodeData> {
  return {
    id,
    type: "bioflow",
    position: { x, y },
    data: { tool, label, category, description, icon, params, status },
  };
}

export const DEMO_PIPELINE_NAME = "RNA-seq — WT vs Knockout (Demo)";

export const demoPipelineNodes: Node<PipelineNodeData>[] = [
  // Row 1: Input
  demoNode("demo-1", "file_input", "File Input", "input", "Upload FASTQ, FASTA, VCF, or CSV files for analysis.", "Upload",
    { file_format: "fastq", paired_end: true }, X_CENTER, 0, "complete"),

  // Row 2: QC + Trim (parallel)
  demoNode("demo-2", "fastqc", "FastQC", "process", "Quality control checks on raw sequencing data.", "ShieldCheck",
    { threads: 4 }, X_CENTER - X_OFFSET, Y_SPACING, "complete"),
  demoNode("demo-3", "trimmomatic", "Trimmomatic", "process", "Trim adapters and low-quality bases from reads.", "Scissors",
    { quality_threshold: 20, min_length: 36, adapter: "TruSeq3" }, X_CENTER + X_OFFSET, Y_SPACING, "complete"),

  // Row 3: Alignment
  demoNode("demo-4", "star_alignment", "STAR Alignment", "process", "Aligns RNA-seq reads to a reference genome using STAR.", "GitBranch",
    { reference_genome: "GRCh38", alignment_mode: "2-pass" }, X_CENTER, Y_SPACING * 2, "complete"),

  // Row 4: Counting
  demoNode("demo-5", "featurecounts", "featureCounts", "process", "Counts reads mapped to genomic features (genes/exons).", "BarChart3",
    { annotation: "gencode_v44", strand: "reverse" }, X_CENTER, Y_SPACING * 3, "complete"),

  // Row 5: DE analysis
  demoNode("demo-6", "deseq2", "DESeq2", "process", "Differential gene expression analysis.", "TrendingUp",
    { control: "Wild Type", treatment: "BRCA1-KO", padj_cutoff: 0.05, lfc_threshold: 1 }, X_CENTER, Y_SPACING * 4, "running"),

  // Row 6: Viz + AI (parallel outputs)
  demoNode("demo-7", "volcano_plot", "Volcano Plot", "viz", "Visualize differential expression as a volcano plot.", "Triangle",
    { padj_line: 0.05, lfc_line: 1 }, X_CENTER - X_OFFSET, Y_SPACING * 5, "idle"),
  demoNode("demo-8", "heatmap", "Heatmap", "viz", "Generate a clustered heatmap from expression data.", "Grid3x3",
    { clustering: "both", top_genes: 50 }, X_CENTER + X_OFFSET, Y_SPACING * 5, "idle"),

  // Row 7: AI + Export
  demoNode("demo-9", "ai_interpret", "AI Interpret", "ai", "Get plain-language interpretation of analysis results.", "Sparkles",
    { audience: "pi", focus: "biological" }, X_CENTER - X_OFFSET, Y_SPACING * 6, "idle"),
  demoNode("demo-10", "csv_export", "CSV Export", "output", "Export results as formatted CSV files.", "FileDown",
    { delimiter: "comma" }, X_CENTER + X_OFFSET, Y_SPACING * 6, "idle"),
];

export const demoPipelineEdges: Edge[] = [
  // Input → QC + Trim
  { id: "e1-2", source: "demo-1", target: "demo-2", type: "smoothstep" },
  { id: "e1-3", source: "demo-1", target: "demo-3", type: "smoothstep" },
  // Trim → STAR
  { id: "e3-4", source: "demo-3", target: "demo-4", type: "smoothstep" },
  // STAR → featureCounts
  { id: "e4-5", source: "demo-4", target: "demo-5", type: "smoothstep" },
  // featureCounts → DESeq2
  { id: "e5-6", source: "demo-5", target: "demo-6", type: "smoothstep", animated: true },
  // DESeq2 → Viz + AI + Export
  { id: "e6-7", source: "demo-6", target: "demo-7", type: "smoothstep" },
  { id: "e6-8", source: "demo-6", target: "demo-8", type: "smoothstep" },
  { id: "e6-9", source: "demo-6", target: "demo-9", type: "smoothstep" },
  { id: "e6-10", source: "demo-6", target: "demo-10", type: "smoothstep" },
];
