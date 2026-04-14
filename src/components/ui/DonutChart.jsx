import React from 'react';
import { groupSegments } from '../../lib/colorUtils';

const DonutChart = ({ segments, total, size = 140, centerLabel = "Total", limit = 10, className = "" }) => {
  const r = 52, cx = 70, cy = 70;
  const circ = 2 * Math.PI * r;

  // Apply "Other" grouping
  const processedSegments = groupSegments(segments, limit);
  const processedTotal = processedSegments.reduce((a, s) => a + s.value, 0) || total || 0;

  // Scaling factor for text
  const scale = size / 140;

  return (
    <div className={className} style={{ position: 'relative', width: size, height: size, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <svg width={size} height={size} viewBox="0 0 140 140" style={{ transform: 'rotate(-90deg)' }}>
        {/* Background circle (Separator color) */}
        <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth={16} stroke="#FFFFFF" />
        
        {/* Background track (Light gray) if total is 0 or to fill empty space */}
        <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth={16} stroke="#EEF2FB" />

        {processedSegments.map((seg, i) => {
          const pct = processedTotal > 0 ? seg.value / processedTotal : 0;
          // Subtract a small amount (2px) from the dash length to create the white separator effect
          const dashLength = Math.max(0, pct * circ - 1.5);
          const strokeDasharray = `${dashLength} ${circ}`;

          // Calculate offset based on previous segments
          const previousSum = processedSegments.slice(0, i).reduce((a, s) => a + s.value, 0);
          const strokeDashoffset = -(previousSum / processedTotal * circ);

          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              strokeWidth={16}
              stroke={seg.color}
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="butt"
              style={{ 
                transformOrigin: '70px 70px', 
                transition: 'stroke-dasharray 0.7s ease, stroke-dashoffset 0.7s ease' 
              }}
            />
          );
        })}
      </svg>
      <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', textAlign: 'center' }}>
        <span style={{ fontSize: Math.max(12, 16 * scale), fontWeight: 900, color: '#1a1a2e', display: 'block' }}>
          {processedTotal.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
        </span>
        <span style={{ fontSize: Math.max(8, 10 * scale), fontWeight: 700, color: '#B0B8C9', textTransform: 'uppercase', letterSpacing: 1 * scale }}>
          {centerLabel}
        </span>
      </div>
    </div>
  );
};

export default DonutChart;
