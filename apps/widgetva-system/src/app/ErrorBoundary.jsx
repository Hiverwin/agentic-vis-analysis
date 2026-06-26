import React from 'react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    console.error('widgetva-system render failure', error)
  }

  render() {
    if (this.state.error) {
      return (
        <main className="runtime-fallback" role="alert">
          <p className="eyebrow">Runtime Error</p>
          <h1>WidgetVA host failed to render.</h1>
          <p>{this.state.error.message}</p>
        </main>
      )
    }

    return this.props.children
  }
}
