import { useAppStore } from '../../../app/store/appStore.js'

export function DatasetPanel({ embedded = false } = {}) {
  const dataset = useAppStore((state) => state.dataset)
  const caseTitle = useAppStore((state) => state.caseTitle)
  const workspaceSourceType = useAppStore((state) => state.workspaceSourceType)
  const loadedVisualizationPreview = useAppStore((state) => state.loadedVisualizationPreview)

  const importedWorkspace = workspaceSourceType === 'importedSpec'
  const starterWorkspace = workspaceSourceType === 'starter'
  const showDatasetStats = !loadedVisualizationPreview?.widget && (!starterWorkspace || importedWorkspace || dataset.rows > 0)

  const content = (
    <>
      {showDatasetStats ? (
        <dl className="meta-grid compact">
          <div>
            <dt>Case</dt>
            <dd>{caseTitle}</dd>
          </div>
          <div>
            <dt>Rows</dt>
            <dd>{dataset.rows || 0}</dd>
          </div>
          <div>
            <dt>Fields</dt>
            <dd>{dataset.fields || 0}</dd>
          </div>
        </dl>
      ) : (
        <p className="dataset-upload-copy">
          Load a visualization spec to let the host VA bind a widget through the kit runtime.
        </p>
      )}
    </>
  )

  if (embedded) {
    return content
  }

  return (
    <section className="panel-section">
      <div className="section-head">
        <p className="eyebrow">Data</p>
        <h3>Workspace</h3>
      </div>
      {content}
    </section>
  )
}
