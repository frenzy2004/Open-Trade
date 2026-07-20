import {
  Component,
  type ErrorInfo,
  type PropsWithChildren,
  type ReactNode,
} from 'react'
import { Button } from '../../shared/ui'

interface RouteErrorBoundaryState {
  readonly error: Error | null
}

interface RouteErrorBoundaryProps extends PropsWithChildren<object> {
  readonly onRetry?: () => void
}

export class RouteErrorBoundary extends Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  state: RouteErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('OpenTrade route error', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.error === null) {
      return this.props.children
    }

    return (
      <section className="route-error" role="alert">
        <p className="route-error__eyebrow">Recoverable route error</p>
        <h1>This game hit a snag</h1>
        <p>Your saved progress is still in this browser.</p>
        <div className="route-error__actions">
          <Button
            onClick={() => {
              this.props.onRetry?.()
              this.setState({ error: null })
            }}
          >
            Try again
          </Button>
          <a className="ui-button ui-button--secondary" href="#/">
            Return to games
          </a>
        </div>
      </section>
    )
  }
}
