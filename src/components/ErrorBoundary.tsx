import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Last-resort safety net. Without this, any uncaught render error unmounts
 * the entire tree and leaves only the body's `bg-navy` background visible —
 * a blank blue screen with no way forward except knowing to hit refresh.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  public override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled render error', error, info.componentStack);
  }

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-navy px-4">
          <div className="glass-heavy rounded-2xl px-9 py-11 max-w-[420px] text-center">
            <h1 className="text-[18px] font-bold mb-2">Something went wrong</h1>
            <p className="text-[13px] text-text-muted mb-6">
              An unexpected error occurred. Reloading the page usually fixes this.
            </p>
            <button
              type="button"
              className="btn btn-crimson w-full"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
