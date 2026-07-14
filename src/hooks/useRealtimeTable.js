import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * Hook générique de synchronisation en temps réel via Supabase Realtime.
 * 
 * Écoute les INSERT, UPDATE et DELETE sur une table donnée,
 * filtrés par `dashboard_id`, et appelle `onRealtimeChange` à chaque événement.
 *
 * @param {string} table       - Nom de la table Supabase (ex: 'incomes')
 * @param {string} dashboardId - ID du dashboard actif à écouter
 * @param {function} onRealtimeChange - Callback appelé avec (eventType, newRecord, oldRecord)
 *   eventType: 'INSERT' | 'UPDATE' | 'DELETE'
 *   newRecord: l'enregistrement après modification (null pour DELETE)
 *   oldRecord: l'enregistrement avant modification (null pour INSERT, nécessite REPLICA IDENTITY FULL)
 *
 * Pré-requis côté Supabase:
 *   1. La table doit avoir Realtime activé (Database > Replication > ajouter la table)
 *   2. Pour recevoir les données complètes sur UPDATE/DELETE:
 *      ALTER TABLE <table> REPLICA IDENTITY FULL;
 *
 * Usage:
 *   useRealtimeTable('incomes', activeDashboard?.id, (eventType, newRow, oldRow) => {
 *     // Rafraîchir les données
 *     fetchData();
 *   });
 */
export function useRealtimeTable(table, dashboardId, onRealtimeChange) {
  // Ref pour toujours pointer vers le dernier callback sans re-souscrire
  const callbackRef = useRef(onRealtimeChange);
  callbackRef.current = onRealtimeChange;

  useEffect(() => {
    if (!table || !dashboardId) return;

    // Créer un channel unique pour cette table + dashboard
    const channelName = `realtime:${table}:${dashboardId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',           // INSERT, UPDATE, DELETE
          schema: 'public',
          table: table,
          filter: `dashboard_id=eq.${dashboardId}`,
        },
        (payload) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;
          console.log(`[Realtime] ${table} → ${eventType}`, payload);
          callbackRef.current(eventType, newRecord, oldRecord);
        }
      )
      .subscribe((status) => {
        console.log(`[Realtime] ${channelName} status:`, status);
      });

    // Cleanup: se désinscrire quand le composant démonte ou les deps changent
    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, dashboardId]);
}
