// Messages d'erreur de Supabase Auth traduits pour l'utilisateur.
// Supabase renvoie un `code` stable et un `message` en anglais ; on reconnaît l'un ou l'autre.
const KNOWN_ERRORS = [
  // Volontairement vague : on ne dit pas si c'est l'email ou le mot de passe qui est faux
  { codes: ['invalid_credentials'], pattern: /invalid login credentials/i, message: 'Email ou mot de passe incorrect.' },
  { codes: ['email_not_confirmed'], pattern: /email not confirmed/i, message: "Votre adresse email n'est pas encore confirmée. Cliquez sur le lien reçu par email à l'inscription." },
  { codes: ['user_already_exists', 'email_exists'], pattern: /already registered|already exists/i, message: 'Un compte existe déjà avec cette adresse email.' },
  { codes: ['same_password'], pattern: /different from the old password/i, message: "Le nouveau mot de passe doit être différent de l'ancien." },
  { codes: ['weak_password'], pattern: /password should be|weak password/i, message: 'Ce mot de passe est trop faible. Choisissez-en un plus long.' },
  { codes: ['over_email_send_rate_limit', 'over_request_rate_limit'], pattern: /rate limit|only request this after/i, message: 'Trop de demandes. Patientez quelques minutes avant de réessayer.' },
  { codes: ['session_not_found', 'otp_expired'], pattern: /session missing|expired|invalid.*link/i, message: 'Ce lien est invalide ou a expiré. Demandez-en un nouveau.' },
  { codes: [], pattern: /failed to fetch|network/i, message: 'Connexion impossible. Vérifiez votre accès à Internet.' },
];

export const translateAuthError = (error) => {
  if (!error) return null;
  const known = KNOWN_ERRORS.find(({ codes, pattern }) =>
    codes.includes(error.code) || pattern.test(error.message || ''));
  return known ? known.message : (error.message || 'Une erreur est survenue. Réessayez.');
};
