import { useEffect, useRef, useState } from 'react'
import {
  parseVisualizationArtifactScript,
  resolveVgplotArtifact,
} from '../../../appRuntime/imports/importedArtifactLoader.js'

function isDomNode(value) {
  return Boolean(value && typeof value === 'object' && typeof value.nodeType === 'number')
}

function resolveRenderedNode(value) {
  if (isDomNode(value)) return value
  if (isDomNode(value?.value)) return value.value
  if (isDomNode(value?.element)) return value.element
  if (isDomNode(value?.plot)) return value.plot
  return null
}

export function VgplotView({ scriptText, className = '' }) {
  const containerRef = useRef(null)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let disposed = false

    async function mount() {
      if (!containerRef.current || !scriptText) return
      setErrorMessage('')

      try {
        const artifact = parseVisualizationArtifactScript(scriptText)
        const { factory } = resolveVgplotArtifact(artifact, scriptText)
        const vgplot = await import('@uwdata/vgplot')
        const rendered = await factory(vgplot)
        const renderedNode = resolveRenderedNode(rendered)

        if (!renderedNode) {
          throw new Error('Vgplot script must return a DOM node, or an object exposing element/value/plot.')
        }

        if (disposed) return
        containerRef.current.replaceChildren(renderedNode)
      } catch (error) {
        if (!disposed) {
          setErrorMessage(error instanceof Error ? error.message : 'Unknown vgplot error')
        }
      }
    }

    void mount()

    return () => {
      disposed = true
      containerRef.current?.replaceChildren()
    }
  }, [scriptText])

  if (errorMessage) {
    return (
      <div className="empty-panel runtime-note">
        Vgplot view failed: {errorMessage}
      </div>
    )
  }

  return <div ref={containerRef} className={className} />
}
