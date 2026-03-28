import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Loader2, ArrowRight, CheckCircle2 } from 'lucide-react';

const Signup = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
      // Optionnel: Rediriger après quelques secondes
      setTimeout(() => navigate('/login'), 5000);
    }
  };

  if (success) {
    return (
      <div style={{ minHeight: '100vh', background: '#EEF2FB', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 20px' }}>
        <div className="card" style={{ width: '100%', maxWidth: 440, padding: 32, textAlign: 'center' }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#22c55e15', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <CheckCircle2 size={40} color="#22c55e" />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#1a1a2e', marginBottom: 16 }}>Vérifiez vos emails !</h1>
          <p style={{ fontSize: 14, color: '#555', fontWeight: 500, lineHeight: 1.6, marginBottom: 28 }}>
            Nous avons envoyé un lien de confirmation à <strong style={{color: '#1a1a2e'}}>{email}</strong>.<br/><br/>
            Veuillez confirmer votre compte pour commencer à gérer votre budget.
          </p>
          <Link to="/login" style={{ color: '#5C6EFF', fontWeight: 700, textDecoration: 'none', background: '#5C6EFF15', padding: '12px 24px', borderRadius: 99, display: 'inline-block' }}>
            Retourner à la connexion
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#EEF2FB', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 20px' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: 'linear-gradient(135deg,#5C6EFF,#9B5CFF)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', boxShadow: '0 8px 24px rgba(92,110,255,.35)' }}>
            <User size={30} color="white" />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#1a1a2e', marginBottom: 6 }}>Créer un compte</h1>
          <p style={{ fontSize: 14, color: '#B0B8C9', fontWeight: 500 }}>Commencez à épargner intelligemment</p>
        </div>

        {/* Form card */}
        <div className="card" style={{ padding: 24 }}>
          {error && (
            <div style={{ background: '#FFF0F0', border: '1px solid #FFCDD2', borderRadius: 10, padding: '12px 14px', marginBottom: 16, fontSize: 13, fontWeight: 600, color: '#ef4444' }}>
              {error}
            </div>
          )}
          <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#B0B8C9', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Nom complet</label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#B0B8C9' }} />
                <input type="text" required placeholder="Jean Dupont" className="field" style={{ paddingLeft: 42 }}
                  value={fullName} onChange={e => setFullName(e.target.value)} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#B0B8C9', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#B0B8C9' }} />
                <input type="email" required placeholder="votre@email.com" className="field" style={{ paddingLeft: 42 }}
                  value={email} onChange={e => setEmail(e.target.value)} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#B0B8C9', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Mot de passe</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#B0B8C9' }} />
                <input type="password" required minLength={6} placeholder="••••••••" className="field" style={{ paddingLeft: 42 }}
                  value={password} onChange={e => setPassword(e.target.value)} />
              </div>
            </div>
            <button type="submit" disabled={loading}
              style={{ background: 'linear-gradient(135deg,#5C6EFF,#9B5CFF)', color: 'white', border: 'none', borderRadius: 14, padding: '15px', fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 6px 20px rgba(92,110,255,.4)', marginTop: 4 }}>
              {loading ? <Loader2 size={20} className="animate-spin-smooth" /> : <><span>S'inscrire</span><ArrowRight size={18} /></>}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: 14, color: '#B0B8C9', fontWeight: 500, marginTop: 20 }}>
          Déjà un compte ?{' '}
          <Link to="/login" style={{ color: '#5C6EFF', fontWeight: 700, textDecoration: 'none' }}>Se connecter</Link>
        </p>
      </div>
    </div>
  );
};

export default Signup;
