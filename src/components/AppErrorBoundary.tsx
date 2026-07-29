import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('zAtlas rendering error', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return <main className="app-fallback"><section className="surface panel"><p className="eyebrow">z Atlas</p><h1>Let’s get you back on track.</h1><p className="muted">Something unexpected interrupted this view. Your data is safe.</p><button className="btn btn-primary" onClick={() => window.location.reload()}>Reload zAtlas</button></section></main>
    }

    return this.props.children
  }
}
