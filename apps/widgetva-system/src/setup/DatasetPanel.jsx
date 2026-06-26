import { useRef } from 'react'
import { useAppStore } from '../app/appStore.js'

export function DatasetPanel() {
  const dataset = useAppStore((state) => state.dataset)
  const caseTitle = useAppStore((state) => state.caseTitle)
  const dataUploadName = useAppStore((state) => state.dataUploadName)
  const dataUploadError = useAppStore((state) => state.dataUploadError)
  const importDatasetFromCsv = useAppStore((state) => state.importDatasetFromCsv)
  const analysisOrigin = useAppStore((state) => state.analysisOrigin)
  const analysisYear = useAppStore((state) => state.analysisYear)
  const analysisCylinders = useAppStore((state) => state.analysisCylinders)
  const horsepowerMin = useAppStore((state) => state.horsepowerMin)
  const horsepowerMax = useAppStore((state) => state.horsepowerMax)
  const fileInputRef = useRef(null)
  const filters = [
    analysisOrigin !== 'All' ? `Origin: ${analysisOrigin}` : null,
    analysisYear !== 'All' ? `Year: ${analysisYear}` : null,
    analysisCylinders.length > 0 ? `Cylinders: ${analysisCylinders.join(', ')}` : null,
    Array.isArray(dataset.horsepowerDomain)
      && (horsepowerMin !== dataset.horsepowerDomain[0] || horsepowerMax !== dataset.horsepowerDomain[1])
      ? `Horsepower: ${horsepowerMin}-${horsepowerMax}`
      : null,
  ].filter(Boolean)

  return (
    <section className="panel-section">
      <div className="section-head">
        <p className="eyebrow">Dataset</p>
        <h3>{dataset.name}</h3>
      </div>
      <dl className="meta-grid">
        <div>
          <dt>Case</dt>
          <dd>{caseTitle}</dd>
        </div>
        <div>
          <dt>Rows</dt>
          <dd>{dataset.rows}</dd>
        </div>
        <div>
          <dt>Fields</dt>
          <dd>{dataset.fields}</dd>
        </div>
        <div>
          <dt>Coverage</dt>
          <dd>{dataset.coverage}</dd>
        </div>
      </dl>
      <div className="control-stack">
        <span>Upload CSV</span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="control-input dataset-upload-input"
          onChange={(event) => {
            const file = event.target.files?.[0] || null
            if (file) {
              void importDatasetFromCsv(file)
            }
          }}
        />
        <div className="control-row">
          <button
            type="button"
            className="primary-button"
            onClick={() => fileInputRef.current?.click()}
          >
            Upload dataset
          </button>
          {dataUploadName ? <span className="dataset-upload-name">{dataUploadName}</span> : null}
        </div>
        {dataUploadError ? (
          <p className="agent-error" role="status">{dataUploadError}</p>
        ) : (
          <p className="dataset-upload-copy">Upload a CSV and the current six-widget environment will re-render against the new rows.</p>
        )}
      </div>
      <div className="info-block compact">
        <h4>Active filters</h4>
        <p>{filters.length > 0 ? filters.join(' · ') : 'No active filter.'}</p>
      </div>
    </section>
  )
}
