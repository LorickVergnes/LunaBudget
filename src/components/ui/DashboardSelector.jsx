import React, { useState } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { useAuthContext } from '../../contexts/AuthContext';
import { ChevronDown, Plus, Users, Layout, X, UserPlus, Trash2 } from 'lucide-react';
import BottomModal from './BottomModal';

const DashboardSelector = ({ isDesktop = false }) => {
  const { user } = useAuthContext();
  const { dashboards, activeDashboard, switchDashboard, createDashboard, addMemberByEmail, removeMember } = useDashboard();
  const [isOpen, setIsOpen] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInvite] = useState(false);

  const handleCreate = async () => {
    const name = prompt('Nom du nouveau tableau de bord :');
    if (name) {
      try {
        await createDashboard(name);
        setIsOpen(false);
      } catch (error) {
        alert('Erreur lors de la création : ' + error.message);
      }
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setIsInvite(true);
    try {
      await addMemberByEmail(activeDashboard.id, inviteEmail);
      setInviteEmail('');
      alert('Utilisateur ajouté avec succès !');
    } catch (error) {
      alert(error.message);
    } finally {
      setIsInvite(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (window.confirm('Retirer ce membre du tableau de bord ?')) {
      try {
        await removeMember(activeDashboard.id, userId);
      } catch (error) {
        alert(error.message);
      }
    }
  };

  if (!activeDashboard) return null;

  const isOwner = activeDashboard.owner_id === user?.id;

  return (
    <div style={{ position: 'relative' }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: isDesktop ? '#F3F4F6' : 'transparent',
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
          color: '#4A6984',
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
            position: 'absolute',
            top: '110%',
            left: isDesktop ? 0 : 'auto',
            right: isDesktop ? 'auto' : 0,
            background: 'white',
            borderRadius: 12,
            boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
            padding: 8,
            minWidth: 220,
            zIndex: 1000,
            border: '1px solid #E8ECFF'
          }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#B0B8C9', padding: '4px 8px', textTransform: 'uppercase' }}>Tes Tableaux</p>
            {dashboards.map(dash => (
              <div key={dash.id} style={{ display: 'flex', alignItems: 'center' }}>
                <button
                  onClick={() => { switchDashboard(dash); setIsOpen(false); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    flex: 1,
                    padding: '8px 12px',
                    border: 'none',
                    background: activeDashboard.id === dash.id ? '#A0D2EB10' : 'transparent',
                    borderRadius: 8,
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: activeDashboard.id === dash.id ? '#A0D2EB' : '#D1D5DB' }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: activeDashboard.id === dash.id ? '#A0D2EB' : '#4B5563' }}>{dash.name}</span>
                  {dash.owner_id !== user?.id && <Users size={12} style={{ color: '#B0B8C9', marginLeft: 'auto' }} />}
                </button>
                {activeDashboard.id === dash.id && isOwner && (
                    <button 
                        onClick={() => { setShowManageModal(true); setIsOpen(false); }}
                        style={{ background: 'none', border: 'none', padding: '8px', cursor: 'pointer', color: '#B0B8C9' }}
                        title="Gérer les membres"
                    >
                        <Users size={16} />
                    </button>
                )}
              </div>
            ))}
            <div style={{ height: 1, background: '#F5F7FF', margin: '8px 0' }} />
            <button
              onClick={handleCreate}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '8px 12px',
                border: 'none',
                background: 'transparent',
                borderRadius: 8,
                cursor: 'pointer',
                textAlign: 'left',
                color: '#A0D2EB'
              }}
            >
              <Plus size={16} />
              <span style={{ fontSize: 14, fontWeight: 700 }}>Nouveau tableau</span>
            </button>
          </div>
        </>
      )}

      {/* Modale de gestion des membres */}
      <BottomModal 
        isOpen={showManageModal} 
        onClose={() => setShowManageModal(false)}
        title={`Membres de "${activeDashboard.name}"`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Liste des membres */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {activeDashboard.members?.map(member => (
                    <div key={member.user_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px', background: '#F9FAFB', borderRadius: 12 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#E5BA73,#A0D2EB)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white' }}>
                            {member.profile?.full_name?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 14, fontWeight: 700, color: '#4A6984', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {member.profile?.full_name || 'Utilisateur inconnu'}
                                {member.user_id === user?.id && <span style={{ color: '#B0B8C9', fontWeight: 500, fontSize: 12 }}> (Toi)</span>}
                            </p>
                            <p style={{ fontSize: 11, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {member.role === 'owner' ? 'Propriétaire' : 'Éditeur'} • {member.profile?.email}
                            </p>
                        </div>
                        {member.role !== 'owner' && isOwner && (
                            <button 
                                onClick={() => handleRemoveMember(member.user_id)}
                                style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: 4 }}
                            >
                                <Trash2 size={16} />
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {/* Formulaire d'invitation */}
            <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#4A6984' }}>Inviter par email</p>
                <div style={{ display: 'flex', gap: 8 }}>
                    <input 
                        type="email" 
                        required
                        placeholder="email@exemple.com"
                        value={inviteEmail}
                        onChange={e => setInviteEmail(e.target.value)}
                        style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1px solid #E5E7EB', outline: 'none', fontSize: 14 }}
                    />
                    <button 
                        type="submit"
                        disabled={isInviting}
                        style={{ background: '#A0D2EB', color: 'white', border: 'none', borderRadius: 12, padding: '0 16px', cursor: 'pointer' }}
                    >
                        {isInviting ? '...' : <UserPlus size={20} />}
                    </button>
                </div>
                <p style={{ fontSize: 11, color: '#B0B8C9' }}>L'utilisateur doit déjà avoir un compte LunaBudget.</p>
            </form>
        </div>
      </BottomModal>
    </div>
  );
};

export default DashboardSelector;
