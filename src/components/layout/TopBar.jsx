import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';

const TopBar = ({ title }) => {
  const { user, signOut } = useAuth();
  
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Utilisateur';

  return (
    <div style={{ 
      background: 'white', 
      paddingTop: 'max(40px, env(safe-area-inset-top, 40px))',
      paddingBottom: '12px',
      paddingLeft: '20px',
      paddingRight: '20px',
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      position: 'relative' // Nécessaire pour centrer le titre de façon absolue si on le souhaite, mais flex fonctionne bien
    }}>
      
      {/* Profil de l'utilisateur (Gauche) */}
      <Link to="/account" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', flexShrink: 0, width: '30%' }}>
        <div style={{ 
          width: 36, height: 36, 
          borderRadius: '50%', 
          background: 'linear-gradient(135deg,#9B5CFF,#5C6EFF)', 
          display: 'flex', alignItems: 'center', justifyContent: 'center' 
        }}>
          <span style={{ fontSize: 16, color: 'white' }}>{displayName.charAt(0).toUpperCase()}</span>
        </div>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {displayName}
        </span>
      </Link>

      {/* Titre de la catégorie (Centre) */}
      <div style={{ flex: 1, textAlign: 'center', display: 'flex', justifyContent: 'center', width: '40%' }}>
        <span style={{ fontSize: 17, fontWeight: 800, color: '#1a1a2e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {title}
        </span>
      </div>

      {/* Bouton de déconnexion (Droite) */}
      <div style={{ width: '30%', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
        <button onClick={() => signOut()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <LogOut size={20} style={{ color: '#ef4444' }} />
        </button>
      </div>
      
    </div>
  );
};

export default TopBar;
