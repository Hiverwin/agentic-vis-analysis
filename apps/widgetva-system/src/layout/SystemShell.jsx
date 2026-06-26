import { useState } from 'react'
import { useAppStore } from '../app/appStore.js'
import { SetupRail } from './SetupRail.jsx'
import { WorkspaceStage } from '../workspace/WorkspaceStage.jsx'
import { AnalysisRail } from './AnalysisRail.jsx'
import { TraceDrawer } from './TraceDrawer.jsx'

export function SystemShell() {
  const [draftFinding, setDraftFinding] = useState('')

  return (
    <div className="system-app">
      <main className="system-main">
        <SetupRail />
        <div className="center-stack">
          <WorkspaceStage />
          <TraceDrawer />
        </div>
        <AnalysisRail draftFinding={draftFinding} setDraftFinding={setDraftFinding} />
      </main>
    </div>
  )
}
