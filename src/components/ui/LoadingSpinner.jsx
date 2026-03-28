import React from 'react';

const LoadingSpinner = ({ 
  size = 40, 
  color = '#5C6EFF', 
  fullHeight = false,
  message = "" 
}) => {
  const containerStyle = fullHeight 
    ? { minHeight: '80vh', width: '100%' }
    : { padding: '60px 0', width: '100%' };

  return (
    <div className="loading-container" style={containerStyle}>
      <div style={{ position: 'relative', width: size, height: size }}>
        {/* Outer ring */}
        <div 
          style={{ 
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: `3px solid ${color}15`, // Very light version of the color
          }}
        />
        
        {/* Spinning gradient ring */}
        <div 
          style={{ 
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: `3px solid transparent`,
            borderTopColor: color,
            borderRightColor: color,
            animation: 'spin-slow 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite',
          }}
        />

        {/* Center pulse dot */}
        <div 
          style={{ 
            position: 'absolute',
            inset: '30%',
            borderRadius: '50%',
            backgroundColor: color,
            animation: 'pulse-subtle 1.5s ease-in-out infinite',
            boxShadow: `0 0 10px ${color}40`,
          }}
        />
      </div>
      
      {message && (
        <span style={{ 
          fontSize: 14, 
          fontWeight: 600, 
          color: '#64748b',
          marginTop: 4 
        }}>
          {message}
        </span>
      )}
    </div>
  );
};

export default LoadingSpinner;
