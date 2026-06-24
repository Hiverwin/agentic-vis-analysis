import { WidgetLibraryPanel } from '../setup/WidgetLibraryPanel.jsx'
import { DatasetPanel } from '../setup/DatasetPanel.jsx'

export function SetupRail() {
  return (
    <aside className="rail rail-left" aria-label="Data panel">
      <WidgetLibraryPanel />
      <DatasetPanel />
    </aside>
  )
}
