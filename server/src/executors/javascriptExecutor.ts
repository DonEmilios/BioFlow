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

  default: async ({ params, inputs }) => ({
    summary: "Executed default mock logic.",
    received_inputs: Object.keys(inputs).length,
    mock_config: params,
  }),
};
