import React from 'react';
import { getIconComponent } from '../../lib/iconRegistry';

/**
 * Pastille ronde colorée contenant une icône.
 * `icon` accepte un nom du registre ('Wallet') ou directement un composant lucide.
 */
const IconBubble = ({ icon, color, size = 42 }) => {
  const iconComponent = icon && typeof icon !== 'string' ? icon : getIconComponent(icon);
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {React.createElement(iconComponent, { size: size * 0.45, style: { color } })}
    </div>
  );
};

export default IconBubble;
