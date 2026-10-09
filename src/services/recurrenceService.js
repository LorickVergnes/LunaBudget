import { supabase } from '../lib/supabaseClient';
import { formatMonthDate } from '../lib/dateUtils';
import { markRecurrenceRun } from '../lib/ownChanges';

// Paramètres communs aux fonctions SQL qui écrivent les valeurs d'une règle.
// `rule` : { name, amount, day, icon, color, interval, end } (end = 'AAAA-MM-01' ou null)
const ruleParams = (rule) => ({
  rule_name: rule.name,
  rule_amount: rule.amount,
  rule_day: rule.day,
  rule_icon: rule.icon ?? null,
  rule_color: rule.color ?? null,
  rule_interval: rule.interval,
  last_month: rule.end ?? null,
});

/**
 * Récurrence des revenus, dépenses fixes et enveloppes.
 *
 * Chaque récurrence est une règle en base (table recurrences) ; les lignes de chaque mois sont créées
 * par la base à l'ouverture du mois. Toutes les écritures passent par des fonctions SQL, qui modifient
 * la règle et ses lignes ensemble. Les fonctions ci-dessous renvoient `{ data, error }` comme Supabase,
 * sauf checkAndApplyRecurrence qui lève l'erreur.
 */
export const recurrenceService = {
  /**
   * Crée les lignes récurrentes manquantes jusqu'à ce mois (fonction SQL apply_recurrence).
   * Un échec est renvoyé à l'appelant : il ne doit pas passer pour une création réussie.
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
  },

  /**
   * Nouvelle règle à partir de `month`. La base crée aussitôt les lignes des mois déjà commencés.
   * `existingRowId` : ligne ordinaire de ce mois qui devient la première occurrence de la règle.
   */
  create(dashboardId, kind, month, rule, existingRowId = null) {
    return supabase.rpc('create_recurrence', {
      dash_id: dashboardId,
      rule_kind: kind,
      first_month: month,
      existing_row: existingRowId,
      ...ruleParams(rule),
    });
  },

  // « Ce mois et les suivants » : nouvelles valeurs de la règle à partir de `month`
  updateFrom(recurrenceId, month, rule) {
    return supabase.rpc('update_recurrence_from', {
      rule_id: recurrenceId,
      from_month: month,
      ...ruleParams(rule),
    });
  },

  // Arrête la règle à partir de `month` : ses lignes de ce mois et des suivants sont supprimées
  stop(recurrenceId, month) {
    return supabase.rpc('stop_recurrence', { rule_id: recurrenceId, from_month: month });
  },
};
