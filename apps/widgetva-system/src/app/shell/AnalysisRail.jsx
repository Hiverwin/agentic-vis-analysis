import { useAppStore } from '../store/appStore.js'
import { buildTraceTimelineModel } from '../../features/trace/models/traceViewModel.js'
import { deriveWorkspaceProvenance } from '../../features/workspace/models/workspaceProvenance.js'
import { InspectPanel } from '../../features/analysis/components/InspectPanel.jsx'
import { AgentPanel } from '../../features/analysis/components/AgentPanel.jsx'
import { EvidencePanel } from '../../features/analysis/components/EvidencePanel.jsx'
import { PanelHeader } from './PanelHeader.jsx'

const TABS = [
  { id: 'analysis', label: 'Human' },
  { id: 'agent', label: 'Agent' },
]

export function AnalysisRail({ draftFinding, setDraftFinding }) {
  const workspaceSourceType = useAppStore((state) => state.workspaceSourceType)
  const selectedWidgetId = useAppStore((state) => state.selectedWidgetId)
  const widgets = useAppStore((state) => state.widgets)
  const trace = useAppStore((state) => state.trace)
  const selectedTraceStepId = useAppStore((state) => state.selectedTraceStepId)
  const activeReplayContext = useAppStore((state) => state.activeReplayContext)
  const analysisTab = useAppStore((state) => state.analysisTab)
  const setAnalysisTab = useAppStore((state) => state.setAnalysisTab)
  const selectedWidgetTitle = widgets.find((widget) => widget.id === selectedWidgetId)?.title || selectedWidgetId
  const selectedTraceStep = buildTraceTimelineModel(trace, { selectedStepId: selectedTraceStepId }).selectedStep
  const provenance = deriveWorkspaceProvenance({
    selectedWidgetId,
    selectedTraceStep,
    activeReplayContext,
  })
  const importedOrStarterWorkspace = workspaceSourceType === 'importedSpec' || workspaceSourceType === 'starter'

  return (
    <aside className="rail rail-right" aria-label="Analysis panel">
      <PanelHeader kind="analysis" title="Analysis" />
      <section className="panel-section analysis-shell">
        <div className="analysis-heading-block">
          <h2>{selectedWidgetTitle || 'Current analysis'}</h2>
        </div>
        <div className="tab-strip analysis-tab-strip full" role="tablist" aria-label="Analysis levels">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`tab-chip analysis-tab ${analysisTab === tab.id ? 'active' : ''}`}
              aria-selected={analysisTab === tab.id}
              onClick={() => setAnalysisTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {analysisTab === 'analysis' ? (
          <div className="analysis-stack human-tab-stack">
            <EvidencePanel draftFinding={draftFinding} setDraftFinding={setDraftFinding} />
            {importedOrStarterWorkspace ? null : <InspectPanel />}
          </div>
        ) : null}
        {analysisTab === 'agent' ? (
          <div className="analysis-stack agent-tab-stack">
            <AgentPanel />
          </div>
        ) : null}
      </section>
    </aside>
  )
}
