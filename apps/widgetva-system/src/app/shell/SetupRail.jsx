import { VisualizationLoadPanel } from '../../features/setup/components/VisualizationLoadPanel.jsx'
import { PanelHeader } from './PanelHeader.jsx'

export function SetupRail() {
  return (
    <aside className="rail rail-left" aria-label="Data panel">
      <PanelHeader kind="data" title="Data Panel" />
      <section className="panel-section setup-shell">
        <div className="section-head">
          <p className="eyebrow">Input</p>
          <h3>Load chart</h3>
        </div>
        <div className="setup-tab-panel">
          <VisualizationLoadPanel embedded />
        </div>
      </section>
    </aside>
  )
}
