import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Without this boundary, any uncaught render/effect error in production
 * silently unmounts the whole React tree, leaving a blank white page with
 * no feedback at all — the exact "white screen, buttons don't respond"
 * symptom. Catch it and show the real error message instead of nothing.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error('App crashed:', error, info?.componentStack);
  }

  // React's error boundary only catches errors thrown during render/effects.
  // Errors thrown from async code (event handlers, promise rejections) never
  // reach getDerivedStateFromError, so they'd otherwise fail silently with no
  // visible feedback at all. Catch those too and show the same screen.
  private onWindowError = (event: ErrorEvent) => {
    if (event.error instanceof Error) this.setState({ error: event.error });
  };
  private onRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    this.setState({ error: reason instanceof Error ? reason : new Error(String(reason)) });
  };

  componentDidMount() {
    window.addEventListener('error', this.onWindowError);
    window.addEventListener('unhandledrejection', this.onRejection);
  }

  componentWillUnmount() {
    window.removeEventListener('error', this.onWindowError);
    window.removeEventListener('unhandledrejection', this.onRejection);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          dir="rtl"
          style={{
            padding: 24,
            fontFamily: 'sans-serif',
            background: '#1a1a2e',
            color: '#e0e0e0',
            minHeight: '100vh',
          }}
        >
          <h2 style={{ color: '#ff6b7a' }}>⚠️ حدث خطأ غير متوقع في التطبيق</h2>
          <p>حاول تحديث الصفحة. إذا استمرت المشكلة، أرسل هذا النص:</p>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              background: '#16213e',
              padding: 12,
              borderRadius: 8,
              direction: 'ltr',
              textAlign: 'left',
              fontSize: 13,
            }}
          >
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 12,
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              background: '#4d7cfe',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            إعادة تحميل الصفحة
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
