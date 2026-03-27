export const ALL_COLORS = [
  '#5C6EFF', // Bleu
  '#22c55e', // Vert
  '#F9A825', // Orange
  '#ef4444', // Rouge
  '#9B5CFF', // Violet
  '#06b6d4', // Cyan
  '#f43f5e', // Rose
  '#ec4899', // Rose clair
  '#d946ef', // Fuchsia
  '#8b5cf6', // Violet clair
  '#3b82f6', // Bleu-500
  '#0ea5e9', // Sky
  '#10b981', // Emerald
  '#84cc16', // Lime
  '#eab308', // Yellow
  '#f97316', // Orange-500
  '#6366f1', // Indigo
  '#475569'  // Ardoise
];

/**
 * Groups segments into "Other" if they exceed the limit.
 */
export function groupSegments(segments, limit = 10) {
  if (segments.length <= limit + 1) return segments;

  const sorted = [...segments].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, limit);
  const others = sorted.slice(limit);
  
  const othersValue = others.reduce((sum, s) => sum + s.value, 0);
  
  return [
    ...top,
    {
      name: 'Autres',
      value: othersValue,
      color: '#94a3b8', // Slate-400 (Gris)
      isOther: true
    }
  ];
}
