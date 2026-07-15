// Real tabular-omics computation: matrix parsing, PCA (via symmetric
// eigendecomposition), k-means clustering, ROC/AUC, and normalization —
// plus server-side SVG rendering so visual nodes emit real plots, not
// placeholder images. Pure functions, no I/O, so they're unit-testable and
// reusable across executors.

export interface OmicsMatrix {
  samples: string[];    // row labels (sample ids)
  features: string[];   // column labels (metabolites / features)
  matrix: number[][];   // samples × features, numeric
  groups: string[] | null; // per-sample class labels, if a group column exists
}

const GROUP_COLUMN_NAMES = ["group", "class", "condition", "label", "phenotype"];

// Parses a samples-in-rows CSV/TSV: first column = sample id, an optional
// group column (by known name, else the last column if non-numeric), and the
// remaining numeric columns as features.
export function parseMatrixCsv(text: string): OmicsMatrix {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error("CSV needs a header row and at least one data row.");
  const delim = lines[0].includes("\t") ? "\t" : ",";
  const header = lines[0].split(delim).map((c) => c.trim());
  const rows = lines.slice(1).map((l) => l.split(delim).map((c) => c.trim()));

  let groupIdx = header.findIndex((h) => GROUP_COLUMN_NAMES.includes(h.toLowerCase()));
  if (groupIdx === -1) {
    // Fall back to the last column only if it looks categorical (non-numeric).
    const lastIdx = header.length - 1;
    const lastLooksNumeric = rows.every((r) => Number.isFinite(Number(r[lastIdx])));
    if (!lastLooksNumeric) groupIdx = lastIdx;
  }

  const featureCols = header
    .map((name, i) => ({ name, i }))
    .filter(({ i }) => i !== 0 && i !== groupIdx);

  const samples = rows.map((r) => r[0]);
  const groups = groupIdx >= 0 ? rows.map((r) => r[groupIdx]) : null;
  const features = featureCols.map((c) => c.name);
  const matrix = rows.map((r) =>
    featureCols.map((c) => {
      const v = Number(r[c.i]);
      return Number.isFinite(v) ? v : 0;
    })
  );

  if (features.length === 0) throw new Error("No numeric feature columns found in the matrix.");
  return { samples, features, matrix, groups };
}

// ─── Normalization / scaling ───────────────────────────────────────────

function columnMeans(m: number[][]): number[] {
  const n = m.length;
  const p = m[0].length;
  const means = new Array(p).fill(0);
  for (const row of m) for (let j = 0; j < p; j++) means[j] += row[j];
  return means.map((s) => s / n);
}

function columnStdevs(m: number[][], means: number[]): number[] {
  const n = m.length;
  const p = m[0].length;
  const vars = new Array(p).fill(0);
  for (const row of m) for (let j = 0; j < p; j++) vars[j] += (row[j] - means[j]) ** 2;
  return vars.map((s) => Math.sqrt(s / Math.max(1, n - 1)) || 1);
}

export type Transform = "none" | "log2";
export type Scaling = "none" | "zscore" | "pareto";

export function transformScale(m: number[][], transform: Transform, scaling: Scaling): number[][] {
  let out = m;
  if (transform === "log2") {
    out = out.map((row) => row.map((v) => (v > 0 ? Math.log2(v) : 0)));
  }
  if (scaling === "none") return out;
  const means = columnMeans(out);
  const stds = columnStdevs(out, means);
  return out.map((row) =>
    row.map((v, j) => {
      const centered = v - means[j];
      if (scaling === "zscore") return centered / stds[j];
      // Pareto: divide by sqrt(std) — softer than autoscaling, common in metabolomics.
      return centered / Math.sqrt(stds[j] || 1);
    })
  );
}

// ─── PCA via symmetric eigendecomposition (cyclic Jacobi) ──────────────

// Classic cyclic Jacobi eigenvalue algorithm for a real symmetric matrix.
// Returns eigenvalues and eigenvectors (columns), unsorted. Reliable and
// exact-to-tolerance for the small covariance matrices metabolomics produces.
function jacobiEigen(aIn: number[][], maxSweeps = 100): { values: number[]; vectors: number[][] } {
  const n = aIn.length;
  const a = aIn.map((r) => r.slice());
  const v: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  );

  const offDiagNorm = () => {
    let s = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) s += a[i][j] * a[i][j];
    return Math.sqrt(s);
  };

  for (let sweep = 0; sweep < maxSweeps && offDiagNorm() > 1e-12; sweep++) {
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-15) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let i = 0; i < n; i++) {
          const aip = a[i][p];
          const aiq = a[i][q];
          a[i][p] = c * aip - s * aiq;
          a[i][q] = s * aip + c * aiq;
        }
        for (let i = 0; i < n; i++) {
          const api = a[p][i];
          const aqi = a[q][i];
          a[p][i] = c * api - s * aqi;
          a[q][i] = s * api + c * aqi;
        }
        for (let i = 0; i < n; i++) {
          const vip = v[i][p];
          const viq = v[i][q];
          v[i][p] = c * vip - s * viq;
          v[i][q] = s * vip + c * viq;
        }
      }
    }
  }
  return { values: a.map((_, i) => a[i][i]), vectors: v };
}

export interface PcaResult {
  scores: number[][];            // samples × nComponents
  explainedVariance: number[];   // ratio per retained component
  nComponents: number;
}

export function pca(matrix: number[][], nComponents = 2): PcaResult {
  const n = matrix.length;
  const p = matrix[0].length;
  const means = columnMeans(matrix);
  const centered = matrix.map((row) => row.map((v, j) => v - means[j]));

  // Covariance (p × p).
  const cov = Array.from({ length: p }, () => new Array(p).fill(0));
  for (let i = 0; i < p; i++) {
    for (let j = i; j < p; j++) {
      let s = 0;
      for (let k = 0; k < n; k++) s += centered[k][i] * centered[k][j];
      const c = s / Math.max(1, n - 1);
      cov[i][j] = c;
      cov[j][i] = c;
    }
  }

  const { values, vectors } = jacobiEigen(cov);
  const order = values.map((val, i) => ({ val, i })).sort((a, b) => b.val - a.val);
  const totalVar = values.reduce((acc, v) => acc + Math.max(0, v), 0) || 1;
  const k = Math.min(nComponents, p);

  const scores = centered.map((row) => {
    const coords: number[] = [];
    for (let c = 0; c < k; c++) {
      const compIdx = order[c].i;
      let dot = 0;
      for (let j = 0; j < p; j++) dot += row[j] * vectors[j][compIdx];
      coords.push(dot);
    }
    return coords;
  });

  return {
    scores,
    explainedVariance: order.slice(0, k).map((o) => Math.max(0, o.val) / totalVar),
    nComponents: k,
  };
}

// ─── k-means clustering ────────────────────────────────────────────────

function euclidean(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return Math.sqrt(s);
}

export interface KMeansResult {
  assignments: number[];
  k: number;
  inertia: number;
  silhouette: number;
}

// Lloyd's algorithm with k-means++ seeding and a few restarts; returns the
// best (lowest-inertia) run plus a silhouette score for cluster quality.
export function kmeans(matrix: number[][], k: number, restarts = 5, maxIter = 100): KMeansResult {
  const n = matrix.length;
  if (k < 1 || k > n) throw new Error(`k must be between 1 and the sample count (${n}).`);

  let best: { assignments: number[]; inertia: number } | null = null;

  for (let attempt = 0; attempt < restarts; attempt++) {
    // k-means++ seeding.
    const centroids: number[][] = [matrix[Math.floor(Math.random() * n)].slice()];
    while (centroids.length < k) {
      const d2 = matrix.map((row) => Math.min(...centroids.map((c) => euclidean(row, c) ** 2)));
      const sum = d2.reduce((a, b) => a + b, 0) || 1;
      let r = Math.random() * sum;
      let idx = 0;
      while (r > 0 && idx < n - 1) r -= d2[idx++];
      centroids.push(matrix[idx].slice());
    }

    let assignments = new Array(n).fill(0);
    for (let iter = 0; iter < maxIter; iter++) {
      let changed = false;
      for (let i = 0; i < n; i++) {
        let bestC = 0;
        let bestD = Infinity;
        for (let c = 0; c < k; c++) {
          const d = euclidean(matrix[i], centroids[c]);
          if (d < bestD) { bestD = d; bestC = c; }
        }
        if (assignments[i] !== bestC) { assignments[i] = bestC; changed = true; }
      }
      for (let c = 0; c < k; c++) {
        const members = matrix.filter((_, i) => assignments[i] === c);
        if (members.length === 0) continue;
        for (let j = 0; j < members[0].length; j++) {
          centroids[c][j] = members.reduce((s, row) => s + row[j], 0) / members.length;
        }
      }
      if (!changed) break;
    }

    const inertia = matrix.reduce((s, row, i) => s + euclidean(row, centroids[assignments[i]]) ** 2, 0);
    if (!best || inertia < best.inertia) best = { assignments: assignments.slice(), inertia };
  }

  const assignments = best!.assignments;
  return { assignments, k, inertia: best!.inertia, silhouette: silhouetteScore(matrix, assignments) };
}

function silhouetteScore(matrix: number[][], assignments: number[]): number {
  const n = matrix.length;
  const clusters = new Set(assignments);
  if (clusters.size < 2) return 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const own = assignments[i];
    const sameDists: number[] = [];
    const otherDistsByCluster = new Map<number, number[]>();
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const d = euclidean(matrix[i], matrix[j]);
      if (assignments[j] === own) sameDists.push(d);
      else {
        if (!otherDistsByCluster.has(assignments[j])) otherDistsByCluster.set(assignments[j], []);
        otherDistsByCluster.get(assignments[j])!.push(d);
      }
    }
    const a = sameDists.length ? sameDists.reduce((s, d) => s + d, 0) / sameDists.length : 0;
    const b = Math.min(
      ...Array.from(otherDistsByCluster.values()).map((ds) => ds.reduce((s, d) => s + d, 0) / ds.length)
    );
    total += b === a ? 0 : (b - a) / Math.max(a, b);
  }
  return total / n;
}

// ─── ROC / AUC ─────────────────────────────────────────────────────────

export interface RocResult {
  auc: number;
  points: Array<{ fpr: number; tpr: number }>;
  direction: "higher" | "lower";
}

// AUC via the Mann-Whitney U relationship (rank-based, ties-averaged), so it's
// exact rather than trapezoid-approximated. `labels` are 1 for the positive
// class, 0 otherwise. Auto-orients so AUC >= 0.5 and reports the direction.
export function rocAuc(values: number[], labels: number[]): RocResult {
  const pos = values.filter((_, i) => labels[i] === 1);
  const neg = values.filter((_, i) => labels[i] === 0);
  if (pos.length === 0 || neg.length === 0)
    throw new Error("ROC needs at least one positive and one negative sample.");

  // Rank-based AUC.
  const paired = values.map((v, i) => ({ v, label: labels[i] }));
  const sorted = paired.slice().sort((a, b) => a.v - b.v);
  const ranks = new Array(sorted.length);
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j < sorted.length && sorted[j].v === sorted[i].v) j++;
    const avgRank = (i + 1 + j) / 2; // 1-based average rank for ties
    for (let k = i; k < j; k++) ranks[k] = avgRank;
    i = j;
  }
  let rankSumPos = 0;
  for (let k = 0; k < sorted.length; k++) if (sorted[k].label === 1) rankSumPos += ranks[k];
  const nPos = pos.length;
  const nNeg = neg.length;
  let auc = (rankSumPos - (nPos * (nPos + 1)) / 2) / (nPos * nNeg);
  const direction: "higher" | "lower" = auc >= 0.5 ? "higher" : "lower";
  if (auc < 0.5) auc = 1 - auc;

  // ROC curve points by sweeping thresholds (oriented so positives score high).
  const oriented = direction === "higher" ? values : values.map((v) => -v);
  const thresholds = Array.from(new Set(oriented)).sort((a, b) => b - a);
  const points: Array<{ fpr: number; tpr: number }> = [{ fpr: 0, tpr: 0 }];
  for (const t of thresholds) {
    let tp = 0;
    let fp = 0;
    for (let k = 0; k < oriented.length; k++) {
      if (oriented[k] >= t) labels[k] === 1 ? tp++ : fp++;
    }
    points.push({ fpr: fp / nNeg, tpr: tp / nPos });
  }
  points.push({ fpr: 1, tpr: 1 });
  return { auc, points, direction };
}

// ─── SVG rendering (returned as data-URI so <img> renders it directly) ──

const PALETTE = ["#2563eb", "#e11d48", "#059669", "#d97706", "#7c3aed", "#0891b2"];

function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

interface VolcanoPoint { metabolite?: string; gene?: string; log2fc: number; padj: number }

export function renderVolcanoSvg(
  data: VolcanoPoint[],
  lfcLine: number,
  padjLine: number
): string {
  const W = 640, H = 440, m = { l: 60, r: 20, t: 30, b: 50 };
  const pw = W - m.l - m.r, ph = H - m.t - m.b;
  const pts = data
    .map((d) => ({ x: d.log2fc, y: -Math.log10(Math.max(d.padj, 1e-300)), sig: Math.abs(d.log2fc) >= lfcLine && d.padj <= padjLine, up: d.log2fc > 0 }))
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  const xMax = Math.max(1, ...pts.map((p) => Math.abs(p.x))) * 1.1;
  const yMax = Math.max(1, ...pts.map((p) => p.y)) * 1.1;
  const sx = (x: number) => m.l + ((x + xMax) / (2 * xMax)) * pw;
  const sy = (y: number) => m.t + ph - (y / yMax) * ph;

  const circles = pts.map((p) => {
    const color = !p.sig ? "#94a3b8" : p.up ? "#e11d48" : "#2563eb";
    return `<circle cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="4.5" fill="${color}" fill-opacity="0.8"/>`;
  }).join("");
  const yThresh = sy(-Math.log10(padjLine));
  return svgToDataUri(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#ffffff"/>
<line x1="${m.l}" y1="${m.t + ph}" x2="${m.l + pw}" y2="${m.t + ph}" stroke="#cbd5e1"/>
<line x1="${m.l}" y1="${m.t}" x2="${m.l}" y2="${m.t + ph}" stroke="#cbd5e1"/>
<line x1="${sx(lfcLine)}" y1="${m.t}" x2="${sx(lfcLine)}" y2="${m.t + ph}" stroke="#e2e8f0" stroke-dasharray="4 3"/>
<line x1="${sx(-lfcLine)}" y1="${m.t}" x2="${sx(-lfcLine)}" y2="${m.t + ph}" stroke="#e2e8f0" stroke-dasharray="4 3"/>
<line x1="${m.l}" y1="${yThresh}" x2="${m.l + pw}" y2="${yThresh}" stroke="#e2e8f0" stroke-dasharray="4 3"/>
${circles}
<text x="${m.l + pw / 2}" y="${H - 14}" font-family="sans-serif" font-size="13" fill="#475569" text-anchor="middle">log2 fold change</text>
<text x="16" y="${m.t + ph / 2}" font-family="sans-serif" font-size="13" fill="#475569" text-anchor="middle" transform="rotate(-90 16 ${m.t + ph / 2})">-log10 adjusted p</text>
<text x="${m.l}" y="20" font-family="sans-serif" font-size="13" font-weight="600" fill="#1e293b">Volcano plot — ${pts.filter((p) => p.sig).length} significant</text>
</svg>`);
}

export function renderPcaSvg(
  scores: number[][],
  groups: string[] | null,
  explained: number[]
): string {
  const W = 560, H = 440, m = { l: 60, r: 120, t: 30, b: 50 };
  const pw = W - m.l - m.r, ph = H - m.t - m.b;
  const xs = scores.map((s) => s[0]);
  const ys = scores.map((s) => s[1] ?? 0);
  const xMax = Math.max(...xs.map(Math.abs)) * 1.15 || 1;
  const yMax = Math.max(...ys.map(Math.abs)) * 1.15 || 1;
  const sx = (x: number) => m.l + ((x + xMax) / (2 * xMax)) * pw;
  const sy = (y: number) => m.t + ph - ((y + yMax) / (2 * yMax)) * ph;
  const uniqueGroups = groups ? Array.from(new Set(groups)) : ["samples"];
  const colorOf = (i: number) => PALETTE[(groups ? uniqueGroups.indexOf(groups[i]) : 0) % PALETTE.length];

  const circles = scores.map((s, i) =>
    `<circle cx="${sx(s[0]).toFixed(1)}" cy="${sy(s[1] ?? 0).toFixed(1)}" r="5.5" fill="${colorOf(i)}" fill-opacity="0.85" stroke="#fff" stroke-width="1"/>`
  ).join("");
  const legend = uniqueGroups.map((g, i) =>
    `<circle cx="${m.l + pw + 24}" cy="${m.t + 10 + i * 20}" r="5" fill="${PALETTE[i % PALETTE.length]}"/>` +
    `<text x="${m.l + pw + 34}" y="${m.t + 14 + i * 20}" font-family="sans-serif" font-size="12" fill="#475569">${g}</text>`
  ).join("");

  return svgToDataUri(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#ffffff"/>
<line x1="${m.l}" y1="${sy(0)}" x2="${m.l + pw}" y2="${sy(0)}" stroke="#e2e8f0"/>
<line x1="${sx(0)}" y1="${m.t}" x2="${sx(0)}" y2="${m.t + ph}" stroke="#e2e8f0"/>
<rect x="${m.l}" y="${m.t}" width="${pw}" height="${ph}" fill="none" stroke="#cbd5e1"/>
${circles}${legend}
<text x="${m.l + pw / 2}" y="${H - 14}" font-family="sans-serif" font-size="13" fill="#475569" text-anchor="middle">PC1 (${(explained[0] * 100).toFixed(1)}%)</text>
<text x="16" y="${m.t + ph / 2}" font-family="sans-serif" font-size="13" fill="#475569" text-anchor="middle" transform="rotate(-90 16 ${m.t + ph / 2})">PC2 (${((explained[1] ?? 0) * 100).toFixed(1)}%)</text>
<text x="${m.l}" y="20" font-family="sans-serif" font-size="13" font-weight="600" fill="#1e293b">PCA — samples in feature space</text>
</svg>`);
}

export function renderRocSvg(points: Array<{ fpr: number; tpr: number }>, auc: number, feature: string): string {
  const W = 440, H = 440, m = { l: 55, r: 20, t: 30, b: 50 };
  const pw = W - m.l - m.r, ph = H - m.t - m.b;
  const sx = (x: number) => m.l + x * pw;
  const sy = (y: number) => m.t + ph - y * ph;
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.fpr).toFixed(1)} ${sy(p.tpr).toFixed(1)}`).join(" ");
  return svgToDataUri(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#ffffff"/>
<rect x="${m.l}" y="${m.t}" width="${pw}" height="${ph}" fill="none" stroke="#cbd5e1"/>
<line x1="${sx(0)}" y1="${sy(0)}" x2="${sx(1)}" y2="${sy(1)}" stroke="#e2e8f0" stroke-dasharray="4 3"/>
<path d="${path}" fill="none" stroke="#2563eb" stroke-width="2.5"/>
<text x="${m.l + pw / 2}" y="${H - 14}" font-family="sans-serif" font-size="13" fill="#475569" text-anchor="middle">False positive rate</text>
<text x="16" y="${m.t + ph / 2}" font-family="sans-serif" font-size="13" fill="#475569" text-anchor="middle" transform="rotate(-90 16 ${m.t + ph / 2})">True positive rate</text>
<text x="${m.l}" y="20" font-family="sans-serif" font-size="13" font-weight="600" fill="#1e293b">ROC — ${feature} (AUC ${auc.toFixed(3)})</text>
</svg>`);
}
