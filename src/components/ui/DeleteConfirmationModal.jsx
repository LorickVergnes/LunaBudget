import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2, AlertTriangle } from 'lucide-react';

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, loading }) => {
  const [show, setShow] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setShow(true));
      document.body.style.overflow = 'hidden';
    } else {
      setShow(false);
      setDragY(0);
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

  const handleClose = () => {
    setShow(false);
    setDragY(0);
    setTimeout(onClose, 300);
  };

  const onTouchStart = (e) => {
    startY.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const onTouchMove = (e) => {
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - startY.current;
    if (deltaY > 0) {
      setDragY(deltaY);
    }
  };

  const onTouchEnd = () => {
    setIsDragging(false);
    if (dragY > 100) {
      handleClose();
    } else {
      setDragY(0);
    }
  };

  if (!isOpen && !show) return null;

  const modalContent = (
    <div 
      data-modal-open={isOpen ? "true" : "false"}
      style={{ 
        position: 'fixed', inset: 0, 
        zIndex: 10000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        background: show ? 'rgba(0,0,0,0.4)' : 'transparent',
        backdropFilter: show ? 'blur(4px)' : 'none',
        transition: isDragging ? 'none' : 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: show ? 'auto' : 'none',
      }}
      onClick={e => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div 
        onClick={e => e.stopPropagation()} 
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ 
          width: '100%', maxWidth: 480, 
          background: 'white',
          borderRadius: '32px 32px 0 0', 
          padding: '12px 24px 32px', 
          boxShadow: '0 -8px 40px rgba(0,0,0,0.2)',
          display: 'flex', flexDirection: 'column',
          position: 'relative',
          transform: show ? `translateY(${dragY}px)` : 'translateY(100%)',
          opacity: show ? 1 : 0.8,
          transition: isDragging ? 'none' : 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease',
          touchAction: 'none'
        }}
      >
        {/* Drag Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginBottom: 12 }}>
          <div style={{ width: 40, height: 5, borderRadius: 10, background: '#E5E7EB' }} />
        </div>

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
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20, marginTop: 8 }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, touchAction: 'auto' }}>
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
