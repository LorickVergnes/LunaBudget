import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import BottomNav from '../../components/layout/BottomNav';
import TopBar from '../../components/layout/TopBar';
import { Loader2, CheckCircle2 } from 'lucide-react';

const Account = () => {
  const { user } = useAuth();
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || '');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: '', type: '' });

    const { error } = await supabase.auth.updateUser({
      data: { full_name: fullName }
    });

    if (error) {
      setMessage({ text: error.message, type: 'error' });
    } else {
      setMessage({ text: 'Profil mis à jour avec succès.', type: 'success' });
    }
    setLoading(false);
  };

  return (
    <div className="fade-in" style={{ minHeight: '100vh', background: '#EEF2FB', paddingBottom: 76 }}>
      <TopBar title="Mon Profil" />

      <div style={{ padding: '20px 16px', maxWidth: 480, margin: '0 auto' }}>
        <div className="card fade-up" style={{ padding: '24px 20px', marginTop: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1a1a2e', marginBottom: 20 }}>Informations du compte</h2>
          
          {message.text && (
            <div style={{ 
              padding: '12px', 
              borderRadius: '8px', 
              marginBottom: '20px',
              backgroundColor: message.type === 'error' ? '#fee2e2' : '#dcfce7',
              color: message.type === 'error' ? '#991b1b' : '#166534',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              {message.type === 'success' && <CheckCircle2 size={16} />}
              {message.text}
            </div>
          )}

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
                  color: '#1a1a2e', fontSize: 15, fontWeight: 600, outline: 'none'
                }} 
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              style={{ 
                background: '#5C6EFF', color: 'white', border: 'none', borderRadius: '14px', 
                padding: '14px', fontSize: 15, fontWeight: 800, cursor: 'pointer', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, 
                boxShadow: '0 4px 14px rgba(92,110,255,0.4)', marginTop: 12
              }}
            >
              {loading ? <Loader2 size={18} className="animate-spin-smooth" /> : 'Mettre à jour'}
            </button>
          </form>
        </div>
      </div>
      
      <BottomNav />
    </div>
  );
};

export default Account;
