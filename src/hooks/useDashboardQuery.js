import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { useDashboard } from '../contexts/DashboardContext';
import { useMonth } from '../contexts/MonthContext';
import { useToast } from '../contexts/ToastContext';
import { formatMonthDate } from '../lib/dateUtils';
import { recurrenceService } from '../services/recurrenceService';

// Clés du cache : tout ce qui est affiché pour un dashboard est rangé sous ['dashboard', id, ...]
const dataKey = (dashboardId) => ['dashboard', dashboardId];
const recurrenceKey = (dashboardId) => ['recurrence', dashboardId];
// Mois ("dashboard:mois") dont l'échec de récurrence a déjà été signalé : un seul message, pas un par rechargement
const recurrenceWarnings = new Set();

/**
 * Données d'une page pour le dashboard actif, gardées en cache.
 *
 * - `name` et `params` identifient les données (ex. 'incomes' + le mois). Changer de mois ou de page
 *   puis revenir affiche tout de suite ce qui est en cache, et le remet à jour en arrière-plan.
 * - `fetcher(dashboardId, { applyRecurrence })` fait les requêtes et RETOURNE les données.
 *   `applyRecurrence(date)` copie les éléments récurrents vers ce mois ; l'appel à la base n'est
 *   fait qu'une fois par mois tant que rien n'a changé dans les mois précédents.
 *
 * Retourne :
 * - `data` : undefined tant que rien n'est chargé ;
 * - `loading` : vrai au tout premier chargement (un rechargement ne masque pas l'écran) ;
 * - `error` : le chargement a échoué et il n'y a rien à afficher. La page doit le montrer
 *   (composant LoadError) : sans cela, une panne réseau ressemble à un budget vide ;
 * - `retry` : relance le chargement après une erreur ;
 * - `refresh` : à appeler après une modification.
 */
export function useDashboardQuery(name, params, fetcher) {
  const { user } = useAuth();
  const { activeDashboard, loading: dashLoading, error: dashError, refreshDashboards } = useDashboard();
  const { selectedDate } = useMonth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const dashboardId = activeDashboard?.id;
  const viewedMonth = formatMonthDate(selectedDate);

  const query = useQuery({
    queryKey: [...dataKey(dashboardId), name, ...params],
    enabled: Boolean(user && dashboardId),
    queryFn: () => fetcher(dashboardId, {
      applyRecurrence: async (date) => {
        const month = formatMonthDate(date);
        const warningKey = `${dashboardId}:${month}`;
        try {
          // Seule une copie réussie est gardée en cache : un échec sera retenté au prochain chargement
          await queryClient.fetchQuery({
            queryKey: [...recurrenceKey(dashboardId), month],
            queryFn: async () => { await recurrenceService.checkAndApplyRecurrence(dashboardId, date); return true; },
            staleTime: Infinity,
          });
          recurrenceWarnings.delete(warningKey);
          return true;
        } catch (error) {
          // Le reste de la page se charge quand même, mais l'utilisateur sait que le mois peut être incomplet
          console.error('[Récurrence]', error?.message || error);
          if (!recurrenceWarnings.has(warningKey)) {
            recurrenceWarnings.add(warningKey);
            showToast("Les éléments récurrents n'ont pas pu être reportés sur ce mois : il peut être incomplet.", { type: 'warning', duration: 6000 });
          }
          return false;
        }
      },
    }),
  });

  // Après une modification : les données du dashboard sont rechargées (celles à l'écran tout de suite,
  // les autres à leur prochain affichage), et la récurrence des mois suivants sera recalculée.
  const refresh = useCallback(() => {
    if (!dashboardId) return Promise.resolve();
    queryClient.removeQueries({
      queryKey: recurrenceKey(dashboardId),
      predicate: (cached) => cached.queryKey[2] > viewedMonth,
    });
    return queryClient.invalidateQueries({ queryKey: dataKey(dashboardId) });
  }, [queryClient, dashboardId, viewedMonth]);

  // Échec sans rien en cache à afficher. Si des données sont déjà à l'écran, on les garde.
  const failed = query.isError && query.data === undefined;
  const { refetch } = query;
  const retry = useCallback(
    () => (dashboardId ? refetch() : refreshDashboards()),
    [dashboardId, refetch, refreshDashboards]
  );

  if (!dashboardId) {
    // Sans dashboard actif, tout dépend du chargement de la liste des dashboards
    return { data: undefined, loading: dashLoading, error: dashLoading ? null : dashError, retry, refresh, dashboardId };
  }

  return {
    data: query.data,
    // Une nouvelle tentative après une erreur réaffiche le chargement
    loading: query.isPending || (failed && query.isFetching),
    error: failed && !query.isFetching ? query.error : null,
    retry,
    refresh,
    dashboardId,
  };
}
