import { useAuthContext } from '../contexts/AuthContext';

/**
 * Hook utilitaire pour accéder au contexte d'authentification.
 * Centralise l'accès à l'utilisateur, au profil (incluant le rôle) et aux fonctions de déconnexion.
 */
export const useAuth = () => {
  return useAuthContext();
};
