import { useState } from 'react'
import { useAppStore } from '../../../app/store/appStore.js'

const PROVIDER_ENVIRONMENTS = [
  { id: 'vega-lite', label: 'Vega-Lite' },
  { id: 'vega', label: 'Vega' },
  { id: 'echarts', label: 'ECharts' },
  { id: 'vgplot', label: 'VGPlot' },
]

export function VisualizationLoadPanel({ embedded = false } = {}) {
  const loadVisualizationScript = useAppStore((state) => state.loadVisualizationScript)
  const bindCurrentVisualization = useAppStore((state) => state.bindCurrentVisualization)
  const workspaceProviderEnvironment = useAppStore((state) => state.workspaceProviderEnvironment)
  const setWorkspaceProviderEnvironment = useAppStore((state) => state.setWorkspaceProviderEnvironment)
  const loadedVisualizationPreview = useAppStore((state) => state.loadedVisualizationPreview)
  const visualizationLoadError = useAppStore((state) => state.visualizationLoadError)
  const visualizationLoadSummary = useAppStore((state) => state.visualizationLoadSummary)
  const visualizationBindStatus = useAppStore((state) => state.visualizationBindStatus)
  const visualizationBindError = useAppStore((state) => state.visualizationBindError)
  const [scriptText, setScriptText] = useState('')
  const helperText = 'Paste chart code and render it here.'

  const content = (
    <>
      <div className="environment-switcher" role="group" aria-label="Rendering environment">
        {PROVIDER_ENVIRONMENTS.map((environment) => (
          <button
            key={environment.id}
            type="button"
            className={`environment-chip ${workspaceProviderEnvironment === environment.id ? 'active' : ''}`}
            onClick={() => setWorkspaceProviderEnvironment(environment.id)}
            aria-pressed={workspaceProviderEnvironment === environment.id}
          >
            {environment.label}
          </button>
        ))}
      </div>
      <div className="control-stack">
        <textarea
          className="control-textarea loader-textarea"
          value={scriptText}
          onChange={(event) => setScriptText(event.target.value)}
          spellCheck={false}
          rows={4}
          placeholder="Paste a Vega/Vega-Lite spec, an ECharts option, or a vgplot script..."
        />
        <div className="control-row">
          <button
            type="button"
            className="primary-button compact"
            onClick={() => {
              void loadVisualizationScript(scriptText)
            }}
          >
            Render chart
          </button>
          {loadedVisualizationPreview?.widget ? (
            <button
              type="button"
              className="primary-button compact"
              onClick={() => {
                void bindCurrentVisualization()
              }}
              disabled={visualizationBindStatus === 'binding'}
            >
              {visualizationBindStatus === 'binding' ? 'Binding…' : 'Bind chart'}
            </button>
          ) : null}
        </div>
        {visualizationLoadError ? (
          <p className="agent-error" role="status">{visualizationLoadError}</p>
        ) : (
          <p className="dataset-upload-copy">{visualizationLoadSummary || helperText}</p>
        )}
        {loadedVisualizationPreview?.widget && !visualizationBindError ? (
          <p className="dataset-upload-copy">
            Ready to bind · {loadedVisualizationPreview.provider} · {loadedVisualizationPreview.widgetKind}
          </p>
        ) : null}
        {visualizationBindError ? (
          <p className="agent-error" role="status">{visualizationBindError}</p>
        ) : null}
        {visualizationBindStatus === 'bound' ? (
          <p className="dataset-upload-copy">Bound. You can now ask the agent to analyze this chart.</p>
        ) : null}
      </div>
    </>
  )

  if (embedded) {
    return content
  }

  return (
    <section className="panel-section">
      <div className="section-head">
        <p className="eyebrow">Visualization</p>
        <h3>Load chart</h3>
      </div>
      {content}
    </section>
  )
}
