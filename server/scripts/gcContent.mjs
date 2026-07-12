#!/usr/bin/env node
// Real computation: parses an uploaded FASTA or FASTQ file and reports
// genuine sequence statistics. No mocked numbers anywhere in this file.
import { readFileSync } from "node:fs";

function parseSequences(text) {
  const trimmed = text.trimStart();
  if (trimmed.startsWith(">")) {
    // FASTA: header lines start with '>', sequence spans following lines.
    const seqs = [];
    let current = "";
    for (const line of trimmed.split(/\r?\n/)) {
      if (line.startsWith(">")) {
        if (current) seqs.push(current);
        current = "";
      } else {
        current += line.trim();
      }
    }
    if (current) seqs.push(current);
    return seqs;
  }
  if (trimmed.startsWith("@")) {
    // FASTQ: 4 lines per record, sequence is line 2 of each group.
    const lines = trimmed.split(/\r?\n/);
    const seqs = [];
    for (let i = 0; i + 1 < lines.length; i += 4) {
      if (lines[i].startsWith("@") && lines[i + 1]) seqs.push(lines[i + 1].trim());
    }
    return seqs;
  }
  throw new Error("Unrecognized file format: expected FASTA ('>') or FASTQ ('@') header.");
}

function main() {
  const payload = JSON.parse(process.argv[2] ?? "{}");
  const file = payload.resolvedFiles?.[0];
  if (!file) throw new Error("No input file provided. Connect a File Input node with an uploaded FASTA/FASTQ file.");

  const text = readFileSync(file.path, "utf8");
  const sequences = parseSequences(text);
  if (sequences.length === 0) throw new Error("No sequences found in the input file.");

  let totalBases = 0;
  let gcCount = 0;
  let nCount = 0;
  const lengths = [];

  for (const seq of sequences) {
    lengths.push(seq.length);
    totalBases += seq.length;
    for (const base of seq.toUpperCase()) {
      if (base === "G" || base === "C") gcCount++;
      else if (base === "N") nCount++;
    }
  }

  const gcPercent = totalBases > 0 ? (gcCount / totalBases) * 100 : 0;
  const avgLength = totalBases / sequences.length;

  const result = {
    summary: `Computed real GC content from ${file.filename}: ${sequences.length} sequence(s), ${gcPercent.toFixed(2)}% GC.`,
    filename: file.filename,
    sequence_count: sequences.length,
    total_bases: totalBases,
    gc_count: gcCount,
    gc_percent: Number(gcPercent.toFixed(4)),
    n_count: nCount,
    avg_length: Number(avgLength.toFixed(2)),
    min_length: Math.min(...lengths),
    max_length: Math.max(...lengths),
  };

  process.stdout.write(JSON.stringify(result));
}

main();
