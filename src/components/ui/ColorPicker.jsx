import React from 'react';
import { ALL_COLORS } from '../../lib/colorUtils';

const ColorPicker = ({ value, onChange }) => {
  return (
    <div className="color-picker-container">
      <style>{`
        .color-grid {
          display: grid;
          gap: 12px;
          justify-items: center;
          grid-template-columns: repeat(6, 1fr);
        }
        
        @media (min-width: 420px) {
          .color-grid {
            grid-template-columns: repeat(9, 1fr);
          }
        }

        @media (max-width: 280px) {
          .color-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
      `}</style>
      <label style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', display: 'block', marginBottom: 12 }}>
        Couleur de l'icône
      </label>
      <div className="color-grid">
        {ALL_COLORS.map(c => {
          const isSelected = value === c;
          
          return (
            <button 
              key={c} 
              type="button" 
              onClick={() => onChange(c)}
              style={{ 
                width: 32, 
                height: 32, 
                borderRadius: '50%', 
                background: c, 
                border: isSelected ? '3px solid #4A6984' : 'none', 
                cursor: 'pointer', 
                padding: 0,
                position: 'relative',
                transition: 'transform 0.2s',
                transform: isSelected ? 'scale(1.1)' : 'scale(1)',
              }} 
            >
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ColorPicker;
