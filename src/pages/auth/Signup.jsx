import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User } from 'lucide-react';
import { AuthShell, AuthLink, AuthError, AuthField, AuthSubmit, AuthNotice } from '../../components/auth/AuthUI';

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
      <AuthNotice title="Vérifiez vos emails !">
        Nous avons envoyé un lien de confirmation à <strong style={{color: '#4A6984'}}>{email}</strong>.<br/><br/>
        Veuillez confirmer votre compte pour commencer à gérer votre budget.
      </AuthNotice>
    );
  }

  return (
    <AuthShell icon={User} title="Créer un compte" subtitle="Commencez à épargner intelligemment"
      footer={<>Déjà un compte ?{' '}<AuthLink to="/login">Se connecter</AuthLink></>}>
      <AuthError>{error}</AuthError>
      <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <AuthField label="Nom complet" icon={User} type="text" required placeholder="Jean Dupont"
          value={fullName} onChange={e => setFullName(e.target.value)} />
        <AuthField label="Email" icon={Mail} type="email" required placeholder="votre@email.com"
          value={email} onChange={e => setEmail(e.target.value)} />
        <AuthField label="Mot de passe" icon={Lock} type="password" required minLength={6} placeholder="••••••••"
          value={password} onChange={e => setPassword(e.target.value)} />
        <AuthSubmit loading={loading}>S'inscrire</AuthSubmit>
      </form>
    </AuthShell>
  );
};

export default Signup;
