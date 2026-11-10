import React from 'react';

/**
 * Resilient Error Boundary for Momentum OS.
 * Prevents full-screen React unmounts by catching rendering exceptions,
 * displaying an actionable recovery interface, and logging crash forensics.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[Momentum ErrorBoundary Caught Exception]:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false
    });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleReloadPage = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return typeof this.props.fallback === 'function'
          ? this.props.fallback(this.state.error, this.handleReset)
          : this.props.fallback;
      }

      const isViewLevel = Boolean(this.props.viewName);

      return (
        <div className={`flex flex-col items-center justify-center p-6 text-center select-none ${
          isViewLevel ? 'min-h-[50vh] w-full' : 'min-h-screen w-screen bg-[#F7F6F2] dark:bg-[#121214] text-[#161618] dark:text-[#F7F6F2]'
        }`}>
          <div className="max-w-md w-full p-6 sm:p-8 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-[#18181B]/80 backdrop-blur-xl shadow-xl flex flex-col items-center gap-4">
            {/* Warning Icon Badge */}
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <span className="material-symbols-outlined text-[24px]">shield_alert</span>
            </div>

            {/* Error Message Header */}
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-[#161618] dark:text-[#F7F6F2]">
                {isViewLevel ? `Error Rendering ${this.props.viewName}` : 'Session Interruption Detected'}
              </h2>
              <p className="mt-1 text-xs text-[#6B6A72] dark:text-[#8E8E93] leading-relaxed">
                Momentum recovered gracefully. Your local data and schedules remain intact.
              </p>
            </div>

            {/* Error Message Extract */}
            {this.state.error?.message && (
              <div className="w-full p-2.5 rounded-lg bg-black/[0.04] dark:bg-white/[0.04] text-[11px] font-mono text-left text-rose-600 dark:text-rose-400 break-words">
                {String(this.state.error.message)}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5 w-full mt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 px-4 py-2 rounded-xl text-xs font-semibold bg-[#161618] dark:bg-[#F7F6F2] text-white dark:text-[#161618] hover:opacity-90 active:scale-95 transition-all shadow-sm cursor-pointer"
              >
                Try Reloading View
              </button>
              <button
                type="button"
                onClick={this.handleReloadPage}
                className="px-4 py-2 rounded-xl text-xs font-medium border border-black/10 dark:border-white/10 text-[#6B6A72] dark:text-[#8E8E93] hover:text-[#161618] dark:hover:text-[#F7F6F2] hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
              >
                Refresh App
              </button>
            </div>

            {/* Technical Diagnostics Toggle */}
            <button
              type="button"
              onClick={() => this.setState(prev => ({ showDetails: !prev.showDetails }))}
              className="text-[10.5px] font-mono text-[#6B6A72] dark:text-[#8E8E93] hover:underline cursor-pointer mt-1"
            >
              {this.state.showDetails ? 'Hide Diagnostics ▲' : 'View Diagnostics ▼'}
            </button>

            {/* Stack Details Box */}
            {this.state.showDetails && (
              <div className="w-full max-h-36 overflow-auto p-3 rounded-lg bg-black/[0.06] dark:bg-black/40 text-[10px] font-mono text-left text-[#6B6A72] dark:text-[#8E8E93] whitespace-pre-wrap select-text">
                {this.state.error?.stack || 'No stack trace available.'}
                {this.state.errorInfo?.componentStack && `\n\nComponent Stack:${this.state.errorInfo.componentStack}`}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
