import { useAppStore } from '../app/appStore.js'
import { TracePanel } from '../trace/TracePanel.jsx'

export function TraceDrawer() {
  return (
    <section className="trace-drawer open" aria-label="Trace drawer">
      <div className="trace-drawer-bar">
        <div>
          <p className="eyebrow">Trace</p>
        </div>
      </div>
      <div className="trace-content"><TracePanel /></div>
    </section>
  )
}
