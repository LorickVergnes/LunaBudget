import { supabase } from '../lib/supabaseClient';
import { formatMonthDate } from '../lib/dateUtils';
import { markRecurrenceRun } from '../lib/ownChanges';

/**
 * Service pour gérer la récurrence des éléments (Revenus, Dépenses, Enveloppes, Épargne)
 */
export const recurrenceService = {
  /**
   * Applique les éléments récurrents du mois précédent vers le mois actuel.
   * La copie est faite par la fonction SQL apply_recurrence (une seule transaction côté base).
   * Un échec est renvoyé à l'appelant : il ne doit pas passer pour une copie réussie.
   */
  async checkAndApplyRecurrence(dashboardId, currentMonth) {
    if (!dashboardId) return;

    const month = formatMonthDate(currentMonth);
    markRecurrenceRun(dashboardId, month);

    const { error } = await supabase.rpc('apply_recurrence', {
      dash_id: dashboardId,
      for_month: month
    });

    if (error) throw error;
  }
};
