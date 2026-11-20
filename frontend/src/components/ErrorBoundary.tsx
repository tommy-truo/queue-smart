import { Component, type ReactNode } from 'react'

/** Keeps an unexpected rendering error from leaving the application blank. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() { return { failed: true } }

  render() {
    if (this.state.failed) return (
      <main className="page" role="alert">
        <h1>Something went wrong</h1>
        <p>Reload QueueSmart to try again.</p>
        <a href="/">Return to QueueSmart</a>
      </main>
    )
    return this.props.children
  }
}
