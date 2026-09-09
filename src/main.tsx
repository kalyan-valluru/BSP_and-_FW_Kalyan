import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ThemeProvider } from './contexts/ThemeContext.tsx';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[React Error Boundary]', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0d1117] text-white flex flex-col items-center justify-center p-6 font-mono">
          <div className="max-w-md w-full bg-[#161b22] border border-[#30363d] rounded-xl p-6 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4 text-xl">
              ⚠️
            </div>
            <h2 className="text-lg font-bold text-red-400 mb-2">Application Interface Exception</h2>
            <p className="text-xs text-gray-400 mb-4 leading-relaxed">
              A runtime component exception occurred. The error details have been logged.
            </p>
            {this.state.error && (
              <pre className="text-[10px] bg-[#0d1117] text-red-300 p-3 rounded-lg overflow-x-auto text-left mb-6 border border-[#30363d] max-h-32">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={this.handleReset}
              className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold text-xs rounded-lg hover:opacity-90 transition-all cursor-pointer shadow-lg shadow-cyan-500/20"
            >
              Reload Dashboard Interface
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </GlobalErrorBoundary>
  </React.StrictMode>
);
