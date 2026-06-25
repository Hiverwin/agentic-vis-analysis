export default function RuntimeInitErrorCard({ error }) {
  if (!error) return null

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: 24,
        background: 'var(--bg)',
        color: 'var(--text)',
      }}
    >
      <div
        style={{
          maxWidth: 980,
          margin: '0 auto',
          background: 'var(--surface)',
          border: '1px solid var(--danger)',
          borderRadius: 8,
          padding: 20,
          boxShadow: 'var(--shadow)',
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)', marginBottom: 8 }}>
          WidgetVA Runtime Init Error
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 16 }}>
          Runtime creation failed before the main workspace could render.
        </div>
        <pre
          style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontSize: 13,
            lineHeight: 1.5,
            padding: 12,
            borderRadius: 6,
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
          }}
        >
          {error?.stack || error?.message || String(error)}
        </pre>
      </div>
    </div>
  )
}
