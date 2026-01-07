'use client';

import React, { Component, ReactNode } from 'react';
import { FaExclamationTriangle, FaRefresh } from 'react-icons/fa';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ImageErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    console.warn('Image Error Boundary caught error:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error for debugging
    console.error('Image Error Boundary:', error, errorInfo);
    
    // Check if it's an image-related error
    const isImageError = error.message?.includes('next/image') || 
                        error.message?.includes('hostname') ||
                        error.message?.includes('configured under images');
    
    if (isImageError) {
      console.warn('Detected image configuration error - this should be handled gracefully');
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="flex flex-col items-center justify-center p-4 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300">
          <FaExclamationTriangle className="w-8 h-8 text-yellow-500 mb-2" />
          <p className="text-gray-600 text-sm text-center mb-3">
            Image failed to load
          </p>
          <button
            onClick={this.handleRetry}
            className="flex items-center gap-2 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors"
          >
            <FaRefresh className="w-3 h-3" />
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
} 