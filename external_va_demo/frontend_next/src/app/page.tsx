"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

type ChartKey = "bar_chart" | "line_chart" | "scatter_plot" | "heatmap" | "parallel_coordinates" | "sankey_diagram";

type AnalyzeResponse = {
  answer: string;
  tool_calls: Array<{ tool_name: string; success: boolean; message?: string; error?: string; tool_args?: Record<string, unknown> }>;
  final_observation: Record<string, unknown>;
  mode?: string;
  error?: string;
};

const API_ENDPOINT = process.env.NEXT_PUBLIC_ANALYZE_API ?? "http://127.0.0.1:9000/api/analyze";

const PRESET_SPECS: Record<ChartKey, Record<string, unknown>> = {
  bar_chart: {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    mark: "bar",
    encoding: { x: { field: "category", type: "nominal" }, y: { field: "value", type: "quantitative" } },
    data: { values: [{ category: "A", value: 10 }, { category: "B", value: 18 }, { category: "C", value: 14 }] }
  },
  line_chart: {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    mark: { type: "line", point: true },
    encoding: { x: { field: "date", type: "temporal" }, y: { field: "value", type: "quantitative" } },
    data: { values: [{ date: "2025-01-01", value: 12 }, { date: "2025-02-01", value: 19 }, { date: "2025-03-01", value: 15 }] }
  },
  scatter_plot: {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    mark: "point",
    encoding: {
      x: { field: "x", type: "quantitative" },
      y: { field: "y", type: "quantitative" },
      color: { field: "group", type: "nominal" }
    },
    data: { values: [{ x: 1, y: 2, group: "A" }, { x: 2, y: 4, group: "A" }, { x: 3, y: 7, group: "B" }, { x: 4, y: 9, group: "B" }, { x: 5, y: 8, group: "C" }] }
  },
  heatmap: {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    mark: "rect",
    encoding: { x: { field: "x", type: "ordinal" }, y: { field: "y", type: "ordinal" }, color: { field: "value", type: "quantitative" } },
    data: { values: [{ x: "A", y: "P", value: 3 }, { x: "A", y: "Q", value: 8 }, { x: "B", y: "P", value: 5 }, { x: "B", y: "Q", value: 1 }] }
  },
  parallel_coordinates: {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    data: { values: [{ a: 1, b: 4, c: 2, id: "u1" }, { a: 3, b: 2, c: 5, id: "u2" }] },
    transform: [{ fold: ["a", "b", "c"], as: ["dimension", "value"] }],
    mark: "line",
    encoding: { x: { field: "dimension", type: "nominal" }, y: { field: "value", type: "quantitative" }, detail: { field: "id", type: "nominal" } }
  },
  sankey_diagram: {
    $schema: "https://vega.github.io/schema/vega/v5.json",
    data: [
      { name: "nodes", values: [{ name: "Start" }, { name: "A" }, { name: "B" }, { name: "End" }] },
      { name: "links", values: [{ source: "Start", target: "A", value: 6 }, { source: "Start", target: "B", value: 4 }, { source: "A", target: "End", value: 6 }, { source: "B", target: "End", value: 4 }] }
    ]
  }
};

function renderMiniChart(chartType: ChartKey, spec: Record<string, unknown>) {
  const values = (((spec.data as { values?: Record<string, unknown>[] })?.values ?? []) as Record<string, unknown>[]) || [];
  if (!values.length) return <div className="text-xs text-slate-500">No preview data</div>;

  if (chartType === "scatter_plot") {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 6, right: 16, left: 0, bottom: 6 }}>
          <CartesianGrid stroke="#e2e8f0" />
          <XAxis dataKey="x" />
          <YAxis dataKey="y" />
          <Tooltip />
          <Scatter data={values} fill="#2563eb" />
        </ScatterChart>
      </ResponsiveContainer>
    );
  }
  if (chartType === "line_chart") {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={values}>
          <CartesianGrid stroke="#e2e8f0" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke="#f97316" strokeWidth={2} dot />
        </LineChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={values}>
        <CartesianGrid stroke="#e2e8f0" />
        <XAxis dataKey={chartType === "bar_chart" ? "category" : "x"} />
        <YAxis />
        <Tooltip />
        <Bar dataKey={chartType === "bar_chart" ? "value" : "value"} fill="#ec4899" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function Page() {
  const [chartType, setChartType] = useState<ChartKey>("scatter_plot");
  const [query, setQuery] = useState("What is the correlation trend in this chart?");
  const [modelName, setModelName] = useState("llama_protocol");
  const [inputMode, setInputMode] = useState("text_and_image");
  const [maxIterations, setMaxIterations] = useState(6);
  const [loading, setLoading] = useState(false);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [response, setResponse] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string>("");
  const [history, setHistory] = useState<Array<{ t: string; step: number; tools: number }>>([]);
  const [specText, setSpecText] = useState(JSON.stringify(PRESET_SPECS.scatter_plot, null, 2));

  const parsedSpec = useMemo(() => {
    try {
      return JSON.parse(specText) as Record<string, unknown>;
    } catch {
      return null;
    }
  }, [specText]);

  const applyPreset = (nextType: ChartKey) => {
    setChartType(nextType);
    setSpecText(JSON.stringify(PRESET_SPECS[nextType], null, 2));
    setResponse(null);
    setError("");
  };

  const runAnalyze = async () => {
    if (!parsedSpec) {
      setError("vega_spec JSON is invalid.");
      return;
    }
    setLoading(true);
    setError("");
    const start = performance.now();
    try {
      const res = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          vega_spec: parsedSpec,
          model_name: modelName,
          input_mode: inputMode,
          max_iterations: maxIterations
        })
      });
      const data = (await res.json()) as AnalyzeResponse;
      if (!res.ok) {
        throw new Error((data as { detail?: string }).detail ?? "Analyze request failed");
      }
      setResponse(data);
      setHistory((prev) => [
        ...prev,
        {
          t: new Date().toLocaleTimeString(),
          step: prev.length + 1,
          tools: data.tool_calls?.length ?? 0
        }
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setResponse(null);
    } finally {
      setElapsedMs(Math.round(performance.now() - start));
      setLoading(false);
    }
  };

  return (
    <main className="h-screen p-4">
      <div className="grid h-full grid-cols-[320px_1fr_360px] grid-rows-[1fr_210px] gap-4">
        <section className="panel row-span-2 flex flex-col p-3">
          <div className="section-tag">A Conversation Control</div>
          <h2 className="mt-1 text-sm font-semibold tracking-wide">Chat-Driven Analysis</h2>

          <div className="mt-3 space-y-2 text-xs">
            <label className="block font-medium text-slate-600">Widget Type (Import Preset)</label>
            <select
              className="w-full rounded border border-slate-300 bg-white px-2 py-2"
              value={chartType}
              onChange={(e) => applyPreset(e.target.value as ChartKey)}
            >
              {Object.keys(PRESET_SPECS).map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3 space-y-2 text-xs">
            <label className="block font-medium text-slate-600">Query</label>
            <textarea className="h-20 w-full rounded border border-slate-300 px-2 py-2" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="block font-medium text-slate-600">Model</label>
              <input className="mt-1 w-full rounded border border-slate-300 px-2 py-2" value={modelName} onChange={(e) => setModelName(e.target.value)} />
            </div>
            <div>
              <label className="block font-medium text-slate-600">Input Mode</label>
              <select className="mt-1 w-full rounded border border-slate-300 px-2 py-2" value={inputMode} onChange={(e) => setInputMode(e.target.value)}>
                <option value="text_and_image">text_and_image</option>
                <option value="text_only">text_only</option>
                <option value="image_only">image_only</option>
              </select>
            </div>
          </div>

          <div className="mt-3 text-xs">
            <label className="block font-medium text-slate-600">Max Iterations</label>
            <input
              type="number"
              className="mt-1 w-full rounded border border-slate-300 px-2 py-2"
              value={maxIterations}
              min={1}
              max={20}
              onChange={(e) => setMaxIterations(Number(e.target.value))}
            />
          </div>

          <button
            onClick={runAnalyze}
            disabled={loading}
            className="mt-4 rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Analyzing..." : "Analyze via Imported Agent"}
          </button>

          <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-600">
            <div className="font-semibold uppercase tracking-wide text-slate-500">Request Endpoint</div>
            <div className="mt-1 break-all">{API_ENDPOINT}</div>
            {elapsedMs !== null && <div className="mt-1">Elapsed: {elapsedMs} ms</div>}
          </div>

          <div className="mt-3 flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">Imported vega_spec (editable)</label>
            <textarea className="h-[calc(100%-20px)] min-h-[180px] w-full rounded border border-slate-300 p-2 font-mono text-[11px]" value={specText} onChange={(e) => setSpecText(e.target.value)} />
          </div>
        </section>

        <section className="panel p-3">
          <div className="section-tag">B Recommended Insights</div>
          <h2 className="mt-1 text-sm font-semibold tracking-wide">Visual Analysis Workspace</h2>
          <div className="mt-3 grid grid-cols-[1fr_260px] gap-3">
            <div className="rounded border border-slate-200 bg-white p-2">{parsedSpec ? renderMiniChart(chartType, parsedSpec) : <div className="text-xs text-red-500">Invalid spec JSON</div>}</div>
            <div className="space-y-2">
              <div className="rounded border border-pink-200 bg-pink-50 p-3 text-xs">
                <div className="font-semibold uppercase tracking-wide text-pink-700">Insight Candidate 1</div>
                <div className="mt-1 text-slate-700">Inspect anomaly clusters and compare trend consistency.</div>
              </div>
              <div className="rounded border border-orange-200 bg-orange-50 p-3 text-xs">
                <div className="font-semibold uppercase tracking-wide text-orange-700">Insight Candidate 2</div>
                <div className="mt-1 text-slate-700">Run correlation/statistical toolchain for objective signal.</div>
              </div>
              <div className="rounded border border-blue-200 bg-blue-50 p-3 text-xs">
                <div className="font-semibold uppercase tracking-wide text-blue-700">Interaction Summary</div>
                <div className="mt-1 text-slate-700">Tool calls: {response?.tool_calls?.length ?? 0}</div>
                <div className="text-slate-700">Mode: protocol import pipeline</div>
              </div>
            </div>
          </div>
        </section>

        <section className="panel p-3">
          <div className="section-tag">D Generated Report</div>
          <h2 className="mt-1 text-sm font-semibold tracking-wide">Agent Report Viewer</h2>
          <div className="mt-3 space-y-3 text-xs">
            {error ? <div className="rounded border border-red-200 bg-red-50 p-3 text-red-700">{error}</div> : null}
            <div className="rounded border border-slate-200 p-3">
              <div className="font-semibold uppercase tracking-wide text-slate-500">Answer</div>
              <div className="mt-1 whitespace-pre-wrap text-[13px] text-slate-800">{response?.answer || "No report yet."}</div>
            </div>
            <div className="rounded border border-slate-200 p-3">
              <div className="font-semibold uppercase tracking-wide text-slate-500">Tool Calls</div>
              <div className="mt-2 space-y-2">
                {(response?.tool_calls || []).map((t, idx) => (
                  <div key={`${t.tool_name}-${idx}`} className="rounded border border-slate-200 bg-slate-50 p-2">
                    <div className="font-medium text-slate-700">{t.tool_name}</div>
                    <div className="text-slate-500">success={String(t.success)}</div>
                    {t.message ? <div className="text-slate-600">{t.message}</div> : null}
                    {t.error ? <div className="text-red-600">{t.error}</div> : null}
                  </div>
                ))}
                {!response?.tool_calls?.length ? <div className="text-slate-500">No tool calls.</div> : null}
              </div>
            </div>
            <div className="rounded border border-slate-200 p-3">
              <div className="font-semibold uppercase tracking-wide text-slate-500">Final Observation</div>
              <pre className="mt-2 max-h-44 overflow-auto rounded bg-slate-50 p-2 text-[11px]">{JSON.stringify(response?.final_observation ?? {}, null, 2)}</pre>
            </div>
          </div>
        </section>

        <section className="panel p-3">
          <div className="section-tag">C Analysis History</div>
          <h2 className="mt-1 text-sm font-semibold tracking-wide">Interaction Trace</h2>
          <div className="mt-2 grid grid-cols-[1fr_320px] gap-3">
            <div className="h-[150px] rounded border border-slate-200 p-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <CartesianGrid stroke="#e2e8f0" />
                  <XAxis dataKey="step" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="tools" stroke="#f59e0b" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="max-h-[150px] overflow-auto rounded border border-slate-200 bg-slate-50 p-2 text-xs">
              {history.length === 0 ? (
                <div className="text-slate-500">No history yet.</div>
              ) : (
                history.map((h) => (
                  <div key={`${h.step}-${h.t}`} className="mb-2 border-b border-slate-200 pb-2 last:mb-0 last:border-b-0">
                    <div className="font-medium text-slate-700">Step {h.step}</div>
                    <div className="text-slate-500">{h.t}</div>
                    <div className="text-slate-600">tool_calls={h.tools}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
