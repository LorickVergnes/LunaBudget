import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { User, LogOut, ChevronRight, ChevronLeft } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const DesktopSidebar = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { signOut } = useAuth();

  const itemStyle = {
    width: isExpanded ? '100%' : '44px',
    padding: isExpanded ? '8px 12px' : '0',
    gap: isExpanded ? '12px' : '0',
    justifyContent: isExpanded ? 'flex-start' : 'center',
  };

  return (
    <>
      {/* Overlay */}
      {isExpanded && (
        <div 
          style={{
            position: 'fixed',
            top: 66,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            zIndex: 150,
            backdropFilter: 'blur(2px)',
            transition: 'opacity 0.3s ease'
          }}
          onClick={() => setIsExpanded(false)}
        />
      )}

      {/* Sidebar overlay */}
      <aside 
        className="desktop-sidebar" 
        style={{ 
          width: isExpanded ? 240 : 72, 
          transition: 'width 0.3s ease',
          alignItems: isExpanded ? 'stretch' : 'center',
          padding: '20px 14px',
          position: 'fixed',
          left: 0,
          zIndex: 151,
          boxShadow: isExpanded ? '4px 0 15px rgba(0,0,0,0.08)' : 'none',
          overflow: 'hidden'
        }}
      >
        <div className="desktop-sidebar-items" style={{ alignItems: isExpanded ? 'stretch' : 'center' }}>
          
          {/* Toggle Expand */}
          <div 
            className="desktop-sidebar-item" 
            onClick={() => setIsExpanded(!isExpanded)} 
            style={{ marginBottom: 16, ...itemStyle }}
          >
            <div className="desktop-sidebar-icon-wrap">
              {isExpanded ? <ChevronLeft size={22} style={{ color: '#B0B8C9' }} /> : <ChevronRight size={22} style={{ color: '#B0B8C9' }} />}
            </div>
            {isExpanded && <span style={{ fontWeight: 700, fontSize: 14 }}>Réduire</span>}
          </div>

          {/* Profile */}
          <NavLink 
            to="/account" 
            onClick={() => setIsExpanded(false)}
            className={({ isActive }) => isActive ? 'desktop-sidebar-item desktop-sidebar-item--active' : 'desktop-sidebar-item'}
            style={itemStyle}
          >
            {({ isActive }) => (
              <>
                <div className="desktop-sidebar-icon-wrap">
                  <User size={22} strokeWidth={isActive ? 2.5 : 1.8} style={{ color: isActive ? '#A0D2EB' : '#B0B8C9', transition: 'all 0.2s' }} />
                </div>
                {isExpanded && <span style={{ fontWeight: 700, fontSize: 14, color: isActive ? '#A0D2EB' : '#4A6984', whiteSpace: 'nowrap' }}>Mon Profil</span>}
              </>
            )}
          </NavLink>
          
        </div>

        {/* Logout */}
        <button 
          className="desktop-sidebar-item desktop-sidebar-settings" 
          onClick={() => signOut()}
          style={itemStyle}
        >
          <div className="desktop-sidebar-icon-wrap">
            <LogOut size={22} strokeWidth={1.8} style={{ color: '#ef4444', transition: 'all 0.2s' }} />
          </div>
          {isExpanded && <span style={{ fontWeight: 700, fontSize: 14, color: '#ef4444', whiteSpace: 'nowrap' }}>Déconnexion</span>}
        </button>
      </aside>

      {/* Spacer */}
      <div style={{ width: 72, flexShrink: 0 }} />
    </>
  );
};

export default DesktopSidebar;
