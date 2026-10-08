import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Lock } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../contexts/ToastContext';
import { translateAuthError } from '../../lib/authErrors';
import { AuthShell, AuthError, AuthField, AuthSubmit } from '../../components/auth/AuthUI';

const MIN_LENGTH = 6;

/**
 * Seconde étape du mot de passe oublié : choisir un nouveau mot de passe.
 * Affichée à la place de l'application quand l'utilisateur arrive par le lien reçu par email
 * (ce lien l'a connecté le temps de changer son mot de passe).
 * Le routeur n'est pas encore monté à ce moment-là : pas de <Link> ni de useNavigate ici.
 */
const ResetPassword = () => {
  const { user, endPasswordRecovery } = useAuth();
  const { showToast } = useToast();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // On fixe l'adresse avant de rendre la main à l'application : le routeur démarre alors
  // directement sur la bonne page, au lieu de lire les restes du lien reçu par email.
  const leaveTo = (path) => {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${path}`);
    endPasswordRecovery();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_LENGTH) {
      setError(`Le mot de passe doit contenir au moins ${MIN_LENGTH} caractères.`);
      return;
    }
    if (password !== confirmation) {
      setError('Les deux mots de passe ne sont pas identiques.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(translateAuthError(error));
      return;
    }
    showToast('Mot de passe mis à jour', { type: 'success' });
    leaveTo('/');
  };

  // Le lien n'a pas ouvert de session : il est invalide ou a déjà servi
  if (!user) {
    return (
      <AuthShell icon={Lock} title="Lien expiré" subtitle="Ce lien est invalide ou a déjà été utilisé">
        <form onSubmit={(e) => { e.preventDefault(); leaveTo('/forgot-password'); }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: 14, color: '#555', fontWeight: 500, lineHeight: 1.6 }}>
            Pour des raisons de sécurité, un lien de réinitialisation ne fonctionne qu'une fois et pendant une durée limitée.
          </p>
          <AuthSubmit loading={false}>Demander un nouveau lien</AuthSubmit>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell icon={Lock} title="Nouveau mot de passe" subtitle={`Pour le compte ${user.email}`}>
      <AuthError>{error}</AuthError>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <AuthField label="Nouveau mot de passe" icon={Lock} type="password" required minLength={MIN_LENGTH} autoComplete="new-password" placeholder="••••••••"
          value={password} onChange={e => setPassword(e.target.value)} />
        <AuthField label="Confirmer le mot de passe" icon={Lock} type="password" required minLength={MIN_LENGTH} autoComplete="new-password" placeholder="••••••••"
          value={confirmation} onChange={e => setConfirmation(e.target.value)} />
        <AuthSubmit loading={loading}>Enregistrer</AuthSubmit>
      </form>
    </AuthShell>
  );
};

export default ResetPassword;
