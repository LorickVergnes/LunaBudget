import { supabase } from '../lib/supabaseClient';
import { formatMonthDate } from '../lib/dateUtils';

/**
 * Service pour gérer la récurrence des éléments (Revenus, Dépenses, Enveloppes, Épargne)
 */
export const recurrenceService = {
  /**
   * Vérifie et applique les éléments récurrents du mois précédent vers le mois actuel
   */
  async checkAndApplyRecurrence(userId, currentMonth) {
    if (!userId) return;

    const prevMonth = new Date(currentMonth);
    prevMonth.setMonth(prevMonth.getMonth() - 1);

    const currentMonthStr = formatMonthDate(currentMonth);
    const prevMonthStr = formatMonthDate(prevMonth);

    const tables = ['incomes', 'expenses', 'envelopes', 'savings'];

    for (const table of tables) {
      await this.syncTableRecurrence(table, userId, prevMonthStr, currentMonthStr);
    }
  },

  /**
   * Synchronise une table spécifique pour la récurrence avec journalisation
   */
  async syncTableRecurrence(table, userId, prevMonthStr, currentMonthStr) {
    try {
      // 1. Récupérer les éléments récurrents du mois précédent
      // On ignore ceux qui étaient cachés le mois dernier (car si caché = on veut arrêter la chaîne ou on l'a déjà arrêté)
      // Note: selon ton besoin, on pourrait vouloir copier même si is_hidden était true le mois dernier.
      // Ici, on part du principe que si c'est récurrent, on le veut le mois suivant.
      const { data: recurrentItems, error: fetchError } = await supabase
        .from(table)
        .select('*')
        .eq('user_id', userId)
        .eq('month_date', prevMonthStr)
        .eq('is_recurrent', true);

      if (fetchError) throw fetchError;
      if (!recurrentItems || recurrentItems.length === 0) return;

      // 2. Récupérer les logs de synchronisation pour éviter de recréer un élément supprimé/traité
      const { data: syncLogs, error: logError } = await supabase
        .from('recurrence_logs')
        .select('source_item_id')
        .eq('user_id', userId)
        .eq('table_name', table)
        .eq('target_month', currentMonthStr);

      if (logError) throw logError;
      const processedIds = new Set(syncLogs?.map(log => log.source_item_id));

      // 3. Filtrer les éléments à cloner
      const itemsToClone = [];
      const logsToCreate = [];

      for (const item of recurrentItems) {
        // Si déjà traité pour ce mois cible (même si supprimé entre temps), on ignore
        if (processedIds.has(item.id)) continue;

        // Si date limite dépassée
        if (item.max_month && currentMonthStr > item.max_month) continue;

        // Préparation du clone
        // eslint-disable-next-line no-unused-vars
        const { id, created_at, month_date, is_hidden, ...rest } = item;
        let newItem = { ...rest, month_date: currentMonthStr, is_hidden: false };

        if (table === 'expenses' || table === 'incomes') {
          const prevDate = new Date(item.date);
          const nextDate = new Date(currentMonthStr);
          nextDate.setDate(Math.min(prevDate.getDate(), new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate()));
          newItem.date = nextDate.toISOString().split('T')[0];
        }

        itemsToClone.push(newItem);
        
        // On prépare le log pour dire que cet ID source a été traité
        logsToCreate.push({
          user_id: userId,
          table_name: table,
          source_item_id: item.id,
          target_month: currentMonthStr
        });
      }

      // 4. Insertion massive
      if (itemsToClone.length > 0) {
        const { error: insertError } = await supabase.from(table).insert(itemsToClone);
        if (insertError) throw insertError;

        // Use upsert with onConflict to avoid duplicate key errors if multiple calls happen in parallel
        const { error: insertLogError } = await supabase
          .from('recurrence_logs')
          .upsert(logsToCreate, { 
            onConflict: 'user_id,table_name,source_item_id,target_month' 
          });
        
        if (insertLogError) {
          // If it's a 409 (Conflict), we can ignore it as it means it was already logged
          if (insertLogError.code !== '23505') throw insertLogError;
        }
      }
    } catch (error) {
      console.error(`Erreur récurrence ${table}:`, error.message);
    }
  }
};
