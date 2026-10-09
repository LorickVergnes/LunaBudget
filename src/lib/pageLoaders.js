/**
 * Chargement des pages à la demande.
 *
 * Chaque page est un fichier JavaScript séparé, téléchargé seulement quand on l'affiche :
 * le premier écran n'attend plus le code de toute l'application.
 */
export const pageLoaders = {
  Dashboard: () => import('../pages/dashboard/Dashboard'),
  Incomes: () => import('../pages/dashboard/Incomes'),
  Expenses: () => import('../pages/dashboard/Expenses'),
  Envelopes: () => import('../pages/dashboard/Envelopes'),
  EnvelopeDetail: () => import('../pages/dashboard/EnvelopeDetail'),
  Savings: () => import('../pages/dashboard/Savings'),
  SavingDetail: () => import('../pages/dashboard/SavingDetail'),
  GlobalView: () => import('../pages/dashboard/GlobalView'),
  Account: () => import('../pages/dashboard/Account'),
  Login: () => import('../pages/auth/Login'),
  Signup: () => import('../pages/auth/Signup'),
  ForgotPassword: () => import('../pages/auth/ForgotPassword'),
  ResetPassword: () => import('../pages/auth/ResetPassword'),
};

let preloading = null;

// Télécharge toutes les pages d'un coup (le navigateur garde ensuite chaque fichier en mémoire)
export const preloadPages = () => {
  preloading ??= Promise.all(Object.values(pageLoaders).map(load => load()))
    .catch((error) => { preloading = null; throw error; });
  return preloading;
};

// Une fois le premier écran affiché, on télécharge les autres pages en arrière-plan,
// quand le navigateur n'a rien d'autre à faire : la navigation est alors immédiate.
export const preloadPagesWhenIdle = () => {
  // Un échec est sans gravité : la page concernée sera téléchargée au moment d'y aller
  const run = () => { preloadPages().catch(() => {}); };
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, { timeout: 4000 });
  else setTimeout(run, 2000);
};
