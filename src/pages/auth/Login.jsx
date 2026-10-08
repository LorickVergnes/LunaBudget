import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, BarChart2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { hasAuthLinkError, clearAuthLinkError } from '../../lib/authLink';
import { translateAuthError } from '../../lib/authErrors';
import { AuthShell, AuthLink, AuthError, AuthField, AuthSubmit } from '../../components/auth/AuthUI';

const Login = () => {
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  // Arrivée par un lien d'email invalide ou expiré : on l'explique une fois
  const [error, setError] = useState(() => (
    hasAuthLinkError() ? 'Ce lien est invalide ou a expiré. Utilisez « Mot de passe oublié » pour en recevoir un nouveau.' : null
  ));
  const navigate = useNavigate();

  useEffect(() => { clearAuthLinkError(); }, []);

  // STABILISATION : Si déjà connecté, on redirige vers le dashboard
  useEffect(() => {
    if (!authLoading && user) {
      navigate('/');
    }
  }, [user, authLoading, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault(); setLoading(true); setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(translateAuthError(error)); setLoading(false); }
    else navigate('/');
  };

  return (
    <AuthShell icon={BarChart2} title="Content de vous revoir" subtitle="Connectez-vous à votre budget"
      footer={<>Pas encore de compte ?{' '}<AuthLink to="/signup">S'inscrire</AuthLink></>}>
      <AuthError>{error}</AuthError>
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <AuthField label="Email" icon={Mail} type="email" required placeholder="votre@email.com"
          value={email} onChange={e => setEmail(e.target.value)} />
        <AuthField label="Mot de passe" icon={Lock} type="password" required placeholder="••••••••"
          value={password} onChange={e => setPassword(e.target.value)} />
        <div style={{ textAlign: 'right', marginTop: -6 }}>
          <Link to="/forgot-password" style={{ fontSize: 13, color: '#A0D2EB', fontWeight: 700, textDecoration: 'none' }}>Mot de passe oublié ?</Link>
        </div>
        <AuthSubmit loading={loading}>Se connecter</AuthSubmit>
      </form>
    </AuthShell>
  );
};
export default Login;
