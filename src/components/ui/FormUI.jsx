import React from 'react';
import { Calendar, Check, Loader2 } from 'lucide-react';

const labelStyle = (marginBottom) => ({ fontSize: 12, fontWeight: 700, color: '#4A6984', display: 'block', marginBottom });
const inputStyle = { width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: 15, color: '#4B5563' };

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

// TextField: champ texte obligatoire avec son libellé
export const TextField = ({ label, value, onChange, placeholder }) => (
  <FormCard>
    <label style={labelStyle(4)}>{label}</label>
    <input type="text" required placeholder={placeholder} value={value} onChange={onChange} style={inputStyle} />
  </FormCard>
);

// DateField: champ date obligatoire
export const DateField = ({ value, onChange }) => (
  <FormCard style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
    <Calendar size={22} style={{ color: '#9CA3AF' }} />
    <div style={{ flex: 1 }}>
      <label style={labelStyle(2)}>Date</label>
      <input type="date" required value={value} onChange={onChange} style={inputStyle} />
    </div>
  </FormCard>
);

// NumberField: montant facultatif avec son libellé
export const NumberField = ({ label, hint, value, onChange, placeholder }) => (
  <FormCard>
    <label style={labelStyle(4)}>{label}</label>
    {hint && <span style={{ fontSize: 12, color: '#9CA3AF', display: 'block', marginBottom: 8 }}>{hint}</span>}
    <input type="number" step="0.01" min="0" placeholder={placeholder} value={value} onChange={onChange} className="no-spinners" style={inputStyle} />
  </FormCard>
);

// MonthField: mois facultatif (AAAA-MM) avec son libellé
export const MonthField = ({ label, hint, value, onChange, min }) => (
  <FormCard>
    <label style={labelStyle(4)}>{label}</label>
    {hint && <span style={{ fontSize: 12, color: '#9CA3AF', display: 'block', marginBottom: 8 }}>{hint}</span>}
    <input type="month" min={min} value={value} onChange={onChange} style={inputStyle} />
  </FormCard>
);

// CheckboxCard: carte cliquable avec une case à cocher (ex. "récurrent")
export const CheckboxCard = ({ label, text, checked, onToggle }) => (
  <FormCard style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} onClick={onToggle}>
    <div>
      <label style={labelStyle(4)}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 20, height: 20, borderRadius: 6, border: checked ? 'none' : '2px solid #D1D5DB', background: checked ? '#3B82F6' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {checked && <Check size={14} color="white" />}
        </div>
        <span style={{ fontSize: 15, color: '#4B5563' }}>{text}</span>
      </div>
    </div>
  </FormCard>
);

// SubmitButton: bouton de validation, remplacé par un spinner pendant l'enregistrement
export const SubmitButton = ({ loading, children }) => (
  <button type="submit" disabled={loading}
    style={{ background: '#3B82F6', color: 'white', border: 'none', borderRadius: 16, padding: '16px', fontSize: 16, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(59,130,246,0.3)', marginTop: 8 }}>
    {loading ? <Loader2 size={24} className="animate-spin-smooth" /> : children}
  </button>
);
