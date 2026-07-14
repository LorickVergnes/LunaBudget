import React, { useState } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { useAuthContext } from '../../contexts/AuthContext';
import { ChevronDown, Plus, Users, Layout, Settings } from 'lucide-react';
import DashboardSettingsModal from './DashboardSettingsModal';
import CreateDashboardModal from './CreateDashboardModal';

const DashboardSelector = ({ isDesktop = false }) => {
  const { user } = useAuthContext();
  const { dashboards, activeDashboard, switchDashboard } = useDashboard();
  const [isOpen, setIsOpen] = useState(false);
  
  // Modals state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  if (!activeDashboard) return null;

  return (
    <div style={{ position: 'relative' }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: isDesktop ? 'var(--bg-white)' : 'transparent',
          border: 'none',
          padding: isDesktop ? '8px 12px' : '4px',
          borderRadius: 10,
          cursor: 'pointer',
          maxWidth: isDesktop ? 200 : 150
        }}
      >
        <Layout size={18} style={{ color: '#A0D2EB' }} />
        <span style={{ 
          fontSize: 14, 
          fontWeight: 700, 
          color: 'var(--text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {activeDashboard.name}
        </span>
        <ChevronDown size={16} style={{ color: '#B0B8C9' }} />
      </button>

      {isOpen && (
        <>
          <div 
            onClick={() => setIsOpen(false)}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}
          />
          <div style={{
            position: isDesktop ? 'absolute' : 'fixed',
            top: isDesktop ? '110%' : '84px',
            left: isDesktop ? 0 : '16px',
            right: isDesktop ? 'auto' : '16px',
            background: 'var(--bg-white)',
            borderRadius: 16,
            boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
            padding: 8,
            minWidth: isDesktop ? 240 : 'auto',
            zIndex: 1000,
            border: '1px solid #E8ECFF'
          }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: '#B0B8C9', padding: '4px 8px 8px', textTransform: 'uppercase' }}>Vos Budgets</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {dashboards.map(dash => (
                <div key={dash.id} style={{ display: 'flex', alignItems: 'center' }}>
                  <button
                    onClick={() => { switchDashboard(dash); setIsOpen(false); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      flex: 1,
                      padding: '10px 12px',
                      border: 'none',
                      background: activeDashboard.id === dash.id ? '#A0D2EB15' : 'transparent',
                      borderRadius: 12,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.2s'
                    }}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: activeDashboard.id === dash.id ? '#A0D2EB' : '#D1D5DB' }} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: activeDashboard.id === dash.id ? '#A0D2EB' : 'inherit' }}>{dash.name}</span>
                    {dash.owner_id !== user?.id && <Users size={14} style={{ color: '#B0B8C9', marginLeft: 'auto' }} />}
                  </button>
                  {activeDashboard.id === dash.id && (
                      <button 
                          onClick={() => { setShowSettingsModal(true); setIsOpen(false); }}
                          style={{ background: '#F8FAFC', border: '1px solid #E8ECFF', borderRadius: 10, padding: '8px', cursor: 'pointer', color: '#4A6984', marginLeft: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Paramètres"
                      >
                          <Settings size={16} />
                      </button>
                  )}
                </div>
              ))}
            </div>
            
            <div style={{ height: 1, background: '#F5F7FF', margin: '8px 0' }} />
            
            <button
              onClick={() => { setShowCreateModal(true); setIsOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                padding: '10px 12px',
                border: 'none',
                background: '#A0D2EB15',
                borderRadius: 12,
                cursor: 'pointer',
                textAlign: 'left',
                color: '#A0D2EB'
              }}
            >
              <div style={{ background: 'white', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Plus size={14} strokeWidth={3} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 800 }}>Nouveau budget</span>
            </button>
          </div>
        </>
      )}

      {/* Nouveaux modales de gestion */}
      <DashboardSettingsModal 
        isOpen={showSettingsModal} 
        onClose={() => setShowSettingsModal(false)} 
      />
      
      <CreateDashboardModal 
        isOpen={showCreateModal} 
        onClose={() => setShowCreateModal(false)} 
      />
    </div>
  );
};

export default DashboardSelector;
