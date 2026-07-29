import { useState } from 'react'
import { DatasetPanel } from '../../features/setup/components/DatasetPanel.jsx'
import { VisualizationLoadPanel } from '../../features/setup/components/VisualizationLoadPanel.jsx'

export function SetupRail() {
  const [activeTab, setActiveTab] = useState('chart')

  return (
    <aside className="rail rail-left" aria-label="Data panel">
      <section className="panel-section setup-shell">
        <div className="section-head">
          <p className="eyebrow">Input</p>
          <h3>{activeTab === 'chart' ? 'Load chart' : 'Load CSV'}</h3>
        </div>
        <div className="tab-strip setup-tab-strip" role="tablist" aria-label="Input sources">
          <button
            type="button"
            className={`tab-chip setup-tab ${activeTab === 'chart' ? 'active' : ''}`}
            aria-selected={activeTab === 'chart'}
            onClick={() => setActiveTab('chart')}
          >
            Chart
          </button>
          <button
            type="button"
            className={`tab-chip setup-tab ${activeTab === 'csv' ? 'active' : ''}`}
            aria-selected={activeTab === 'csv'}
            onClick={() => setActiveTab('csv')}
          >
            CSV
          </button>
        </div>
        <div className="setup-tab-panel">
          {activeTab === 'chart' ? <VisualizationLoadPanel embedded /> : <DatasetPanel embedded />}
        </div>
      </section>
    </aside>
  )
}
