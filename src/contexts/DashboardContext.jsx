import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuthContext } from './AuthContext';

const DashboardContext = createContext();

export const DashboardProvider = ({ children }) => {
  const { user, loading: authLoading } = useAuthContext();
  const [dashboards, setDashboards] = useState([]);
  const [activeDashboard, setActiveDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchingRef = React.useRef(false);

  const fetchDashboards = useCallback(async (retries = 3) => {
    if (authLoading || fetchingRef.current) return;
    if (!user) {
      console.log('[DashboardContext] No user found, skipping fetch');
      setLoading(false);
      return;
    }
    
    fetchingRef.current = true;
    console.log('[DashboardContext] Fetching dashboards for user:', user.id, `(Attempts left: ${retries})`);
    setLoading(true);

    try {
      // Attendre un peu que la session se stabilise totalement
      await new Promise(resolve => setTimeout(resolve, 200));

      const { data, error } = await supabase
        .from('dashboards')
        .select(`
          *,
          members:dashboard_members(*)
        `)
        .order('created_at', { ascending: true });

      if (error) {
        if (retries > 0 && error.message?.includes('Lock')) {
          console.warn('[DashboardContext] Lock conflict, retrying...', error.message);
          fetchingRef.current = false;
          // Réessayer avec un délai plus long
          await new Promise(resolve => setTimeout(resolve, 500));
          return fetchDashboards(retries - 1);
        }
        console.error('[DashboardContext] Error fetching dashboards:', error);
      } else {
        console.log('[DashboardContext] Dashboards found:', data?.length || 0, data);
        setDashboards(data || []);
        
        const savedId = localStorage.getItem(`activeDashboard_${user.id}`);
        const found = data?.find(d => d.id === savedId) || data?.[0];
        
        if (found) {
          console.log('[DashboardContext] Setting active dashboard:', found.name, found.id);
          setActiveDashboard(found);
        } else {
          console.log('[DashboardContext] No active dashboard found');
          setActiveDashboard(null);
        }
      }
    } catch (e) {
      console.error('[DashboardContext] Unexpected error:', e);
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    if (!authLoading) {
      if (user) {
        fetchDashboards();
      } else {
        console.log('[DashboardContext] Resetting state (no user)');
        setDashboards([]);
        setActiveDashboard(null);
        setLoading(false);
      }
    }
  }, [user, authLoading, fetchDashboards]);

  const switchDashboard = (dashboard) => {
    console.log('[DashboardContext] Switching to dashboard:', dashboard.name, dashboard.id);
    setActiveDashboard(dashboard);
    if (user) {
      localStorage.setItem(`activeDashboard_${user.id}`, dashboard.id);
    }
  };

  const createDashboard = async (name) => {
    if (!user) return;

    const { data: newDash, error: dashError } = await supabase
      .from('dashboards')
      .insert([{ name, owner_id: user.id }])
      .select()
      .single();

    if (dashError) throw dashError;

    const { error: memberError } = await supabase
      .from('dashboard_members')
      .insert([{ dashboard_id: newDash.id, user_id: user.id, role: 'owner' }]);

    if (memberError) throw memberError;

    await fetchDashboards();
    switchDashboard(newDash);
    return newDash;
  };

  const addMemberByEmail = async (dashboardId, email) => {
    // 1. Trouver l'utilisateur par son email
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (profileError || !profile) {
      throw new Error('Utilisateur non trouvé avec cet email.');
    }

    // 2. L'ajouter au dashboard
    const { error: memberError } = await supabase
      .from('dashboard_members')
      .insert([{ dashboard_id: dashboardId, user_id: profile.id, role: 'editor' }]);

    if (memberError) {
      if (memberError.code === '23505') throw new Error('Cet utilisateur est déjà membre.');
      throw memberError;
    }

    await fetchDashboards();
  };

  const removeMember = async (dashboardId, userId) => {
    const { error } = await supabase
      .from('dashboard_members')
      .delete()
      .eq('dashboard_id', dashboardId)
      .eq('user_id', userId);

    if (error) throw error;
    await fetchDashboards();
  };

  const value = {
    dashboards,
    activeDashboard,
    loading,
    switchDashboard,
    createDashboard,
    addMemberByEmail,
    removeMember,
    refreshDashboards: fetchDashboards
  };

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
};

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
};
