import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';

const ToastContext = createContext();

let toastIdCounter = 0;

/**
 * Toast Provider — gère les messages flash de l'application.
 * 
 * Usage :
 *   const { showToast } = useToast();
 *   showToast('Nom mis à jour !');                              // succès par défaut (vert, 3s)
 *   showToast('Erreur serveur', { type: 'error' });             // erreur (rouge, 4s)
 *   showToast('Attention !', { type: 'warning', duration: 5000 });
 *   showToast('Info utile', { type: 'info' });
 *   showToast('Custom', { bg: '#6366f1', duration: 2000 });     // couleur custom
 */
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const removeToast = useCallback((id) => {
    // Marquer comme "exiting" pour l'animation de sortie
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    // Retirer du DOM après l'animation
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 320);
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
  }, []);

  const showToast = useCallback((message, options = {}) => {
    const {
      type = 'success',  // 'success' | 'error' | 'warning' | 'info'
      duration = null,    // null = auto par type
      bg = null,          // couleur custom (override le type)
    } = options;

    // Durées par défaut selon le type
    const defaultDurations = {
      success: 3000,
      error: 4000,
      warning: 4000,
      info: 3500,
    };

    const finalDuration = duration || defaultDurations[type] || 3000;

    const id = ++toastIdCounter;
    const toast = { id, message, type, bg, exiting: false };

    setToasts(prev => [...prev, toast]);

    // Auto-dismiss
    timersRef.current[id] = setTimeout(() => {
      removeToast(id);
    }, finalDuration);

    return id;
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
};

/* ═══════════════════════════════════════════
   Toast Container + Toast Item (rendu)
   ═══════════════════════════════════════════ */

const TYPE_CONFIG = {
  success: {
    bg: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
    icon: '✓',
    iconBg: 'rgba(255,255,255,0.2)',
  },
  error: {
    bg: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    icon: '✕',
    iconBg: 'rgba(255,255,255,0.2)',
  },
  warning: {
    bg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    icon: '⚠',
    iconBg: 'rgba(255,255,255,0.2)',
  },
  info: {
    bg: 'linear-gradient(135deg, #A0D2EB 0%, #6BA3C4 100%)',
    icon: 'ℹ',
    iconBg: 'rgba(255,255,255,0.2)',
  },
};

const ToastContainer = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return createPortal(
    <div className="toast-container" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>,
    document.body
  );
};

const ToastItem = ({ toast, onDismiss }) => {
  const config = TYPE_CONFIG[toast.type] || TYPE_CONFIG.success;
  const background = toast.bg || config.bg;

  return (
    <div
      className={`toast-item ${toast.exiting ? 'toast-exit' : 'toast-enter'}`}
      style={{ background }}
      role="alert"
    >
      <div className="toast-icon" style={{ background: config.iconBg }}>
        <span>{config.icon}</span>
      </div>
      <p className="toast-message">{toast.message}</p>
      <button
        className="toast-close"
        onClick={() => onDismiss(toast.id)}
        aria-label="Fermer"
      >
        ✕
      </button>
    </div>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};
