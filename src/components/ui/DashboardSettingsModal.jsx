import React, { useState } from 'react';
import BottomModal from './BottomModal';
import { useDashboard } from '../../contexts/DashboardContext';
import { useAuthContext } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Trash2, UserPlus, Shield, Settings, Users, AlertTriangle, Mail, LogOut, X } from 'lucide-react';

const ROLE_LABELS = { owner: 'Propriétaire', editor: 'Éditeur', viewer: 'Lecteur' };

const roleSelectStyle = { padding: '8px 10px', borderRadius: 10, border: '1px solid #E5E7EB', background: 'white', fontSize: 13, fontWeight: 700, color: '#4A6984', cursor: 'pointer', outline: 'none' };
const iconButtonStyle = { background: '#FEF2F2', border: '1px solid #FECACA', color: '#EF4444', borderRadius: 10, padding: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };

// Choix du rôle d'un invité ou d'un membre
const RoleSelect = ({ value, onChange, label }) => (
  <select value={value} onChange={e => onChange(e.target.value)} aria-label={label} style={roleSelectStyle}>
    <option value="editor">Éditeur</option>
    <option value="viewer">Lecteur</option>
  </select>
);

const DashboardSettingsModal = ({ isOpen, onClose }) => {
  const { user } = useAuthContext();
  const {
    activeDashboard, updateDashboard, deleteDashboard,
    inviteByEmail, cancelInvitation, updateMemberRole, removeMember, leaveDashboard,
  } = useDashboard();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('general'); // 'general' | 'members'

  // Edit Name
  const [name, setName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Invite
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [isInviting, setIsInviting] = useState(false);

  // Initialiser le nom à l'ouverture
  React.useEffect(() => {
    if (isOpen && activeDashboard) {
      setName(activeDashboard.name);
    }
  }, [isOpen, activeDashboard]);

  if (!activeDashboard) return null;
  const isOwner = activeDashboard.owner_id === user?.id;
  const members = activeDashboard.members || [];
  const invitations = activeDashboard.invitations || [];

  // Lance une action et affiche son résultat
  const run = async (action, successMessage) => {
    try {
      await action();
      if (successMessage) showToast(successMessage);
      return true;
    } catch (error) {
      showToast(error.message, { type: 'error' });
      return false;
    }
  };

  const handleUpdateName = async (e) => {
    e.preventDefault();
    if (!name.trim() || name === activeDashboard.name) return;
    setIsUpdating(true);
    await run(() => updateDashboard(activeDashboard.id, { name }), 'Nom mis à jour avec succès !');
    setIsUpdating(false);
  };

  const handleDelete = async () => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer définitivement le tableau de bord "${activeDashboard.name}" ? Toutes les données seront perdues.`)) {
      if (await run(() => deleteDashboard(activeDashboard.id))) onClose();
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    // Les membres actuels sont déjà visibles du propriétaire : ce contrôle ne révèle rien
    if (members.some(member => member.profile?.email?.toLowerCase() === email)) {
      showToast('Cette personne est déjà membre de ce tableau de bord.', { type: 'error' });
      return;
    }
    setIsInviting(true);
    const sent = await run(
      () => inviteByEmail(activeDashboard.id, email, inviteRole),
      'Invitation enregistrée. Elle apparaîtra à cette personne dès sa connexion à LunaBudget.'
    );
    if (sent) setInviteEmail('');
    setIsInviting(false);
  };

  const handleRemoveMember = (memberId) => {
    if (window.confirm('Retirer ce membre du tableau de bord ?')) {
      run(() => removeMember(activeDashboard.id, memberId), 'Membre retiré.');
    }
  };

  const handleLeave = async () => {
    if (window.confirm(`Quitter le tableau de bord "${activeDashboard.name}" ? Vous n'y aurez plus accès.`)) {
      if (await run(() => leaveDashboard(activeDashboard.id), 'Vous avez quitté ce tableau de bord.')) onClose();
    }
  };

  const tabStyle = (active) => ({
    flex: 1,
    padding: '12px',
    textAlign: 'center',
    background: active ? '#A0D2EB' : 'transparent',
    color: active ? 'white' : '#B0B8C9',
    borderRadius: 12,
    fontWeight: 700,
    fontSize: 14,
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  });

  return (
    <BottomModal isOpen={isOpen} onClose={onClose} title="Paramètres du Budget">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minHeight: 300 }}>

        {/* Tabs */}
        <div style={{ display: 'flex', background: 'var(--bg-white)', padding: 4, borderRadius: 16, border: '1px solid #E8ECFF' }}>
          <button onClick={() => setActiveTab('general')} style={tabStyle(activeTab === 'general')}>
            <Settings size={18} /> Général
          </button>
          <button onClick={() => setActiveTab('members')} style={tabStyle(activeTab === 'members')}>
            <Users size={18} /> Membres
          </button>
        </div>

        {/* Tab: Général */}
        {activeTab === 'general' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }} className="fade-in">
            <form onSubmit={handleUpdateName} style={{ background: 'var(--bg-white)', padding: 20, borderRadius: 16, border: '1px solid #E8ECFF' }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#4A6984', display: 'block', marginBottom: 12 }}>
                Nom du tableau de bord
              </label>
              <div style={{ display: 'flex', gap: 12 }}>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  disabled={!isOwner}
                  style={{ flex: 1, padding: '12px 16px', borderRadius: 12, border: '1px solid #E5E7EB', background: 'transparent', outline: 'none', fontSize: 15, color: 'inherit' }}
                />
                {isOwner && (
                  <button
                    type="submit"
                    disabled={isUpdating || name === activeDashboard.name}
                    style={{ background: '#A0D2EB', color: 'white', border: 'none', borderRadius: 12, padding: '0 20px', fontWeight: 700, cursor: 'pointer', opacity: name === activeDashboard.name ? 0.5 : 1 }}
                  >
                    Sauver
                  </button>
                )}
              </div>
              {!isOwner && <p style={{ fontSize: 12, color: '#B0B8C9', marginTop: 8 }}>Seul le propriétaire peut modifier le nom.</p>}
            </form>

            {isOwner && (
              <div style={{ background: '#FEF2F2', padding: 20, borderRadius: 16, border: '1px solid #FECACA', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#EF4444' }}>
                  <AlertTriangle size={20} />
                  <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>Zone Dangereuse</h3>
                </div>
                <p style={{ fontSize: 13, color: '#991B1B', margin: 0 }}>
                  La suppression est définitive et effacera tous les revenus, dépenses, et membres associés.
                </p>
                <button
                  onClick={handleDelete}
                  style={{ background: '#EF4444', color: 'white', border: 'none', borderRadius: 12, padding: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 4 }}
                >
                  <Trash2 size={18} />
                  Supprimer ce tableau
                </button>
              </div>
            )}

            {/* Un membre invité peut quitter le tableau de bord */}
            {!isOwner && (
              <button
                onClick={handleLeave}
                style={{ background: '#FEF2F2', color: '#EF4444', border: '1px solid #FECACA', borderRadius: 12, padding: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}
              >
                <LogOut size={18} />
                Quitter ce tableau de bord
              </button>
            )}
          </div>
        )}

        {/* Tab: Membres */}
        {activeTab === 'members' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }} className="fade-in">
            {isOwner && (
              <form onSubmit={handleInvite} style={{ background: 'var(--bg-white)', padding: 20, borderRadius: 16, border: '1px solid #E8ECFF', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#4A6984', margin: 0 }}>Inviter un membre</p>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <input
                    type="email"
                    required
                    placeholder="email@exemple.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    style={{ flex: '1 1 180px', minWidth: 0, padding: '12px 16px', borderRadius: 12, border: '1px solid #E5E7EB', background: 'transparent', outline: 'none', fontSize: 14, color: 'inherit' }}
                  />
                  <RoleSelect value={inviteRole} onChange={setInviteRole} label="Rôle de l'invité" />
                  <button
                    type="submit"
                    disabled={isInviting}
                    title="Envoyer l'invitation"
                    style={{ background: '#E5BA73', color: 'white', border: 'none', borderRadius: 12, padding: '0 16px', minHeight: 44, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {isInviting ? '...' : <UserPlus size={20} />}
                  </button>
                </div>
                <p style={{ fontSize: 12, color: '#B0B8C9', margin: 0 }}>
                  La personne verra l'invitation en se connectant à LunaBudget avec cette adresse, et pourra l'accepter ou la refuser. Un <strong>lecteur</strong> consulte le budget sans pouvoir le modifier.
                </p>
              </form>
            )}

            {/* Invitations envoyées, en attente de réponse (visibles du propriétaire uniquement) */}
            {isOwner && invitations.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#4A6984', margin: '0 0 4px 4px' }}>Invitations en attente ({invitations.length})</h3>
                {invitations.map(invitation => (
                  <div key={invitation.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px', background: 'var(--bg-white)', borderRadius: 16, border: '1px dashed #E8ECFF' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#F5F7FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B0B8C9', flexShrink: 0 }}>
                      <Mail size={18} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#4A6984', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{invitation.email}</p>
                      <p style={{ fontSize: 12, color: '#8892A4', margin: '2px 0 0' }}>{ROLE_LABELS[invitation.role]} • en attente de réponse</p>
                    </div>
                    <button
                      onClick={() => run(() => cancelInvitation(invitation.id), 'Invitation annulée.')}
                      style={iconButtonStyle}
                      title="Annuler l'invitation"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#4A6984', margin: '0 0 4px 4px' }}>Membres ({members.length})</h3>
              {members.map(member => (
                <div key={member.user_id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px', background: 'var(--bg-white)', borderRadius: 16, border: '1px solid #E8ECFF' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#A0D2EB,#E5BA73)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: 'white', flexShrink: 0 }}>
                    {member.profile?.full_name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 15, fontWeight: 800, color: '#4A6984', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {member.profile?.full_name || 'Utilisateur inconnu'}
                      {member.user_id === user?.id && <span style={{ background: '#F3F4F6', color: '#6B7280', padding: '2px 6px', borderRadius: 6, fontSize: 10, fontWeight: 800 }}>Vous</span>}
                    </p>
                    <p style={{ fontSize: 12, color: '#8892A4', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {member.role === 'owner' ? <Shield size={12} color="#E5BA73" /> : null}
                      {ROLE_LABELS[member.role] || ROLE_LABELS.editor} • {member.profile?.email}
                    </p>
                  </div>
                  {member.role !== 'owner' && isOwner && (
                    <>
                      <RoleSelect
                        value={member.role}
                        label={`Rôle de ${member.profile?.full_name || 'ce membre'}`}
                        onChange={(role) => run(() => updateMemberRole(activeDashboard.id, member.user_id, role), 'Rôle mis à jour.')}
                      />
                      <button
                        onClick={() => handleRemoveMember(member.user_id)}
                        style={iconButtonStyle}
                        title="Retirer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </BottomModal>
  );
};

export default DashboardSettingsModal;
