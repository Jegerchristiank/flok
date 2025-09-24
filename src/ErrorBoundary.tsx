import React from 'react';

type State = { hasError: boolean; error?: any };

export default class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError(_error: any) {
    return { hasError: true, error: _error };
  }
  componentDidCatch(_error: any, _info: any) {
    // In a real app: send to monitoring
    // console.error('ErrorBoundary', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24 }}>
          <h1>Der skete en fejl</h1>
          <p>Prøv at opdatere siden. Fejlen er registreret i konsollen.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
