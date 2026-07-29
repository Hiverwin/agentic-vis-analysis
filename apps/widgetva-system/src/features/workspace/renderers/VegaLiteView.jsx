import { useEffect, useRef, useState } from 'react'
import * as vega from 'vega'
import embed from 'vega-embed'

const OFFICIAL_VEGA_LITE_EXAMPLES_BASE_URL = 'https://vega.github.io/vega-lite/examples/'

export function VegaLiteView({ spec, className = '', onItemClick = null, signalListeners = [], onViewReady = null }) {
  const containerRef = useRef(null)
  const onItemClickRef = useRef(onItemClick)
  const signalListenersRef = useRef(signalListeners)
  const onViewReadyRef = useRef(onViewReady)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    onItemClickRef.current = onItemClick
  }, [onItemClick])

  useEffect(() => {
    signalListenersRef.current = signalListeners
  }, [signalListeners])

  useEffect(() => {
    onViewReadyRef.current = onViewReady
  }, [onViewReady])

  useEffect(() => {
    let disposed = false
    let view = null
    const unregister = []

    async function mount() {
      if (!containerRef.current || !spec) return
      setErrorMessage('')
      try {
        const result = await embed(containerRef.current, spec, {
          actions: false,
          renderer: 'svg',
          loader: vega.loader({
            baseURL: OFFICIAL_VEGA_LITE_EXAMPLES_BASE_URL,
          }),
        })
        if (disposed) {
          result.view.finalize()
          return
        }
        view = result.view
        view.__widgetVAChangesetFactory = () => vega.changeset()

        if (typeof onItemClickRef.current === 'function') {
          const clickHandler = (_event, item) => {
            const datum = item?.datum?.datum || item?.datum || null
            if (datum) onItemClickRef.current?.(datum)
          }
          view.addEventListener('click', clickHandler)
          unregister.push(() => view?.removeEventListener('click', clickHandler))
        }

        for (const listener of signalListenersRef.current || []) {
          if (!listener?.name || typeof listener?.handler !== 'function') continue
          view.addSignalListener(listener.name, listener.handler)
          unregister.push(() => view?.removeSignalListener(listener.name, listener.handler))
        }

        if (typeof onViewReadyRef.current === 'function') {
          const cleanup = onViewReadyRef.current(view)
          if (typeof cleanup === 'function') {
            unregister.push(cleanup)
          }
        }
      } catch (error) {
        console.error('vega mount failure', error)
        if (!disposed) {
          setErrorMessage(error instanceof Error ? error.message : 'Unknown Vega error')
        }
      }
    }

    void mount()

    return () => {
      disposed = true
      unregister.forEach((fn) => fn())
      if (view) {
        try {
          delete view.__widgetVAChangesetFactory
        } catch {}
      }
      view?.finalize()
    }
  }, [spec])

  if (errorMessage) {
    return (
      <div className="empty-panel runtime-note">
        Vega view failed: {errorMessage}
      </div>
    )
  }

  return <div ref={containerRef} className={className} />
}
