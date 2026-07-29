import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createWidgetVAHost,
  runWidgetVAAgentSession,
} from 'widgetva-kit'
import { VegaLiteView } from '../../workspace/renderers/VegaLiteView.jsx'

const scatterSpec = {
  width: 520,
  height: 320,
  data: {
    values: [
      { horsepower: 65, mpg: 32, origin: 'Europe' },
      { horsepower: 80, mpg: 28, origin: 'Europe' },
      { horsepower: 95, mpg: 24, origin: 'USA' },
      { horsepower: 110, mpg: 21, origin: 'USA' },
      { horsepower: 130, mpg: 18, origin: 'USA' },
      { horsepower: 75, mpg: 35, origin: 'Japan' },
      { horsepower: 90, mpg: 30, origin: 'Japan' },
      { horsepower: 105, mpg: 25, origin: 'Japan' },
    ],
  },
  mark: { type: 'point', filled: true, size: 90 },
  encoding: {
    x: {
      field: 'horsepower',
      type: 'quantitative',
      title: 'Horsepower',
    },
    y: {
      field: 'mpg',
      type: 'quantitative',
      title: 'Miles per Gallon',
    },
    color: {
      field: 'origin',
      type: 'nominal',
      title: 'Origin',
    },
    tooltip: [
      { field: 'origin', type: 'nominal' },
      { field: 'horsepower', type: 'quantitative' },
      { field: 'mpg', type: 'quantitative' },
    ],
  },
}

const playgroundWidget = {
  id: 'playground_scatter',
  widgetId: 'playground_scatter',
  provider: 'vega-lite',
  kind: 'scatter',
  title: 'Playground Scatter',
  source: {
    kind: 'nativeArtifact',
    provider: 'vega-lite',
    providerSpec: {
      provider: 'vega-lite',
      spec: scatterSpec,
    },
  },
}

function pretty(value) {
  return JSON.stringify(value, null, 2)
}

function summarizeSession(session = null) {
  if (!session) return null
  return {
    activeWidgetId: session.activeWidgetId,
    widgets: session.runtime?.describeWorkspace?.()?.widgets || [],
    actions: session.runtime?.describeWorkspace?.()?.actions?.map((action) => action.name) || [],
  }
}

export function KitHostPlayground() {
  const hostRef = useRef(null)
  const sessionRef = useRef(null)
  const bindingRef = useRef(null)
  const [status, setStatus] = useState('Booting WidgetVA host playground...')
  const [lastResult, setLastResult] = useState(null)
  const [sessionSummary, setSessionSummary] = useState(null)

  const widget = useMemo(() => playgroundWidget, [])

  useEffect(() => {
    const host = createWidgetVAHost()
    const session = host.createRuntimeSession({
      sessionId: 'kit-host-playground',
      workspaceId: 'kit-host-playground',
      workspaceSpec: {
        topology: 'T1',
        widgets: [widget],
        links: [],
      },
      initialFocusedWidgetId: widget.widgetId,
      userIntent: 'Try WidgetVA kit as an external VA host from the UI layer.',
    })

    hostRef.current = host
    sessionRef.current = session
    setSessionSummary(summarizeSession(session))
    setStatus('WidgetVA host session is ready.')

    return () => {
      bindingRef.current?.dispose?.()
      bindingRef.current = null
      session.dispose?.()
      hostRef.current = null
      sessionRef.current = null
    }
  }, [widget])

  const handleViewReady = useCallback((view) => {
    bindingRef.current?.dispose?.()
    let disposed = false

    void hostRef.current?.mountWidgetView({
      widget,
      view,
      spec: scatterSpec,
    }).then((binding) => {
      if (disposed) {
        binding?.dispose?.()
        return
      }
      bindingRef.current = binding
      setStatus(binding ? 'Vega-Lite view is bound through WidgetVA kit.' : 'View mounted, but kit binding was not available.')
    }).catch((error) => {
      setStatus(`Kit view binding failed: ${error instanceof Error ? error.message : String(error)}`)
    })

    return () => {
      disposed = true
      bindingRef.current?.dispose?.()
      bindingRef.current = null
    }
  }, [widget])

  const runBrushAction = useCallback(async () => {
    const session = sessionRef.current
    if (!session?.workspace) return
    setStatus('Running scatter.brushRegion through kit workspace...')
    try {
      const result = await session.workspace.executeActionAndCommitCoordination({
        name: 'scatter.brushRegion',
        params: {
          xField: 'horsepower',
          yField: 'mpg',
          xRange: [70, 115],
          yRange: [22, 34],
        },
      })
      setLastResult(result)
      setSessionSummary(summarizeSession(session))
      setStatus('Action completed through kit workspace.')
    } catch (error) {
      setStatus(`Action failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }, [])

  const readObservation = useCallback(async () => {
    const session = sessionRef.current
    if (!session?.runtime) return
    setStatus('Reading kit runtime observation...')
    try {
      const result = await session.runtime.readObservation()
      setLastResult(result)
      setStatus('Observation read from kit runtime.')
    } catch (error) {
      setStatus(`Observation failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }, [])

  const runStubAgent = useCallback(async () => {
    const session = sessionRef.current
    if (!session?.runtime) return
    setStatus('Running one kit agent session with a stub model...')
    try {
      const result = await runWidgetVAAgentSession({
        target: session.runtime,
        objective: 'Select the dense middle area of the scatter plot.',
        maxTurns: 1,
        completeChat: async () => ({
          content: JSON.stringify({
            reasoning: 'The dense middle region is around 70-115 horsepower and 22-34 mpg.',
            action: {
              name: 'scatter.brushRegion',
              params: {
                xField: 'horsepower',
                yField: 'mpg',
                xRange: [70, 115],
                yRange: [22, 34],
              },
            },
          }),
        }),
      })
      setLastResult(result)
      setSessionSummary(summarizeSession(session))
      setStatus('Stub agent session completed through kit.')
    } catch (error) {
      setStatus(`Agent failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }, [])

  return (
    <main style={{
      minHeight: '100vh',
      padding: '24px',
      background: '#f7f8fb',
      color: '#172033',
      fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <section style={{
        maxWidth: '1180px',
        margin: '0 auto',
        display: 'grid',
        gap: '16px',
      }}>
        <header>
          <p style={{ margin: 0, color: '#667085', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase' }}>
            WidgetVA Host Playground
          </p>
          <h1 style={{ margin: '4px 0 8px', fontSize: '28px' }}>
            External VA host smoke test
          </h1>
          <p style={{ margin: 0, maxWidth: '760px', color: '#475467' }}>
            This temporary UI checks how far the app can get by calling widgetva-kit directly from the host layer.
          </p>
        </header>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.15fr) minmax(320px, 0.85fr)',
          gap: '16px',
          alignItems: 'start',
        }}>
          <section style={{
            background: '#fff',
            border: '1px solid #d9dee8',
            borderRadius: '8px',
            padding: '16px',
          }}>
            <div style={{
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap',
              marginBottom: '12px',
            }}>
              <button type="button" onClick={runBrushAction}>Run kit action</button>
              <button type="button" onClick={readObservation}>Read observation</button>
              <button type="button" onClick={runStubAgent}>Run stub agent</button>
            </div>
            <div style={{
              minHeight: '420px',
              display: 'grid',
              placeItems: 'center',
              border: '1px solid #eaecf0',
              borderRadius: '6px',
              background: '#fff',
            }}>
              <VegaLiteView
                spec={scatterSpec}
                className="vega-shell"
                onViewReady={handleViewReady}
              />
            </div>
          </section>

          <aside style={{
            display: 'grid',
            gap: '12px',
          }}>
            <section style={{
              background: '#fff',
              border: '1px solid #d9dee8',
              borderRadius: '8px',
              padding: '14px',
            }}>
              <h2 style={{ margin: '0 0 8px', fontSize: '16px' }}>Status</h2>
              <p style={{ margin: 0, color: '#344054' }}>{status}</p>
            </section>

            <section style={{
              background: '#fff',
              border: '1px solid #d9dee8',
              borderRadius: '8px',
              padding: '14px',
            }}>
              <h2 style={{ margin: '0 0 8px', fontSize: '16px' }}>Session</h2>
              <pre style={{
                margin: 0,
                overflow: 'auto',
                maxHeight: '220px',
                fontSize: '12px',
                whiteSpace: 'pre-wrap',
              }}>{pretty(sessionSummary)}</pre>
            </section>

            <section style={{
              background: '#101828',
              color: '#f9fafb',
              border: '1px solid #101828',
              borderRadius: '8px',
              padding: '14px',
            }}>
              <h2 style={{ margin: '0 0 8px', fontSize: '16px' }}>Last Result</h2>
              <pre style={{
                margin: 0,
                overflow: 'auto',
                maxHeight: '360px',
                fontSize: '12px',
                whiteSpace: 'pre-wrap',
              }}>{pretty(lastResult)}</pre>
            </section>
          </aside>
        </div>
      </section>
    </main>
  )
}
