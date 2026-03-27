import React from 'react';
import { ALL_COLORS } from '../../lib/colorUtils';

const ColorPicker = ({ value, onChange }) => {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', display: 'block', marginBottom: 12 }}>
        Couleur de l'icône
      </label>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
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
                border: isSelected ? '3px solid #1a1a2e' : 'none', 
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
