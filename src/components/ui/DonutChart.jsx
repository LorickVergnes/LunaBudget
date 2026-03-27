import React from 'react';
import { groupSegments } from '../../lib/colorUtils';

const DonutChart = ({ segments, total, size = 140, centerLabel = "Total", limit = 10 }) => {
  const r = 52, cx = 70, cy = 70;
  const circ = 2 * Math.PI * r;

  // Apply "Other" grouping
  const processedSegments = groupSegments(segments, limit);
  const processedTotal = processedSegments.reduce((a, s) => a + s.value, 0) || total || 1;

  return (
    <svg width={size} height={size} viewBox="0 0 140 140">
      {/* Background circle (Separator color) */}
      <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth={16} stroke="#FFFFFF" />
      
      {/* Background track (Light gray) if total is 0 or to fill empty space */}
      <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth={16} stroke="#EEF2FB" strokeDasharray={`0 ${circ}`} />

      {processedSegments.map((seg, i) => {
        const pct = processedTotal > 0 ? seg.value / processedTotal : 0;
        // Subtract a small amount (2px) from the dash length to create the white separator effect
        const dashLength = Math.max(0, pct * circ - 2);
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
              transform: 'rotate(-90deg)', 
              transformOrigin: '70px 70px', 
              transition: 'stroke-dasharray 0.7s ease, stroke-dashoffset 0.7s ease' 
            }}
          />
        );
      })}
      <text x="70" y="65" textAnchor="middle" style={{ fontSize: 15, fontWeight: 800, fill: '#1a1a2e', fontFamily: 'Inter' }}>
        {processedTotal.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
      </text>
      <text x="70" y="83" textAnchor="middle" style={{ fontSize: 9, fontWeight: 700, fill: '#B0B8C9', fontFamily: 'Inter', textTransform: 'uppercase', letterSpacing: 1.5 }}>
        {centerLabel}
      </text>
    </svg>
  );
};

export default DonutChart;
