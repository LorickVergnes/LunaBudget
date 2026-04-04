import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const BottomModal = ({ isOpen, onClose, title, children }) => {
  const [show, setShow] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const modalRef = useRef(null);

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
        zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        background: show ? 'rgba(0,0,0,0.3)' : 'transparent',
        backdropFilter: show ? 'blur(4px)' : 'none',
        transition: isDragging ? 'none' : 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: show ? 'auto' : 'none',
      }}
      onClick={e => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div 
        ref={modalRef}
        className="scrollbar-hide"
        onClick={e => e.stopPropagation()} 
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ 
          width: '100%', maxWidth: 480, maxHeight: '94vh', 
          background: 'linear-gradient(170deg, #f4fcff 0%, #ffffff 40%, #f0fdf4 100%)',
          borderRadius: '32px 32px 0 0', 
          padding: '12px 20px 32px', 
          boxShadow: '0 -8px 40px rgba(0,0,0,0.15)',
          display: 'flex', flexDirection: 'column',
          position: 'relative',
          transform: show ? `translateY(${dragY}px)` : 'translateY(100%)',
          opacity: show ? 1 : 0.8,
          transition: isDragging ? 'none' : 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease',
          overflowY: 'auto',
          touchAction: 'none' // Prevent scrolling while dragging the header
        }}
      >
        {/* Drag Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginBottom: 12, cursor: 'grab' }}>
          <div style={{ width: 40, height: 5, borderRadius: 10, background: '#E5E7EB' }} />
        </div>

        {/* Close Button */}
        <button 
          type="button"
          onClick={handleClose} 
          style={{ 
            position: 'absolute', top: 20, right: 20, 
            background: 'rgba(0,0,0,0.08)', border: 'none', borderRadius: '50%', 
            width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', 
            cursor: 'pointer', zIndex: 10
          }}
        >
          <X size={20} style={{ color: '#666' }} />
        </button>

        {/* Decorative Header Icons */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8, marginBottom: 24, paddingLeft: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#E0F2FE', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3, boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
            <span style={{ fontSize: 20, color: '#38BDF8' }}>🏠</span>
          </div>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#FFEDD5', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4, marginLeft: -16, border: '3px solid white', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
            <span style={{ fontSize: 24, color: '#FB923C' }}>🚗</span>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#FFE4E6', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, marginLeft: -16, boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
            <span style={{ fontSize: 20, color: '#FB7185' }}>📞</span>
          </div>
        </div>
        
        {/* Title */}
        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1a1a2e', textAlign: 'center', marginBottom: 16 }}>
          {title}
        </h2>

        {/* Form Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', touchAction: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default BottomModal;
