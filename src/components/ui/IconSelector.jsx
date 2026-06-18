import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import BottomModal from './BottomModal';
import { ICON_REGISTRY, QUICK_ICONS, ALL_ICON_KEYS } from '../../lib/iconRegistry';

const IconSelector = ({ value, onChange, color = '#A0D2EB' }) => {
  const [showAll, setShowAll] = useState(false);

  const isSelectedInQuick = QUICK_ICONS.includes(value);

  // The 5 quick icons mapping. If selected is not in quick, we might want to just render it anyway, 
  // but keeping it simple: just 5 quick icons and the selected one will trigger active state if it happens to be 1 of the 5.
  // Actually, to make sure the user sees what they selected if it's NOT in quick picks, we replace the last visible one if needed:
  const displayIcons = [...QUICK_ICONS];
  if (!isSelectedInQuick && value && ICON_REGISTRY[value]) {
    displayIcons[4] = value;
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {(() => {
            const CurrentIcon = ICON_REGISTRY[value] || ICON_REGISTRY['Wallet'];
            return <CurrentIcon size={20} style={{ color }} />;
          })()}
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#4A6984', display: 'block', marginBottom: 2 }}>Apparence Icône</label>
          <span style={{ fontSize: 13, color: '#9CA3AF' }}>Cliquez pour choisir</span>
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, margin: '0 -4px' }}>
        {displayIcons.map(key => {
          const IconComp = ICON_REGISTRY[key];
          if (!IconComp) return null;
          return (
            <button key={key} type="button" onClick={() => onChange(key)}
              style={{ width: 44, height: 44, flexShrink: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: value === key ? `2px solid ${color}` : '2px solid transparent', background: 'transparent', cursor: 'pointer' }}>
              <IconComp size={20} style={{ color: value === key ? color : '#D1D5DB' }} />
            </button>
          );
        })}
        
        {/* Afficher Plus */}
        <button type="button" onClick={() => setShowAll(true)}
          style={{ width: 44, height: 44, flexShrink: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed #D1D5DB', background: 'transparent', cursor: 'pointer' }}>
          <Plus size={20} style={{ color: '#9CA3AF' }} />
        </button>
      </div>

      <BottomModal isOpen={showAll} onClose={() => setShowAll(false)} title="Choisir une icône">
         <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '10px 0', scrollbarWidth: 'none' }}>
           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))', gap: 16 }}>
             {ALL_ICON_KEYS.map(key => {
               const IconComp = ICON_REGISTRY[key];
               const isSelected = value === key;
               return (
                 <button key={key} type="button" onClick={() => { onChange(key); setShowAll(false); }}
                   style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: '8px', opacity: isSelected ? 1 : 0.8 }}
                   onMouseOver={e => e.currentTarget.style.opacity = 1}
                   onMouseOut={e => e.currentTarget.style.opacity = isSelected ? 1 : 0.8}
                 >
                   <div style={{ width: 48, height: 48, borderRadius: '50%', background: isSelected ? `${color}22` : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', border: isSelected ? `2px solid ${color}` : '2px solid transparent', transition: 'all 0.2s ease' }}>
                     <IconComp size={24} style={{ color: isSelected ? color : '#6B7280' }} />
                   </div>
                   <span style={{ fontSize: 10, color: isSelected ? '#4A6984' : '#9CA3AF', fontWeight: isSelected ? 700 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '60px', textAlign: 'center' }}>
                     {key}
                   </span>
                 </button>
               )
             })}
           </div>
         </div>
      </BottomModal>
    </>
  );
};

export default IconSelector;
