import { supabase } from '../lib/supabaseClient';
import { formatMonthDate } from '../lib/dateUtils';

/**
 * Service pour gérer la récurrence des éléments (Revenus, Dépenses, Enveloppes, Épargne)
 */
export const recurrenceService = {
  /**
   * Vérifie et applique les éléments récurrents du mois précédent vers le mois actuel
   */
  async checkAndApplyRecurrence(dashboardId, currentMonth) {
    if (!dashboardId) return;

    const prevMonth = new Date(currentMonth);
    prevMonth.setMonth(prevMonth.getMonth() - 1);

    const currentMonthStr = formatMonthDate(currentMonth);
    const prevMonthStr = formatMonthDate(prevMonth);

    const tables = ['incomes', 'expenses', 'envelopes', 'savings'];

    for (const table of tables) {
      await this.syncTableRecurrence(table, dashboardId, prevMonthStr, currentMonthStr);
    }
  },

  /**
   * Synchronise une table spécifique pour la récurrence avec journalisation
   */
  async syncTableRecurrence(table, dashboardId, prevMonthStr, currentMonthStr) {
    try {
      // 1. Récupérer les éléments récurrents du mois précédent
      const { data: recurrentItems, error: fetchError } = await supabase
        .from(table)
        .select('*')
        .eq('dashboard_id', dashboardId)
        .eq('month_date', prevMonthStr)
        .eq('is_recurrent', true);

      if (fetchError) throw fetchError;
      if (!recurrentItems || recurrentItems.length === 0) return;

      // 2. Récupérer les logs de synchronisation
      const { data: syncLogs, error: logError } = await supabase
        .from('recurrence_logs')
        .select('source_item_id')
        .eq('dashboard_id', dashboardId)
        .eq('table_name', table)
        .eq('target_month', currentMonthStr);

      if (logError) throw logError;
      const processedIds = new Set(syncLogs?.map(log => log.source_item_id));

      // 3. Filtrer les éléments à cloner
      const itemsToClone = [];
      const logsToCreate = [];

      for (const item of recurrentItems) {
        if (processedIds.has(item.id)) continue;
        if (item.max_month && currentMonthStr > item.max_month) continue;

        // Préparation du clone
        const { id, created_at, month_date, is_hidden, ...rest } = item;
        let newItem = { ...rest, month_date: currentMonthStr, is_hidden: false };

        if (table === 'expenses' || table === 'incomes') {
          const prevDate = new Date(item.date);
          const nextDate = new Date(currentMonthStr);
          nextDate.setDate(Math.min(prevDate.getDate(), new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate()));
          newItem.date = nextDate.toISOString().split('T')[0];
        }

        itemsToClone.push(newItem);
        
        logsToCreate.push({
          user_id: item.user_id, // On garde l'auteur original
          dashboard_id: dashboardId,
          table_name: table,
          source_item_id: item.id,
          target_month: currentMonthStr
        });
      }

      // 4. Insertion massive
      if (itemsToClone.length > 0) {
        const { error: insertError } = await supabase.from(table).insert(itemsToClone);
        if (insertError) throw insertError;

        const { error: insertLogError } = await supabase
          .from('recurrence_logs')
          .upsert(logsToCreate, { 
            onConflict: 'user_id,table_name,source_item_id,target_month' 
          });
        
        if (insertLogError && insertLogError.code !== '23505') throw insertLogError;
      }
    } catch (error) {
      console.error(`Erreur récurrence ${table}:`, error.message);
    }
  }
};
