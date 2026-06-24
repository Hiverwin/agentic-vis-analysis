import { useAppStore } from '../app/appStore.js'
import { buildTraceTimelineModel } from '../trace/traceViewModel.js'
import { deriveWorkspaceProvenance } from '../workspace/workspaceProvenance.js'
import { InspectPanel } from '../analysis/InspectPanel.jsx'
import { AgentPanel } from '../analysis/AgentPanel.jsx'
import { EvidencePanel } from '../analysis/EvidencePanel.jsx'
import { ControlsPanel } from '../analysis/ControlsPanel.jsx'

const TABS = [
  { id: 'analysis', label: 'Human' },
  { id: 'agent', label: 'Agent' },
]

export function AnalysisRail({ draftFinding, setDraftFinding }) {
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

  return (
    <aside className="rail rail-right" aria-label="Analysis panel">
      <div className="rail-header">
        <p className="eyebrow">Analysis</p>
        <h2>{selectedWidgetTitle || 'Current analysis'}</h2>
        {provenance.hasReplayAnchor ? (
          <p className="rail-subtitle">Replay anchor · {provenance.branchLabel} · {provenance.focusedReplayWidgetId || 'workspace'}</p>
        ) : null}
      </div>
      <div className="tab-strip" role="tablist" aria-label="Analysis levels">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`tab-chip ${analysisTab === tab.id ? 'active' : ''}`}
            aria-selected={analysisTab === tab.id}
            onClick={() => setAnalysisTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="rail-panel">
        {analysisTab === 'analysis' ? (
          <div className="analysis-stack">
            <InspectPanel />
            <EvidencePanel draftFinding={draftFinding} setDraftFinding={setDraftFinding} />
            <ControlsPanel />
          </div>
        ) : null}
        {analysisTab === 'agent' ? (
          <div className="analysis-stack">
            <AgentPanel />
          </div>
        ) : null}
      </div>
    </aside>
  )
}
