import React from 'react'

export class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('App render failed', error, info)
  }

  render() {
    if (!this.state.error) {
      return this.props.children
    }

    const error = this.state.error
    return (
      <div
        style={{
          minHeight: '100vh',
          padding: 24,
          background: '#f1f3f6',
          color: '#26374d',
          fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 980,
            margin: '0 auto',
            background: '#fff',
            border: '1px solid #cfd6e2',
            borderRadius: 8,
            padding: 20,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            Frontend Render Error
          </div>
          <div style={{ fontSize: 14, color: '#4d617b', marginBottom: 16 }}>
            React rendered a fatal error during page initialization. Check the message below and browser console.
          </div>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: 13,
              lineHeight: 1.5,
              padding: 12,
              borderRadius: 6,
              background: '#f6f8fb',
              border: '1px solid #cfd6e2',
            }}
          >
            {error?.stack || error?.message || String(error)}
          </pre>
        </div>
      </div>
    )
  }
}
