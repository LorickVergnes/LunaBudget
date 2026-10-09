import { QueryClient } from '@tanstack/react-query';

// Cache des données de l'application.
// Une donnée en cache est affichée immédiatement, puis rechargée en arrière-plan si elle a plus de
// 10 secondes : assez court pour rester à jour, assez long pour éviter les rechargements en rafale.
export const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      gcTime: 5 * 60_000,
      retry: 1,
    },
  },
});
