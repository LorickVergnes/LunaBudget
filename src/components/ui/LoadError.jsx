import React from 'react';
import { CloudOff, RotateCw } from 'lucide-react';

/**
 * Affiché à la place du contenu quand les données n'ont pas pu être chargées.
 * Sans lui, une panne réseau ressemblerait à un budget vide.
 */
const LoadError = ({ onRetry }) => (
  <div className="card load-error" role="alert" style={{ padding: '40px 20px', textAlign: 'center', marginTop: 16 }}>
    <CloudOff size={36} style={{ color: '#B0B8C9', margin: '0 auto 12px' }} />
    <p style={{ fontSize: 15, fontWeight: 800, color: '#4A6984', marginBottom: 4 }}>Impossible de charger vos données</p>
    <p style={{ fontSize: 13, fontWeight: 500, color: '#6B7280', marginBottom: 16 }}>Vérifiez votre connexion à Internet, puis réessayez.</p>
    {onRetry && (
      <button type="button" onClick={() => onRetry()}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#4A6984', color: 'white', border: 'none', borderRadius: 12, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
        <RotateCw size={16} /> Réessayer
      </button>
    )}
  </div>
);

export default LoadError;
