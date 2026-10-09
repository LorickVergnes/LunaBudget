import React from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Rattrape une erreur survenue pendant l'affichage d'une page.
 * Sans lui, React retire toute l'application de l'écran : l'utilisateur voit une page blanche.
 *
 * Placé autour d'une page avec `key={pathname}`, il se réinitialise en changeant de page.
 */
class ErrorBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div role="alert" style={{ minHeight: this.props.fullScreen ? '100vh' : '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div className="card" style={{ padding: '40px 24px', textAlign: 'center', maxWidth: 420, width: '100%' }}>
          <AlertTriangle size={36} style={{ color: '#D97706', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 16, fontWeight: 800, color: '#4A6984', marginBottom: 4 }}>Une erreur est survenue</p>
          <p style={{ fontSize: 13, fontWeight: 500, color: '#6B7280', marginBottom: 16 }}>
            Cette page n'a pas pu s'afficher. Vos données ne sont pas touchées.
          </p>
          <button type="button" onClick={() => window.location.reload()}
            style={{ background: '#4A6984', color: 'white', border: 'none', borderRadius: 12, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            Recharger la page
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
