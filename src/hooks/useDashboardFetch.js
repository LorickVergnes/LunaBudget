import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useDashboard } from '../contexts/DashboardContext';

/**
 * Charge les données d'une page pour le dashboard actif.
 *
 * `load(dashboardId)` fait les requêtes et range le résultat dans l'état de la page.
 * Il doit être stable (useCallback) : il est relancé à chaque fois qu'il change
 * (changement de mois, par exemple) ou que le dashboard actif change.
 *
 * Retourne `loading`, `setLoading` (pour les formulaires) et `refresh` pour recharger.
 */
export function useDashboardFetch(load) {
  const { user } = useAuth();
  const { activeDashboard, loading: dashLoading } = useDashboard();
  const dashboardId = activeDashboard?.id;
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!dashboardId) return;
    setLoading(true);
    try {
      await load(dashboardId);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [dashboardId, load]);

  useEffect(() => {
    if (user) {
      if (activeDashboard) {
        refresh();
      } else if (!dashLoading) {
        setLoading(false);
      }
    }
  }, [user, activeDashboard, dashLoading, refresh]);

  return { loading, setLoading, refresh, dashboardId };
}
