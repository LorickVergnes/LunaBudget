import React from 'react';

const AmbientOrbs = () => {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      zIndex: -1,
      pointerEvents: 'none',
      overflow: 'hidden'
    }}>
      {/* Cercle Lumineux Bleu Glace */}
      <div style={{
        position: 'absolute',
        top: '10%',
        left: '10%',
        width: '250px',
        height: '250px',
        borderRadius: '50%',
        background: '#A0D2EB',
        opacity: 0.6,
        filter: 'blur(45px)',
        transform: 'translate3d(0,0,0)',
        animation: 'floatOrb 6s ease-in-out infinite'
      }} />

      {/* Cercle Lumineux Or Cristallin */}
      <div style={{
        position: 'absolute',
        top: '45%',
        right: '5%',
        width: '200px',
        height: '200px',
        borderRadius: '50%',
        background: '#E5BA73',
        opacity: 0.5,
        filter: 'blur(45px)',
        transform: 'translate3d(0,0,0)',
        animation: 'floatOrb 8s ease-in-out infinite reverse'
      }} />

      <style>{`
        @keyframes floatOrb {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-20px) scale(1.03); }
        }
      `}</style>
    </div>
  );
};

export default AmbientOrbs;
