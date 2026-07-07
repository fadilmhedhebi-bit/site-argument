import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <h2 className="text-lg font-semibold mb-2" style={{ color: '#EF4444' }}>Une erreur est survenue</h2>
          <p className="text-sm mb-4" style={{ color: '#6B7280' }}>Ce module a rencontré un problème.</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold"
            style={{ backgroundColor: '#5C6B3C', color: '#fff' }}
          >
            Réessayer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
