import { Component, type ErrorInfo, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled UI error', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div role="alert" className="flex min-h-svh flex-col items-center justify-center px-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          The page hit an unexpected error. Reloading usually fixes it.
        </p>
        <Button className="mt-6" size="lg" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </div>
    )
  }
}
