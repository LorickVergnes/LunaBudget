/**
 * Liens d'authentification reçus par email (réinitialisation du mot de passe).
 *
 * Après un clic sur le lien, Supabase renvoie vers l'application en ajoutant ses paramètres
 * dans l'URL : `#access_token=...&type=recovery` si tout va bien,
 * `#error=access_denied&error_code=otp_expired&...` si le lien est invalide ou expiré.
 */

// Lit les paramètres laissés par Supabase dans l'URL (fragment ou query string)
export const parseAuthLink = (hash = '', search = '') => {
  const params = new URLSearchParams(hash.replace(/^#\/?/, ''));
  new URLSearchParams(search).forEach((value, key) => {
    if (!params.has(key)) params.set(key, value);
  });

  const hasError = params.has('error') || params.has('error_code');
  return {
    isRecovery: !hasError && params.get('type') === 'recovery',
    hasError,
  };
};

let link = { isRecovery: false, hasError: false };

// L'URL est lue une seule fois, au chargement de la page :
// Supabase puis le routeur effacent ensuite ces paramètres.
export const readAuthLinkFromUrl = () => {
  link = typeof window === 'undefined'
    ? { isRecovery: false, hasError: false }
    : parseAuthLink(window.location.hash, window.location.search);
};
readAuthLinkFromUrl();

// L'utilisateur arrive-t-il par un lien « mot de passe oublié » valide ?
export const isRecoveryLink = () => link.isRecovery;

// L'utilisateur arrive-t-il par un lien invalide ou expiré ? (à signaler une seule fois)
export const hasAuthLinkError = () => link.hasError;
export const clearAuthLinkError = () => { link = { ...link, hasError: false }; };

// Adresse vers laquelle Supabase renvoie après le clic dans l'email.
// Elle doit figurer dans les « Redirect URLs » du projet Supabase.
export const getAuthRedirectUrl = () => `${window.location.origin}${import.meta.env.BASE_URL}`;
