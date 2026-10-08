import React, { useState } from 'react';
import BottomModal from './BottomModal';
import { useDashboard } from '../../contexts/DashboardContext';
import { useToast } from '../../contexts/ToastContext';
import { Users, Check, X } from 'lucide-react';

const ROLE_DESCRIPTIONS = {
  editor: 'en tant qu\'éditeur : vous pourrez consulter et modifier ce budget.',
  viewer: 'en tant que lecteur : vous pourrez consulter ce budget sans le modifier.',
};

/**
 * Invitations reçues par l'utilisateur connecté.
 * S'ouvre seule à la connexion s'il y en a, et depuis le sélecteur de budgets ensuite.
 * Rien n'est partagé tant que l'invitation n'est pas acceptée.
 */
const InvitationsModal = () => {
  const { myInvitations, invitationsOpen, closeInvitations, acceptInvitation, declineInvitation } = useDashboard();
  const { showToast } = useToast();
  const [busyId, setBusyId] = useState(null);

  const respond = async (invitation, accept) => {
    setBusyId(invitation.id);
    try {
      if (accept) {
        await acceptInvitation(invitation.id);
        showToast(`Vous avez rejoint « ${invitation.dashboard_name} »`, { type: 'success' });
      } else {
        await declineInvitation(invitation.id);
        showToast('Invitation refusée');
      }
      // Dernière invitation traitée : on referme
      if (myInvitations.length <= 1) closeInvitations();
    } catch (error) {
      showToast(error.message, { type: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <BottomModal isOpen={invitationsOpen && myInvitations.length > 0} onClose={closeInvitations} title="Invitations reçues">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {myInvitations.map(invitation => (
          <div key={invitation.id} style={{ background: 'white', padding: 20, borderRadius: 16, border: '1px solid #E8ECFF', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#A0D2EB22', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A0D2EB', flexShrink: 0 }}>
                <Users size={20} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 16, fontWeight: 800, color: '#4A6984', margin: 0 }}>{invitation.dashboard_name}</p>
                <p style={{ fontSize: 13, color: '#8892A4', fontWeight: 500, lineHeight: 1.5, margin: '4px 0 0' }}>
                  <strong style={{ color: '#4A6984' }}>{invitation.invited_by_name}</strong> vous invite à rejoindre ce budget {ROLE_DESCRIPTIONS[invitation.role] || ROLE_DESCRIPTIONS.viewer}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => respond(invitation, true)}
                disabled={busyId !== null}
                style={{ flex: 1, padding: '12px', borderRadius: 12, background: 'linear-gradient(135deg, #81BAD8 0%, #CE9C4A 100%)', color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <Check size={16} /> Accepter
              </button>
              <button
                onClick={() => respond(invitation, false)}
                disabled={busyId !== null}
                style={{ flex: 1, padding: '12px', borderRadius: 12, background: '#F3F4F6', color: '#6B7280', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <X size={16} /> Refuser
              </button>
            </div>
          </div>
        ))}
      </div>
    </BottomModal>
  );
};

export default InvitationsModal;
