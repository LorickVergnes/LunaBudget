import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { LogOut, Menu, User } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardSelector from '../ui/DashboardSelector';

const TopBar = ({ title }) => {
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();
  
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Utilisateur';

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div style={{ 
      background: 'white', 
      paddingTop: 'calc(12px + var(--safe-top))',
      paddingBottom: '14px',
      paddingLeft: '20px',
      paddingRight: '20px',
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      position: 'relative',
      zIndex: 1000
    }}>
      
      {/* Profil de l'utilisateur (Gauche) */}
      <Link to="/account" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', flexShrink: 0, width: '30%' }}>
        <div style={{ 
          width: 36, height: 36, 
          minWidth: 36, minHeight: 36,
          borderRadius: '50%', 
          background: 'linear-gradient(135deg,#E5BA73,#A0D2EB)', 
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          aspectRatio: '1/1'
        }}>
          <span style={{ fontSize: 16, color: 'white', lineHeight: 0 }}>{displayName.charAt(0).toUpperCase()}</span>
        </div>
      </Link>

      {/* Titre de la catégorie & Sélecteur (Centre) */}
      <div style={{ flex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, width: '40%' }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: '#4A6984', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {title}
        </span>
        <DashboardSelector />
      </div>

      {/* Bouton Menu (Droite) */}
      <div style={{ width: '30%', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
        <button onClick={() => setMenuOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <Menu size={24} style={{ color: '#4A6984' }} />
        </button>

        {/* Bottom Sheet Menu */}
        {menuOpen && (
          <div 
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              zIndex: 9999,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.4)',
              backdropFilter: 'blur(3px)',
            }}
            onClick={() => setMenuOpen(false)}
            className="fade-in"
          >
            <div 
              style={{
                width: '100%',
                maxWidth: 480,
                background: 'white',
                borderTopLeftRadius: 32,
                borderTopRightRadius: 32,
                padding: '24px 20px 40px',
                boxShadow: '0 -8px 40px rgba(0,0,0,0.15)',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                transform: 'translateY(0)',
                animation: 'fadeUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginBottom: 8 }}>
                <div style={{ width: 40, height: 5, borderRadius: 10, background: '#E5E7EB' }} />
              </div>

              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#4A6984', textAlign: 'center', marginBottom: 8 }}>
                Menu
              </h2>

              <button 
                onClick={() => { setMenuOpen(false); navigate('/account'); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px',
                  background: '#F8FAFC', border: 'none', borderRadius: 16,
                  cursor: 'pointer', width: '100%', textAlign: 'left',
                  color: '#4A6984', fontWeight: 700, fontSize: 16,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                }}
              >
                <div style={{ background: '#A0D2EB1A', padding: 10, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <User size={22} style={{ color: '#A0D2EB' }} />
                </div>
                Mon Profil
              </button>
              
              <button 
                onClick={() => { setMenuOpen(false); signOut(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px',
                  background: '#FEF2F2', border: 'none', borderRadius: 16,
                  cursor: 'pointer', width: '100%', textAlign: 'left',
                  color: '#ef4444', fontWeight: 700, fontSize: 16,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                }}
              >
                <div style={{ background: 'white', padding: 10, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(239,68,68,0.1)' }}>
                  <LogOut size={22} style={{ color: '#ef4444' }} />
                </div>
                Déconnexion
              </button>
            </div>
          </div>
        )}
      </div>
      
    </div>
  );
};

export default TopBar;
