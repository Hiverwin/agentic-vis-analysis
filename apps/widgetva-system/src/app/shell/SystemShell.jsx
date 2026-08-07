import { useCallback, useRef, useState } from 'react'
import { SetupRail } from './SetupRail.jsx'
import { WorkspaceStage } from '../../features/workspace/components/WorkspaceStage.jsx'
import { AnalysisRail } from './AnalysisRail.jsx'
import { TraceDrawer } from './TraceDrawer.jsx'

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum)
}

function PanelResizeHandle({ axis, label, value, minimum, maximum, multiplier = 1, onChange }) {
  const coordinate = axis === 'horizontal' ? 'clientX' : 'clientY'

  const startResize = useCallback((event) => {
    event.preventDefault()
    const startCoordinate = event[coordinate]
    const startValue = value

    const update = (pointerEvent) => {
      const nextValue = startValue + (pointerEvent[coordinate] - startCoordinate) * multiplier
      onChange(clamp(nextValue, minimum, maximum()))
    }
    const finish = () => {
      window.removeEventListener('pointermove', update)
      window.removeEventListener('pointerup', finish)
    }

    window.addEventListener('pointermove', update)
    window.addEventListener('pointerup', finish, { once: true })
  }, [coordinate, maximum, minimum, multiplier, onChange, value])

  const nudge = useCallback((event) => {
    const isHorizontal = axis === 'horizontal'
    const increase = (isHorizontal && event.key === 'ArrowRight') || (!isHorizontal && event.key === 'ArrowDown')
    const decrease = (isHorizontal && event.key === 'ArrowLeft') || (!isHorizontal && event.key === 'ArrowUp')
    if (!increase && !decrease) return
    event.preventDefault()
    onChange(clamp(value + (increase ? 20 : -20) * multiplier, minimum, maximum()))
  }, [axis, maximum, minimum, multiplier, onChange, value])

  return (
    <div
      className={`panel-resize-handle panel-resize-handle-${axis}`}
      role="separator"
      aria-label={label}
      aria-orientation={axis === 'horizontal' ? 'vertical' : 'horizontal'}
      tabIndex={0}
      onPointerDown={startResize}
      onKeyDown={nudge}
    />
  )
}

export function SystemShell() {
  const [draftFinding, setDraftFinding] = useState('')
  const [setupWidth, setSetupWidth] = useState(300)
  const [analysisWidth, setAnalysisWidth] = useState(320)
  const [workspaceHeight, setWorkspaceHeight] = useState(null)
  const centerStackRef = useRef(null)
  const maximumSetupWidth = useCallback(
    () => Math.max(240, window.innerWidth - analysisWidth - 580),
    [analysisWidth],
  )
  const maximumAnalysisWidth = useCallback(
    () => Math.max(260, window.innerWidth - setupWidth - 580),
    [setupWidth],
  )
  const maximumWorkspaceHeight = useCallback(
    () => Math.max(300, (centerStackRef.current?.clientHeight || window.innerHeight) - 164),
    [],
  )
  const defaultWorkspaceHeight = Math.round((centerStackRef.current?.clientHeight || window.innerHeight) * 0.64)

  return (
    <div className="system-app">
      <main
        className="system-main"
        style={{
          '--setup-width': `${setupWidth}px`,
          '--analysis-width': `${analysisWidth}px`,
        }}
      >
        <SetupRail />
        <PanelResizeHandle
          axis="horizontal"
          label="Resize input panel"
          value={setupWidth}
          minimum={240}
          maximum={maximumSetupWidth}
          onChange={setSetupWidth}
        />
        <div
          ref={centerStackRef}
          className={`center-stack ${workspaceHeight ? 'is-resized' : ''}`}
          style={workspaceHeight ? { '--workspace-height': `${workspaceHeight}px` } : undefined}
        >
          <WorkspaceStage />
          <PanelResizeHandle
            axis="vertical"
            label="Resize workspace and interaction trace"
            value={workspaceHeight || defaultWorkspaceHeight}
            minimum={300}
            maximum={maximumWorkspaceHeight}
            onChange={setWorkspaceHeight}
          />
          <TraceDrawer />
        </div>
        <PanelResizeHandle
          axis="horizontal"
          label="Resize analysis panel"
          value={analysisWidth}
          minimum={260}
          maximum={maximumAnalysisWidth}
          multiplier={-1}
          onChange={setAnalysisWidth}
        />
        <AnalysisRail draftFinding={draftFinding} setDraftFinding={setDraftFinding} />
      </main>
    </div>
  )
}
