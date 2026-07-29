import { useMemo } from 'react'
import { useAppStore } from '../../../app/store/appStore.js'
import { createFirstPartyRuntimeSessionFacade } from '../../../appRuntime/contracts/runtimeBridge.js'

const PROVIDER_ENVIRONMENTS = [
  { id: 'vega-lite', label: 'Vega-Lite' },
  { id: 'vega', label: 'Vega' },
  { id: 'echarts', label: 'ECharts' },
  { id: 'vgplot', label: 'Vgplot' },
]

export function WidgetLibraryPanel() {
  const runtimeSessionKey = useAppStore((state) => state.runtimeSessionKey)
  const activeCaseId = useAppStore((state) => state.activeCaseId)
  const fallbackWidgets = useAppStore((state) => state.widgets)
  const loadedVisualizationPreview = useAppStore((state) => state.loadedVisualizationPreview)
  const selectedWidgetId = useAppStore((state) => state.selectedWidgetId)
  const workspaceProviderEnvironment = useAppStore((state) => state.workspaceProviderEnvironment)
  const setSelectedWidgetId = useAppStore((state) => state.setSelectedWidgetId)
  const setWorkspaceProviderEnvironment = useAppStore((state) => state.setWorkspaceProviderEnvironment)
  const runtime = useMemo(
    () => createFirstPartyRuntimeSessionFacade(runtimeSessionKey || activeCaseId),
    [activeCaseId, runtimeSessionKey],
  )
  const widgets = useMemo(() => {
    if (loadedVisualizationPreview?.widget) return []
    const descriptions = runtime.readWorkspaceDescription()?.widgets || []
    return descriptions.length > 0 ? descriptions : fallbackWidgets
  }, [fallbackWidgets, loadedVisualizationPreview, runtime])

  return (
    <section className="panel-section">
      <div className="section-head">
        <p className="eyebrow">Views</p>
        <h3>Workspace</h3>
      </div>
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
      <div className="library-summary">
        <span>{loadedVisualizationPreview?.widget ? 'Preview pending bind' : `${widgets.length} widgets`}</span>
        <span>{workspaceProviderEnvironment}</span>
      </div>
      {loadedVisualizationPreview?.widget ? (
        <div className="info-block compact">
          <h4>{loadedVisualizationPreview.title}</h4>
          <p>{loadedVisualizationPreview.provider} · {loadedVisualizationPreview.widgetKind}</p>
          <p>Bind it to expose widget actions and perceptions.</p>
        </div>
      ) : null}
      <div className="stack-list">
        {widgets.map((widget) => {
          const widgetId = widget.widgetId || widget.id
          const widgetTitle = widget.title || widget.widgetId || widget.id
          const widgetKind = widget.widgetKind || widget.kind || widget.type || ''
          return (
          <button
            key={widgetId}
            type="button"
            className={`stack-item ${selectedWidgetId === widgetId ? 'active' : ''}`}
            onClick={() => setSelectedWidgetId(widgetId)}
          >
            <strong>{widgetTitle}</strong>
            <span>{widgetKind}</span>
          </button>
          )
        })}
      </div>
    </section>
  )
}
