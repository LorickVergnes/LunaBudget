import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    
    try {
      // Un petit délai peut aider la session Supabase à se stabiliser 
      // lors des changements d'état rapides (login/refresh)
      await new Promise(resolve => setTimeout(resolve, 50));

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        // Si c'est juste un problème de lock temporaire, on peut logger sans tout casser
        console.warn('[AuthContext] Profile fetch warning:', error.message);
        return;
      }
      setProfile(data);
    } catch (err) {
      console.error('[AuthContext] Profile fetch exception:', err);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Écouter les changements d'état d'auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AuthContext] Auth state change:', event, session?.user?.id);
      
      if (!mounted) return;

      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (currentUser) {
        // Ne pas appeler fetchProfile immédiatement si c'est l'initialisation
        // pour laisser la session se stabiliser
        await fetchProfile(currentUser.id);
      } else {
        setProfile(null);
      }
      
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = () => supabase.auth.signOut();

  const value = {
    user,
    profile,
    loading,
    signOut,
    refreshProfile: () => user && fetchProfile(user.id)
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};
