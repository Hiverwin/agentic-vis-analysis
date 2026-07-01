import { useMemo } from 'react'
import { useAppStore } from '../app/appStore.js'
import { createFirstPartyRuntimeSessionFacade } from '../runtime/runtimeBridge.js'

const PROVIDER_ENVIRONMENTS = [
  { id: 'vega-lite', label: 'Vega' },
  { id: 'echarts', label: 'ECharts' },
  { id: 'd3', label: 'D3' },
]

export function WidgetLibraryPanel() {
  const runtimeSessionKey = useAppStore((state) => state.runtimeSessionKey)
  const activeCaseId = useAppStore((state) => state.activeCaseId)
  const fallbackWidgets = useAppStore((state) => state.widgets)
  const selectedWidgetId = useAppStore((state) => state.selectedWidgetId)
  const workspaceProviderEnvironment = useAppStore((state) => state.workspaceProviderEnvironment)
  const setSelectedWidgetId = useAppStore((state) => state.setSelectedWidgetId)
  const setWorkspaceProviderEnvironment = useAppStore((state) => state.setWorkspaceProviderEnvironment)
  const runtime = useMemo(
    () => createFirstPartyRuntimeSessionFacade(runtimeSessionKey || activeCaseId),
    [activeCaseId, runtimeSessionKey],
  )
  const widgets = useMemo(() => {
    const descriptions = runtime.readWorkspaceDescription()?.widgets || []
    return descriptions.length > 0 ? descriptions : fallbackWidgets
  }, [fallbackWidgets, runtime])

  return (
    <section className="panel-section">
      <div className="section-head">
        <p className="eyebrow">Views</p>
        <h3>Workspace navigator</h3>
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
        <span>{widgets.length} widgets</span>
        <span>{workspaceProviderEnvironment}</span>
      </div>
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
