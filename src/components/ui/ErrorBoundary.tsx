import { Component, type ErrorInfo, type ReactNode } from 'react'
import { css } from 'styled-system/css'

type Props = { surface: string; children: ReactNode }
type State = { message?: string }

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
      <section role="alert" className={css({ m: { base: '4', md: '8' }, p: '5', display: 'flex', flexDirection: 'column', gap: '3', alignItems: 'flex-start', borderRadius: 'card', bg: 'container', borderWidth: '1px', borderColor: 'floating' })}>
        <h2 className={css({ fontSize: 'lg', fontWeight: 'semibold' })}>This part of the app stopped</h2>
        <p className={css({ fontSize: 'sm', color: 'inkVariant' })}>{this.props.surface}: {this.state.message}</p>
        <button type="button" onClick={() => this.setState({ message: undefined })} className={css({ px: '4', minH: '11', borderRadius: 'control', borderWidth: '1px', borderColor: 'floating', bg: 'floating', cursor: 'pointer' })}>Try again</button>
      </section>
    )
  }
}
