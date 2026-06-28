/**
 * Purpose: React error boundary — catches render errors in the subtree and shows a recovery UI.
 * Inputs: children (React node); optional fallback render prop; optional onError callback.
 * Outputs: Renders children normally; on error renders recovery card with retry button.
 * Constraints: Class component required (hooks cannot catch render errors).
 *   Recovery: unmounts and remounts the subtree via React key reset.
 *   Reports to Sentry via onError callback (wired in app root).
 * SPORT: P5-mobile-robustness
 */
import React, { Component, type ReactNode, type ErrorInfo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  children: ReactNode;
  /** Called when an error is caught — use to report to Sentry. */
  onError?: (error: Error, info: ErrorInfo) => void;
  /** Custom fallback renderer. Receives reset function. */
  fallback?: (reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  resetKey: number;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, resetKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
  }

  reset = () => {
    this.setState((s) => ({ hasError: false, error: null, resetKey: s.resetKey + 1 }));
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback(this.reset);
      return (
        <View style={styles.container} accessibilityRole="alert">
          <Text style={styles.icon}>⚠️</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>{this.state.error?.message ?? 'An unexpected error occurred.'}</Text>
          <TouchableOpacity style={styles.button} onPress={this.reset} accessibilityRole="button" accessibilityLabel="Try again">
            <Text style={styles.buttonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    // Key reset forces subtree remount on recovery
    return <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  icon: { fontSize: 48 },
  title: { fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center' },
  message: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  button: { marginTop: 8, backgroundColor: '#6366F1', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 8 },
  buttonText: { color: '#FFF', fontWeight: '600', fontSize: 15 },
});
