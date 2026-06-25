import { AgentWidget } from "@agentic-visual-reframe/agent-widget-ui";

const exampleSpec = {
  $schema: "https://vega.github.io/schema/vega-lite/v5.json",
  mark: "point",
  encoding: {
    x: { field: "x", type: "quantitative" },
    y: { field: "y", type: "quantitative" },
    color: { field: "group", type: "nominal" }
  },
  data: {
    values: [
      { x: 1, y: 3, group: "A" },
      { x: 2, y: 5, group: "A" },
      { x: 3, y: 6, group: "B" }
    ]
  }
};

export default function App() {
  return (
    <main style={{ padding: 18, display: "grid", gridTemplateColumns: "1fr 380px", gap: 16 }}>
      <section
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 10,
          padding: 12
        }}
      >
        <h2 style={{ margin: 0, fontSize: 16 }}>Host VA View</h2>
        <p style={{ fontSize: 13, color: "#475569" }}>
          Replace this area with your existing visualization widget.
        </p>
        <pre style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>
          {JSON.stringify(exampleSpec, null, 2)}
        </pre>
      </section>
      <AgentWidget
        apiBaseUrl={import.meta.env.VITE_AGENT_API_BASE_URL ?? "http://127.0.0.1:9000"}
        vegaSpec={exampleSpec}
        defaultQuery="Find major trends and potential outliers."
      />
    </main>
  );
}
