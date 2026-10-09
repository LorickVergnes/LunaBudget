import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { useDashboard } from '../contexts/DashboardContext';
import { useMonth } from '../contexts/MonthContext';
import { formatMonthDate } from '../lib/dateUtils';
import { recurrenceService } from '../services/recurrenceService';

// Clés du cache : tout ce qui est affiché pour un dashboard est rangé sous ['dashboard', id, ...]
const dataKey = (dashboardId) => ['dashboard', dashboardId];
const recurrenceKey = (dashboardId) => ['recurrence', dashboardId];

/**
 * Données d'une page pour le dashboard actif, gardées en cache.
 *
 * - `name` et `params` identifient les données (ex. 'incomes' + le mois). Changer de mois ou de page
 *   puis revenir affiche tout de suite ce qui est en cache, et le remet à jour en arrière-plan.
 * - `fetcher(dashboardId, { applyRecurrence })` fait les requêtes et RETOURNE les données.
 *   `applyRecurrence(date)` copie les éléments récurrents vers ce mois ; l'appel à la base n'est
 *   fait qu'une fois par mois tant que rien n'a changé dans les mois précédents.
 *
 * Retourne `data` (undefined tant que rien n'est chargé), `loading` (vrai seulement au tout premier
 * chargement : un rechargement ne masque pas l'écran) et `refresh` à appeler après une modification.
 */
export function useDashboardQuery(name, params, fetcher) {
  const { user } = useAuth();
  const { activeDashboard, loading: dashLoading } = useDashboard();
  const { selectedDate } = useMonth();
  const queryClient = useQueryClient();
  const dashboardId = activeDashboard?.id;
  const viewedMonth = formatMonthDate(selectedDate);

  const query = useQuery({
    queryKey: [...dataKey(dashboardId), name, ...params],
    enabled: Boolean(user && dashboardId),
    queryFn: () => fetcher(dashboardId, {
      applyRecurrence: (date) => {
        const month = formatMonthDate(date);
        return queryClient.fetchQuery({
          queryKey: [...recurrenceKey(dashboardId), month],
          queryFn: async () => { await recurrenceService.checkAndApplyRecurrence(dashboardId, date); return true; },
          staleTime: Infinity,
        });
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

  return {
    data: query.data,
    // Sans dashboard actif, on attend seulement que la liste des dashboards soit chargée
    loading: dashboardId ? query.isPending : dashLoading,
    refresh,
    dashboardId,
  };
}
