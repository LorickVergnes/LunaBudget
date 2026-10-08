import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Mail } from 'lucide-react';
import { getAuthRedirectUrl } from '../../lib/authLink';
import { translateAuthError } from '../../lib/authErrors';
import { AuthShell, AuthLink, AuthError, AuthField, AuthSubmit, AuthNotice } from '../../components/auth/AuthUI';

// Première étape du mot de passe oublié : demander le lien de réinitialisation par email
const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: getAuthRedirectUrl() });

    setLoading(false);
    if (error) setError(translateAuthError(error));
    else setSent(true);
  };

  // Même message qu'un compte existe ou non : on ne révèle pas quels emails sont inscrits
  if (sent) {
    return (
      <AuthNotice title="Vérifiez vos emails !">
        Si un compte existe pour <strong style={{color: '#4A6984'}}>{email}</strong>, un lien pour choisir un nouveau mot de passe vient d'être envoyé.<br/><br/>
        Pensez à regarder dans vos courriers indésirables.
      </AuthNotice>
    );
  }

  return (
    <AuthShell icon={Mail} title="Mot de passe oublié" subtitle="Recevez un lien pour en choisir un nouveau"
      footer={<AuthLink to="/login">Retour à la connexion</AuthLink>}>
      <AuthError>{error}</AuthError>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <AuthField label="Email" icon={Mail} type="email" required placeholder="votre@email.com"
          value={email} onChange={e => setEmail(e.target.value)} />
        <AuthSubmit loading={loading}>Envoyer le lien</AuthSubmit>
      </form>
    </AuthShell>
  );
};

export default ForgotPassword;
