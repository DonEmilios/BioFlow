// Real statistics for metabolomics biomarker discovery. No mocked numbers:
// differential abundance uses Welch's t-test, and pathway enrichment uses a
// hypergeometric (over-representation) test. Both are the standard methods a
// tool like MetaboAnalyst uses for this exact workflow.
//
// Math primitives (lgamma, regularized incomplete beta) are the textbook
// Numerical Recipes implementations, adapted to TypeScript.

const LANCZOS = [
  76.18009172947146, -86.50532032941677, 24.01409824083091,
  -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5,
];

function lgamma(x: number): number {
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) {
    y++;
    ser += LANCZOS[j] / y;
  }
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

// Continued-fraction evaluation for the incomplete beta function.
function betacf(a: number, b: number, x: number): number {
  const MAXIT = 200;
  const EPS = 3e-12;
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

// Regularized incomplete beta I_x(a, b).
function ibeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(
    lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x)
  );
  if (x < (a + 1) / (a + b + 2)) return (front * betacf(a, b, x)) / a;
  return 1 - (front * betacf(b, a, 1 - x)) / b;
}

function mean(xs: number[]): number {
  return xs.reduce((s, v) => s + v, 0) / xs.length;
}

function variance(xs: number[], m: number): number {
  if (xs.length < 2) return 0;
  return xs.reduce((s, v) => s + (v - m) * (v - m), 0) / (xs.length - 1);
}

// Two-sided Welch's t-test (unequal variances). Returns { t, df, p }.
export function welchTTest(a: number[], b: number[]): { t: number; df: number; p: number } {
  const ma = mean(a);
  const mb = mean(b);
  const va = variance(a, ma);
  const vb = variance(b, mb);
  const na = a.length;
  const nb = b.length;
  const se = Math.sqrt(va / na + vb / nb);
  if (se === 0) return { t: 0, df: na + nb - 2, p: 1 };
  const t = (ma - mb) / se;
  const num = Math.pow(va / na + vb / nb, 2);
  const den =
    Math.pow(va / na, 2) / (na - 1) + Math.pow(vb / nb, 2) / (nb - 1);
  const df = den === 0 ? na + nb - 2 : num / den;
  // P(|T| > |t|) for T ~ t(df).
  const p = ibeta(df / 2, 0.5, df / (df + t * t));
  return { t, df, p: Math.min(1, Math.max(0, p)) };
}

// Benjamini-Hochberg FDR. Returns adjusted p-values in the original order.
export function benjaminiHochberg(pvals: number[]): number[] {
  const m = pvals.length;
  const idx = pvals.map((p, i) => ({ p, i })).sort((x, y) => x.p - y.p);
  const adj = new Array(m).fill(0);
  let prev = 1;
  for (let rank = m; rank >= 1; rank--) {
    const { p, i } = idx[rank - 1];
    const q = Math.min(prev, (p * m) / rank);
    adj[i] = q;
    prev = q;
  }
  return adj;
}

// P(X >= k) for X ~ Hypergeometric(N, K, n), computed in log space.
export function hypergeometricUpperTail(k: number, N: number, K: number, n: number): number {
  const logChoose = (a: number, b: number) =>
    b < 0 || b > a ? -Infinity : lgamma(a + 1) - lgamma(b + 1) - lgamma(a - b + 1);
  const logDenom = logChoose(N, n);
  let p = 0;
  const upper = Math.min(n, K);
  for (let i = k; i <= upper; i++) {
    const logP = logChoose(K, i) + logChoose(N - K, n - i) - logDenom;
    p += Math.exp(logP);
  }
  return Math.min(1, Math.max(0, p));
}

// ─── High-level workflow ───────────────────────────────────────────────

const GROUP_COLUMN_NAMES = ["group", "class", "condition", "label", "phenotype"];

export interface MetaboliteRow {
  metabolite: string;
  mean_control: number;
  mean_case: number;
  log2fc: number;
  pvalue: number;
  padj: number; // BH-adjusted, so viz/threshold nodes can reuse the `padj` key
}

export interface DifferentialAbundanceResult {
  summary: string;
  group_control: string;
  group_case: string;
  n_control: number;
  n_case: number;
  n_metabolites: number;
  n_significant: number;
  data: MetaboliteRow[];
}

function parseCsv(text: string): { header: string[]; rows: string[][] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) throw new Error("CSV needs a header row and at least one data row.");
  const delim = lines[0].includes("\t") ? "\t" : ",";
  const header = lines[0].split(delim).map((c) => c.trim());
  const rows = lines.slice(1).map((l) => l.split(delim).map((c) => c.trim()));
  return { header, rows };
}

// Reads a samples-x-metabolites matrix (one row per sample) with one grouping
// column, and computes per-metabolite differential abundance between the two
// groups. Values are log2-transformed before the t-test — standard for the
// right-skewed intensity distributions metabolomics produces.
export function differentialAbundance(
  csvText: string,
  opts: { padjCutoff?: number; controlLabel?: string } = {}
): DifferentialAbundanceResult {
  const padjCutoff = opts.padjCutoff ?? 0.05;
  const { header, rows } = parseCsv(csvText);

  let groupIdx = header.findIndex((h) => GROUP_COLUMN_NAMES.includes(h.toLowerCase()));
  if (groupIdx === -1) groupIdx = header.length - 1; // fall back to last column

  // Metabolite columns = every numeric column that isn't the group column and
  // isn't the first column (assumed sample id).
  const metaboliteCols = header
    .map((name, i) => ({ name, i }))
    .filter(({ i }) => i !== groupIdx && i !== 0);

  const groups = rows.map((r) => r[groupIdx]);
  const uniqueGroups = Array.from(new Set(groups));
  if (uniqueGroups.length < 2)
    throw new Error(`Need at least two groups in column "${header[groupIdx]}"; found ${uniqueGroups.length}.`);

  // Pick control vs case. Prefer an explicit control label, else a common
  // healthy-baseline name, else just take the first group seen as control.
  const HEALTHY = ["control", "healthy", "normal", "wt", "wildtype", "baseline"];
  let control =
    opts.controlLabel && uniqueGroups.includes(opts.controlLabel)
      ? opts.controlLabel
      : uniqueGroups.find((g) => HEALTHY.includes(g.toLowerCase())) ?? uniqueGroups[0];
  const caseGroup = uniqueGroups.find((g) => g !== control) ?? uniqueGroups[1];

  const controlIdx = rows.map((_, i) => i).filter((i) => groups[i] === control);
  const caseIdx = rows.map((_, i) => i).filter((i) => groups[i] === caseGroup);

  const results: Omit<MetaboliteRow, "padj">[] = [];
  for (const { name, i } of metaboliteCols) {
    const ctrlVals = controlIdx.map((r) => Number(rows[r][i])).filter((v) => Number.isFinite(v));
    const caseVals = caseIdx.map((r) => Number(rows[r][i])).filter((v) => Number.isFinite(v));
    if (ctrlVals.length < 2 || caseVals.length < 2) continue;

    const logC = ctrlVals.map((v) => Math.log2(v > 0 ? v : 1e-6));
    const logK = caseVals.map((v) => Math.log2(v > 0 ? v : 1e-6));
    const { p } = welchTTest(logK, logC);
    const meanC = ctrlVals.reduce((s, v) => s + v, 0) / ctrlVals.length;
    const meanK = caseVals.reduce((s, v) => s + v, 0) / caseVals.length;
    const log2fc = Math.log2((meanK || 1e-6) / (meanC || 1e-6));
    results.push({ metabolite: name, mean_control: meanC, mean_case: meanK, log2fc, pvalue: p });
  }

  const padj = benjaminiHochberg(results.map((r) => r.pvalue));
  const data: MetaboliteRow[] = results
    .map((r, i) => ({
      metabolite: r.metabolite,
      mean_control: Number(r.mean_control.toFixed(3)),
      mean_case: Number(r.mean_case.toFixed(3)),
      log2fc: Number(r.log2fc.toFixed(4)),
      pvalue: Number(r.pvalue.toExponential(3)),
      padj: Number(padj[i].toExponential(3)),
    }))
    .sort((a, b) => a.padj - b.padj);

  const nSig = data.filter((r) => r.padj <= padjCutoff).length;
  return {
    summary: `${caseGroup} vs ${control}: ${nSig} of ${data.length} metabolites significantly changed (BH-adjusted p < ${padjCutoff}).`,
    group_control: control,
    group_case: caseGroup,
    n_control: controlIdx.length,
    n_case: caseIdx.length,
    n_metabolites: data.length,
    n_significant: nSig,
    data,
  };
}

export interface PathwayHit {
  pathway: string;
  pathway_id: string;
  hits: number;
  pathway_size: number;
  metabolites: string;
  pvalue: number;
  padj: number;
}

export interface PathwaySet {
  id: string;
  name: string;
  metabolites: string[];
}

// Over-representation analysis: given a list of "significant" metabolites, test
// which pathways contain more of them than expected by chance (hypergeometric).
// N = size of the reference universe (union of all pathway members). This is
// the same logic as MetaboAnalyst's Enrichment / ORA module.
export function pathwayOra(
  significant: string[],
  pathwaySets: PathwaySet[],
  opts: { minHits?: number } = {}
): { summary: string; universe_size: number; n_query: number; n_query_in_universe: number; data: PathwayHit[] } {
  const minHits = opts.minHits ?? 2;
  const universe = new Set<string>();
  for (const ps of pathwaySets) for (const m of ps.metabolites) universe.add(m.toLowerCase());
  const N = universe.size;

  const queryInUniverse = significant.filter((m) => universe.has(m.toLowerCase()));
  const n = queryInUniverse.length;
  const querySet = new Set(queryInUniverse.map((m) => m.toLowerCase()));

  const raw: Omit<PathwayHit, "padj">[] = [];
  for (const ps of pathwaySets) {
    const members = ps.metabolites.map((m) => m.toLowerCase());
    const K = members.length;
    const hitNames = ps.metabolites.filter((m) => querySet.has(m.toLowerCase()));
    const k = hitNames.length;
    if (k < minHits) continue;
    const p = hypergeometricUpperTail(k, N, K, n);
    raw.push({
      pathway: ps.name,
      pathway_id: ps.id,
      hits: k,
      pathway_size: K,
      metabolites: hitNames.join(", "),
      pvalue: p,
    });
  }

  const padj = benjaminiHochberg(raw.map((r) => r.pvalue));
  const data: PathwayHit[] = raw
    .map((r, i) => ({
      ...r,
      pvalue: Number(r.pvalue.toExponential(3)),
      padj: Number(padj[i].toExponential(3)),
    }))
    .sort((a, b) => a.pvalue - b.pvalue);

  const top = data[0];
  return {
    summary: n === 0
      ? "None of the significant metabolites matched the pathway reference set."
      : `${data.length} pathway(s) enriched among ${n} mapped metabolites. Top hit: ${top ? `${top.pathway} (p=${top.pvalue})` : "none"}.`,
    universe_size: N,
    n_query: significant.length,
    n_query_in_universe: n,
    data,
  };
}
