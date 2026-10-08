import React from 'react';

// Barre de progression horizontale (plafonnée à 100 %)
export const ProgressLinear = ({ value, max, color, height = 6 }) => {
  const pct = Math.min((value / Math.max(max, 1)) * 100, 100);
  return (
    <div style={{ height, borderRadius: 99, background: 'transparent', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, background: color, transition: 'width .7s ease' }} />
    </div>
  );
};

// Anneau de progression à une seule valeur, avec un libellé optionnel au centre
export const SingleDonut = ({ value, max, size = 90, stroke = 10, color = '#A0D2EB', trackColor = '#F4F7F6', label, sublabel, textColor = '#4A6984', subTextColor = '#B0B8C9', textShadow = 'none' }) => {
  const pct = Math.min(value / Math.max(max, 1), 1);
  const r = (size - stroke) / 2;
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  const dashLength = Math.max(0, pct * circ);

  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth={stroke} stroke={trackColor} />
        <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth={stroke} stroke={color} strokeDasharray={`${dashLength} ${circ}`} strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.7s ease' }} />
      </svg>
      {(label || sublabel) && (
        <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', textAlign: 'center', textShadow }}>
          {label && <span style={{ fontSize: size * 0.2, fontWeight: 900, color: textColor, display: 'block' }}>{label}</span>}
          {sublabel && <span style={{ fontSize: size * 0.09, fontWeight: 700, color: subTextColor, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2, opacity: 0.9 }}>{sublabel}</span>}
        </div>
      )}
    </div>
  );
};
