import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuthContext } from './AuthContext';

const DashboardContext = createContext();

// Erreurs Postgres rencontrées en créant une invitation
const INVITATION_ERRORS = {
  23505: 'Une invitation est déjà en attente pour cette adresse.',
  23514: 'Cette adresse email n\'est pas valide.',
  42501: 'Vous ne pouvez pas inviter cette adresse.',
};

export const DashboardProvider = ({ children }) => {
  const { user, loading: authLoading } = useAuthContext();
  const [dashboards, setDashboards] = useState([]);
  const [activeDashboard, setActiveDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  // Invitations reçues par l'utilisateur connecté, en attente de sa réponse
  const [myInvitations, setMyInvitations] = useState([]);
  const [invitationsOpen, setInvitationsOpen] = useState(false);
  const userId = user?.id;

  const fetchMyInvitations = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_my_invitations');
    if (error) {
      console.error('[DashboardContext] Invitations:', error.message);
      return [];
    }
    setMyInvitations(data || []);
    return data || [];
  }, []);

  // Fonction centrale de récupération
  const fetchDashboards = useCallback(async () => {
    if (!userId) {
      setDashboards([]);
      setActiveDashboard(null);
      setMyInvitations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Les invitations envoyées ne sont visibles que du propriétaire (RLS) : la liste est vide pour les autres
      const { data, error } = await supabase
        .from('dashboards')
        .select(`
          *,
          members:dashboard_members(
            *,
            profile:profiles(full_name, email, avatar_url)
          ),
          invitations:dashboard_invitations(id, email, role, created_at)
        `)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setDashboards(data || []);

      // Gestion du dashboard actif
      const savedId = localStorage.getItem(`activeDashboard_${userId}`);
      const found = data?.find(d => d.id === savedId) || data?.[0];
      setActiveDashboard(found || null);

    } catch (err) {
      console.error('[DashboardContext] Error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Synchronisation avec l'Auth
  useEffect(() => {
    if (!authLoading) {
      fetchDashboards();
    }
  }, [authLoading, fetchDashboards]);

  // À la connexion : s'il y a des invitations en attente, on les propose tout de suite
  useEffect(() => {
    if (authLoading || !userId) return;
    fetchMyInvitations().then(pending => {
      if (pending.length > 0) setInvitationsOpen(true);
    });
  }, [authLoading, userId, fetchMyInvitations]);

  const switchDashboard = useCallback((dashboard) => {
    setActiveDashboard(dashboard);
    if (userId) localStorage.setItem(`activeDashboard_${userId}`, dashboard.id);
  }, [userId]);

  const createDashboard = useCallback(async (name) => {
    if (!user) return;
    const { data: newDash, error: dashError } = await supabase
      .from('dashboards').insert([{ name, owner_id: user.id }]).select().single();

    if (dashError) throw dashError;

    await supabase.from('dashboard_members').insert([
      { dashboard_id: newDash.id, user_id: user.id, role: 'owner' }
    ]);

    await fetchDashboards();
    switchDashboard(newDash);
    return newDash;
  }, [user, fetchDashboards, switchDashboard]);

  // ── Invitations envoyées (propriétaire) ──

  // Crée une invitation en attente. La réponse est la même que l'adresse ait un compte ou non.
  const inviteByEmail = useCallback(async (dashboardId, email, role) => {
    const { error } = await supabase.from('dashboard_invitations').insert([
      { dashboard_id: dashboardId, email: email.trim().toLowerCase(), role, invited_by: userId }
    ]);

    if (error) throw new Error(INVITATION_ERRORS[error.code] || error.message);
    await fetchDashboards();
  }, [userId, fetchDashboards]);

  const cancelInvitation = useCallback(async (invitationId) => {
    const { error } = await supabase.from('dashboard_invitations').delete().eq('id', invitationId);
    if (error) throw error;
    await fetchDashboards();
  }, [fetchDashboards]);

  // ── Invitations reçues ──

  const acceptInvitation = useCallback(async (invitationId) => {
    const { data: dashboardId, error } = await supabase.rpc('accept_invitation', { invitation_id: invitationId });
    if (error) throw error;
    // On ouvre directement le dashboard rejoint
    if (userId && dashboardId) localStorage.setItem(`activeDashboard_${userId}`, dashboardId);
    await Promise.all([fetchDashboards(), fetchMyInvitations()]);
  }, [userId, fetchDashboards, fetchMyInvitations]);

  const declineInvitation = useCallback(async (invitationId) => {
    const { error } = await supabase.rpc('decline_invitation', { invitation_id: invitationId });
    if (error) throw error;
    await fetchMyInvitations();
  }, [fetchMyInvitations]);

  // ── Membres ──

  const updateMemberRole = useCallback(async (dashboardId, memberId, role) => {
    const { error } = await supabase.from('dashboard_members')
      .update({ role }).eq('dashboard_id', dashboardId).eq('user_id', memberId);
    if (error) throw error;
    await fetchDashboards();
  }, [fetchDashboards]);

  const removeMember = useCallback(async (dashboardId, memberId) => {
    const { error } = await supabase.from('dashboard_members')
      .delete().eq('dashboard_id', dashboardId).eq('user_id', memberId);
    if (error) throw error;
    await fetchDashboards();
  }, [fetchDashboards]);

  // Quitter un dashboard dont on n'est pas propriétaire
  const leaveDashboard = useCallback(async (dashboardId) => {
    const { error } = await supabase.from('dashboard_members')
      .delete().eq('dashboard_id', dashboardId).eq('user_id', userId);
    if (error) throw error;
    localStorage.removeItem(`activeDashboard_${userId}`);
    await fetchDashboards();
  }, [userId, fetchDashboards]);

  const updateDashboard = useCallback(async (dashboardId, updates) => {
    const { error } = await supabase
      .from('dashboards')
      .update(updates)
      .eq('id', dashboardId);

    if (error) throw error;
    await fetchDashboards();
  }, [fetchDashboards]);

  const deleteDashboard = useCallback(async (dashboardId) => {
    const { error } = await supabase
      .from('dashboards')
      .delete()
      .eq('id', dashboardId);

    if (error) throw error;

    if (activeDashboard?.id === dashboardId) {
      setActiveDashboard(null);
      localStorage.removeItem(`activeDashboard_${user?.id}`);
    }

    await fetchDashboards();
  }, [activeDashboard, user?.id, fetchDashboards]);

  // Rôle de l'utilisateur sur le dashboard actif : 'owner', 'editor' ou 'viewer'.
  // Ces indicateurs ne servent qu'à adapter l'interface ; les droits réels sont appliqués par la base (RLS).
  const myRole = activeDashboard?.members?.find(member => member.user_id === userId)?.role ?? null;
  const isOwner = Boolean(activeDashboard) && activeDashboard.owner_id === userId;
  const canEdit = myRole === 'owner' || myRole === 'editor';

  const value = useMemo(() => ({
    dashboards,
    activeDashboard,
    loading,
    myRole,
    isOwner,
    canEdit,
    switchDashboard,
    createDashboard,
    updateDashboard,
    deleteDashboard,
    inviteByEmail,
    cancelInvitation,
    myInvitations,
    invitationsOpen,
    openInvitations: () => setInvitationsOpen(true),
    closeInvitations: () => setInvitationsOpen(false),
    acceptInvitation,
    declineInvitation,
    updateMemberRole,
    removeMember,
    leaveDashboard,
    refreshDashboards: fetchDashboards
  }), [dashboards, activeDashboard, loading, myRole, isOwner, canEdit, switchDashboard, createDashboard, updateDashboard, deleteDashboard, inviteByEmail, cancelInvitation, myInvitations, invitationsOpen, acceptInvitation, declineInvitation, updateMemberRole, removeMember, leaveDashboard, fetchDashboards]);

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
};

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) throw new Error('useDashboard must be used within a DashboardProvider');
  return context;
};
