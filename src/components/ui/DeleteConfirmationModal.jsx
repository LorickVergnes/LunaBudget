import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2, AlertTriangle } from 'lucide-react';

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, loading }) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setShow(true));
      document.body.style.overflow = 'hidden';
    } else {
      setShow(false);
      const otherModals = document.querySelectorAll('[data-modal-open="true"]');
      if (otherModals.length <= 1) {
        document.body.style.overflow = 'auto';
      }
    }
    return () => { 
      const otherModals = document.querySelectorAll('[data-modal-open="true"]');
      if (otherModals.length <= 1) {
        document.body.style.overflow = 'auto';
      }
    };
  }, [isOpen]);

  if (!isOpen && !show) return null;

  const handleClose = () => {
    setShow(false);
    setTimeout(onClose, 300);
  };

  const modalContent = (
    <div 
      data-modal-open={isOpen ? "true" : "false"}
      style={{ 
        position: 'fixed', inset: 0, 
        zIndex: 10000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        background: show ? 'rgba(0,0,0,0.4)' : 'transparent',
        backdropFilter: show ? 'blur(4px)' : 'none',
        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: show ? 'auto' : 'none',
      }}
      onClick={e => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div 
        onClick={e => e.stopPropagation()} 
        style={{ 
          width: '100%', maxWidth: 480, 
          background: 'white',
          borderRadius: '32px 32px 0 0', 
          padding: '32px 24px', 
          boxShadow: '0 -8px 40px rgba(0,0,0,0.2)',
          display: 'flex', flexDirection: 'column',
          position: 'relative',
          transform: show ? 'translateY(0)' : 'translateY(100%)',
          opacity: show ? 1 : 0.8,
          transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease',
        }}
      >
        {/* Close Button */}
        <button 
          type="button"
          onClick={handleClose} 
          style={{ 
            position: 'absolute', top: 20, right: 20, 
            background: '#F3F4F6', border: 'none', borderRadius: '50%', 
            width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', 
            cursor: 'pointer'
          }}
        >
          <X size={20} style={{ color: '#6B7280' }} />
        </button>

        {/* Warning Icon */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={32} style={{ color: '#EF4444' }} />
          </div>
        </div>
        
        {/* Title & Message */}
        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1a1a2e', textAlign: 'center', marginBottom: 12 }}>
          {title || "Confirmation de suppression"}
        </h2>
        <p style={{ fontSize: 16, color: '#6B7280', textAlign: 'center', marginBottom: 32, lineHeight: 1.5 }}>
          {message || "Êtes-vous sûr de vouloir supprimer cet élément ? Cette action est irréversible."}
        </p>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button 
            onClick={onConfirm}
            disabled={loading}
            style={{ 
              background: '#EF4444', color: 'white', border: 'none', borderRadius: 16, 
              padding: '16px', fontSize: 16, fontWeight: 700, cursor: 'pointer', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 4px 14px rgba(239,68,68,0.3)'
            }}
          >
            {loading ? <span className="animate-spin-smooth">⏳</span> : <Trash2 size={20} />}
            {loading ? 'Suppression...' : 'Supprimer'}
          </button>
          
          <button 
            onClick={handleClose}
            style={{ 
              background: 'transparent', color: '#6B7280', border: 'none', borderRadius: 16, 
              padding: '12px', fontSize: 16, fontWeight: 600, cursor: 'pointer'
            }}
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default DeleteConfirmationModal;
