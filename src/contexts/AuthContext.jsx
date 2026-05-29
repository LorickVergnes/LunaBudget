import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fonction pour récupérer le profil (réutilisable)
  const fetchProfile = async (userId) => {
    if (!userId) return setProfile(null);
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) setProfile(data);
  };

  useEffect(() => {
    // 1. Récupération de la session initiale
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) fetchProfile(currentUser.id);
      setLoading(false);
    });

    // 2. Écoute des changements (Login, Logout, Token Refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null;
      
      // On ne met à jour que si l'identité change
      if (currentUser?.id !== user?.id) {
        setUser(currentUser);
        if (currentUser) {
          fetchProfile(currentUser.id);
        } else {
          setProfile(null);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [user?.id]); // Dépendance sur l'id pour la comparaison

  const value = useMemo(() => ({
    user,
    profile,
    loading,
    signOut: () => supabase.auth.signOut(),
    refreshProfile: () => user && fetchProfile(user.id)
  }), [user, profile, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuthContext must be used within an AuthProvider');
  return context;
};
