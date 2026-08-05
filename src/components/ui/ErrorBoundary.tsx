import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { surface: string; children: ReactNode }
type State = { message?: string }

// One panel throwing must not blank the whole app. A live solve in progress is the
// expensive thing to lose: the capture keeps running in LiveSolve's own state, so a
// crashed cube view has to stay a crashed cube view and nothing more.
export class ErrorBoundary extends Component<Props, State> {
  state: State = {}

  static getDerivedStateFromError(error: unknown): State {
    return { message: error instanceof Error ? error.message : 'Something went wrong' }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[${this.props.surface}]`, error, info.componentStack)
  }

  render() {
    if (!this.state.message) return this.props.children
    return (
      <article className="panel">
        <header className="panel-head">
          <span className="kicker">{this.props.surface}</span>
          <h2>This panel stopped</h2>
        </header>
        <p className="panel-note">{this.state.message}</p>
        <div className="stage-actions">
          <button className="button secondary" onClick={() => this.setState({ message: undefined })}>Try again</button>
        </div>
      </article>
    )
  }
}
