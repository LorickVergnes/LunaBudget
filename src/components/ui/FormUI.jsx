import React from 'react';

// FormCard: A simple white rounded card for form fields
export const FormCard = ({ children, style = {}, onClick }) => (
  <div 
    onClick={onClick}
    style={{ 
      background: 'white', 
      borderRadius: '20px', 
      padding: '16px 20px', 
      boxShadow: '0 2px 8px rgba(0,0,0,0.03)', 
      cursor: onClick ? 'pointer' : 'default',
      ...style 
    }}
  >
    {children}
  </div>
);

// AmountInput: Large, thin text input specifically for amounts
export const AmountInput = ({ value, onChange, color = '#4A6984', autoFocus = false }) => (
  <div style={{ textAlign: 'center', marginBottom: 32 }}>
    <input 
      type="number" 
      step="0.01" 
      placeholder="0,00" 
      required 
      autoFocus={autoFocus}
      className="no-spinners"
      style={{ 
        fontSize: 56, 
        fontWeight: 400, 
        color: color, 
        textAlign: 'center', 
        background: 'transparent', 
        border: 'none', 
        outline: 'none', 
        width: '100%',
        letterSpacing: '-1px'
      }} 
      value={value} 
      onChange={onChange} 
    />
  </div>
);
