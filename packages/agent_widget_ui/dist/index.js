// src/AgentWidget.tsx
import { useMemo as useMemo2, useState as useState2 } from "react";

// src/useAgentAnalysis.ts
import { useCallback, useMemo, useState } from "react";
function useAgentAnalysis(options) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const endpoint = useMemo(
    () => `${options.apiBaseUrl.replace(/\/$/, "")}${options.endpoint ?? "/api/analyze"}`,
    [options.apiBaseUrl, options.endpoint]
  );
  const analyze = useCallback(
    async (payload) => {
      setLoading(true);
      setError("");
      try {
        const token = options.getAuthToken ? await options.getAuthToken() : void 0;
        const headers = {
          "Content-Type": "application/json"
        };
        if (token) headers.Authorization = `Bearer ${token}`;
        const response = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(payload)
        });
        const json = await response.json();
        if (!response.ok) {
          throw new Error(json.detail ?? json.error ?? "Analyze request failed.");
        }
        setResult(json);
        return json;
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown analyze error.";
        setError(message);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [endpoint, options]
  );
  return {
    loading,
    result,
    error,
    analyze,
    clearResult: () => setResult(null)
  };
}

// src/AgentWidget.tsx
import { jsx, jsxs } from "react/jsx-runtime";
function AgentWidget(props) {
  const [query, setQuery] = useState2(props.defaultQuery ?? "Summarize key insights from this chart.");
  const { loading, error, result, analyze } = useAgentAnalysis({
    apiBaseUrl: props.apiBaseUrl,
    getAuthToken: props.getAuthToken
  });
  const styles = useMemo2(
    () => ({
      border: `1px solid ${props.theme?.borderColor ?? "#e2e8f0"}`,
      background: props.theme?.panelBackground ?? "#ffffff",
      color: props.theme?.textColor ?? "#0f172a"
    }),
    [props.theme]
  );
  const run = async () => {
    const payload = {
      query,
      vega_spec: props.vegaSpec,
      model_name: props.modelName,
      input_mode: props.inputMode ?? "text_and_image",
      max_iterations: props.maxIterations ?? 6,
      chart_type: props.chartType,
      metadata: props.metadata ?? {}
    };
    try {
      const response = await analyze(payload);
      props.onResult?.(response);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown widget error.";
      props.onError?.(message);
    }
  };
  return /* @__PURE__ */ jsxs("section", { className: props.className, style: { ...styles, borderRadius: 10, padding: 12 }, children: [
    /* @__PURE__ */ jsx("div", { style: { fontSize: 13, fontWeight: 700, marginBottom: 8 }, children: "Agent Widget" }),
    /* @__PURE__ */ jsx(
      "textarea",
      {
        value: query,
        onChange: (e) => setQuery(e.target.value),
        rows: 4,
        style: {
          width: "100%",
          border: "1px solid #cbd5e1",
          borderRadius: 8,
          padding: 8,
          fontSize: 13
        }
      }
    ),
    /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        onClick: run,
        disabled: loading,
        style: {
          marginTop: 8,
          border: "none",
          borderRadius: 8,
          padding: "8px 12px",
          cursor: loading ? "not-allowed" : "pointer",
          background: props.theme?.accentColor ?? "#2563eb",
          color: "#fff",
          fontWeight: 600
        },
        children: loading ? "Running..." : "Run Analysis"
      }
    ),
    error ? /* @__PURE__ */ jsx("pre", { style: { marginTop: 10, color: "#b91c1c", whiteSpace: "pre-wrap", fontSize: 12 }, children: error }) : null,
    result ? /* @__PURE__ */ jsxs("div", { style: { marginTop: 10 }, children: [
      /* @__PURE__ */ jsx("div", { style: { fontWeight: 600, fontSize: 13 }, children: "Answer" }),
      /* @__PURE__ */ jsx("pre", { style: { whiteSpace: "pre-wrap", fontSize: 12 }, children: result.answer }),
      /* @__PURE__ */ jsx("div", { style: { fontWeight: 600, fontSize: 13, marginTop: 8 }, children: "Tool Calls" }),
      /* @__PURE__ */ jsx("pre", { style: { whiteSpace: "pre-wrap", fontSize: 12 }, children: JSON.stringify(result.tool_calls, null, 2) })
    ] }) : null
  ] });
}
export {
  AgentWidget,
  useAgentAnalysis
};
