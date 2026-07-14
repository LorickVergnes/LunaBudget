import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../contexts/ToastContext';
import BottomNav from '../../components/layout/BottomNav';
import TopBar from '../../components/layout/TopBar';
import DesktopHeader from '../../components/layout/DesktopHeader';
import DesktopSidebar from '../../components/layout/DesktopSidebar';
import useDesktop from '../../hooks/useDesktop';
import { Loader2, CheckCircle2 } from 'lucide-react';

const Account = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const [fullName, setFullName] = useState(profile?.full_name || user?.user_metadata?.full_name || '');
  const [loading, setLoading] = useState(false);
  const isDesktop = useDesktop();

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);

    // 1. Mettre à jour les métadonnées Auth
    const { error: authError } = await supabase.auth.updateUser({
      data: { full_name: fullName }
    });

    if (authError) {
      showToast(authError.message, { type: 'error' });
      setLoading(false);
      return;
    }

    // 2. Mettre à jour la table profiles
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ full_name: fullName, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (profileError) {
      showToast(profileError.message, { type: 'error' });
    } else {
      showToast('Profil mis à jour avec succès', { type: 'success' });
      await refreshProfile(); // Rafraîchir le contexte global
    }
    setLoading(false);
  };

  const formContent = (
    <>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: '#4A6984', marginBottom: 20 }}>Informations du compte</h2>

      <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#B0B8C9', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Adresse Email
          </label>
          <input 
            type="email" 
            value={user?.email || ''} 
            disabled 
            style={{ 
              width: '100%', padding: '12px 16px', borderRadius: '12px', 
              border: '1px solid #E8ECFF', background: '#F5F7FF', 
              color: '#9CA3AF', fontSize: 15, fontWeight: 500, outline: 'none'
            }} 
          />
          <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>L'adresse email ne peut pas être modifiée ici.</p>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#B0B8C9', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Plan actuel
          </label>
          <div style={{ 
            padding: '12px 16px', borderRadius: '12px', border: '1px solid #E8ECFF', 
            background: profile?.role === 'premium' ? 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)' : '#F8FAFC', 
            color: profile?.role === 'premium' ? 'white' : '#64748B', 
            fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8
          }}>
            {profile?.role === 'premium' ? '💎 Membre Premium' : '🌱 Compte Gratuit'}
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#B0B8C9', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Nom complet
          </label>
          <input 
            type="text" 
            value={fullName} 
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Votre nom"
            required
            style={{ 
              width: '100%', padding: '12px 16px', borderRadius: '12px', 
              border: '1px solid #E8ECFF', background: 'white', 
              color: '#4A6984', fontSize: 15, fontWeight: 600, outline: 'none'
            }} 
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          style={{ 
            background: '#A0D2EB', color: 'white', border: 'none', borderRadius: '14px', 
            padding: '14px', fontSize: 15, fontWeight: 800, cursor: 'pointer', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, 
            boxShadow: '0 4px 14px rgba(160,210,235,0.4)', marginTop: 12
          }}
        >
          {loading ? <Loader2 size={18} className="animate-spin-smooth" /> : 'Mettre à jour'}
        </button>
      </form>
    </>
  );

  if (isDesktop) {
    return (
      <div className="desktop-shell fade-in">
        <DesktopHeader />
        <div className="desktop-body">
          <DesktopSidebar />
          <main className="desktop-main">
            <div className="desktop-greeting-toprow">
              <div className="desktop-greeting">
                <h1>Mon Profil 👤</h1>
                <p>Gérez vos informations personnelles.</p>
              </div>
            </div>

            <div className="desktop-budget-card" style={{ maxWidth: 600 }}>
              {formContent}
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ minHeight: '100vh', background: 'transparent', paddingBottom: 76 }}>
      <TopBar title="Mon Profil" />

      <div style={{ padding: '20px 16px', maxWidth: 480, margin: '0 auto' }}>
        <div className="card fade-up" style={{ padding: '24px 20px', marginTop: 16 }}>
          {formContent}
        </div>
      </div>
      
      <BottomNav />
    </div>
  );
};

export default Account;
