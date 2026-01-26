'use client';

import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  context?: string; // e.g., "project-creation", "editorial", "profile"
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showRetry?: boolean;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class DesignerFlowErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[${this.props.context || 'unknown'}] Error caught:`, error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div className="rounded-lg bg-neutral-50 p-6 max-w-md">
            <h2 className="text-lg font-semibold text-neutral-900 mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-neutral-600 mb-4">
              We encountered an unexpected error. Your work has been saved.
            </p>
            {this.props.showRetry !== false && (
              <button
                onClick={this.handleRetry}
                className="px-4 py-2 bg-neutral-900 text-white rounded-md text-sm hover:bg-neutral-800 transition-colors"
              >
                Try again
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default DesignerFlowErrorBoundary;
