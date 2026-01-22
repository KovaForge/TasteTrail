import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    
    // Dispatch error to debug console
    const event = new CustomEvent('tastetrail:error', {
      detail: {
        type: 'render',
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
      },
    });
    window.dispatchEvent(event);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleCopy = async () => {
    const { error, errorInfo } = this.state;
    const report = [
      'TasteTrail Error Report',
      `Time: ${new Date().toISOString()}`,
      `Error: ${error?.message}`,
      '',
      'Stack Trace:',
      error?.stack || 'No stack trace available',
      '',
      'Component Stack:',
      errorInfo?.componentStack || 'No component stack available',
    ].join('\n');

    try {
      await navigator.clipboard.writeText(report);
      alert('Error report copied to clipboard');
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = report;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      alert('Error report copied to clipboard');
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <svg 
              className="error-icon" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            
            <h2>Something went wrong</h2>
            <p className="error-message">{this.state.error?.message}</p>
            
            <div className="error-actions">
              <button className="btn btn-primary" onClick={this.handleRetry}>
                Try Again
              </button>
              <button className="btn btn-secondary" onClick={this.handleCopy}>
                Copy Error Report
              </button>
            </div>

            <details className="error-details">
              <summary>Technical Details</summary>
              <pre>{this.state.error?.stack}</pre>
              <pre>{this.state.errorInfo?.componentStack}</pre>
            </details>
          </div>
          
          <style>{`
            .error-boundary {
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              padding: var(--space-lg);
              background: var(--color-bg-primary);
            }
            .error-boundary-content {
              text-align: center;
              max-width: 400px;
            }
            .error-icon {
              width: 64px;
              height: 64px;
              color: var(--color-error);
              margin-bottom: var(--space-lg);
            }
            .error-boundary h2 {
              margin-bottom: var(--space-sm);
            }
            .error-message {
              color: var(--color-text-secondary);
              margin-bottom: var(--space-lg);
            }
            .error-actions {
              display: flex;
              gap: var(--space-md);
              justify-content: center;
              margin-bottom: var(--space-lg);
            }
            .error-details {
              text-align: left;
              background: var(--color-bg-secondary);
              border-radius: var(--radius-md);
              padding: var(--space-md);
            }
            .error-details summary {
              cursor: pointer;
              color: var(--color-text-secondary);
              margin-bottom: var(--space-sm);
            }
            .error-details pre {
              font-size: var(--font-size-xs);
              overflow-x: auto;
              white-space: pre-wrap;
              word-break: break-word;
              color: var(--color-text-tertiary);
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}
