import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuthContext } from './AuthContext';

const DashboardContext = createContext();

export const DashboardProvider = ({ children }) => {
  const { user, loading: authLoading } = useAuthContext();
  const [dashboards, setDashboards] = useState([]);
  const [activeDashboard, setActiveDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fonction centrale de récupération
  const fetchDashboards = useCallback(async () => {
    if (!user) {
      setDashboards([]);
      setActiveDashboard(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('dashboards')
        .select('*, members:dashboard_members(*)')
        .order('created_at', { ascending: true });

      if (error) throw error;

      setDashboards(data || []);
      
      // Gestion du dashboard actif
      const savedId = localStorage.getItem(`activeDashboard_${user.id}`);
      const found = data?.find(d => d.id === savedId) || data?.[0];
      setActiveDashboard(found || null);

    } catch (err) {
      console.error('[DashboardContext] Error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Synchronisation avec l'Auth
  useEffect(() => {
    if (!authLoading) {
      fetchDashboards();
    }
  }, [authLoading, user?.id, fetchDashboards]);

  const switchDashboard = useCallback((dashboard) => {
    setActiveDashboard(dashboard);
    if (user) localStorage.setItem(`activeDashboard_${user.id}`, dashboard.id);
  }, [user?.id]);

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

  const addMemberByEmail = useCallback(async (dashboardId, email) => {
    const { data: profile } = await supabase.from('profiles').select('id').eq('email', email.toLowerCase()).single();
    if (!profile) throw new Error('Utilisateur non trouvé.');
    
    const { error } = await supabase.from('dashboard_members').insert([
      { dashboard_id: dashboardId, user_id: profile.id, role: 'editor' }
    ]);
    if (error) throw (error.code === '23505' ? new Error('Déjà membre.') : error);
    await fetchDashboards();
  }, [fetchDashboards]);

  const removeMember = useCallback(async (dashboardId, userId) => {
    await supabase.from('dashboard_members').delete().eq('dashboard_id', dashboardId).eq('user_id', userId);
    await fetchDashboards();
  }, [fetchDashboards]);

  const value = useMemo(() => ({
    dashboards,
    activeDashboard,
    loading,
    switchDashboard,
    createDashboard,
    addMemberByEmail,
    removeMember,
    refreshDashboards: fetchDashboards
  }), [dashboards, activeDashboard, loading, switchDashboard, createDashboard, addMemberByEmail, removeMember, fetchDashboards]);

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
};

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) throw new Error('useDashboard must be used within a DashboardProvider');
  return context;
};
