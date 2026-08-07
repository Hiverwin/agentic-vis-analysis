import { useAppStore } from '../store/appStore.js'
import { TracePanel } from '../../features/trace/components/TracePanel.jsx'
import { PanelHeader } from './PanelHeader.jsx'

export function TraceDrawer() {
  const trace = useAppStore((state) => state.trace)
  const hasTrace = Array.isArray(trace) && trace.length > 0

  return (
    <section className={`trace-drawer open ${hasTrace ? '' : 'is-empty'}`.trim()} aria-label="Trace drawer">
      <PanelHeader kind="trace" title="Interaction Trace" />
      <div className="trace-content">
        {hasTrace ? (
          <TracePanel />
        ) : (
          <div className="trace-empty-state">
            <strong>No trace yet</strong>
            <p>Brush, focus, zoom, or run an agent step to start recording workspace history.</p>
          </div>
        )}
      </div>
    </section>
  )
}
