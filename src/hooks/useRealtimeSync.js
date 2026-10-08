import { useAuth } from './useAuth';
import { useRealtimeTable } from './useRealtimeTable';
import { useDashboard } from '../contexts/DashboardContext';
import { useMonth } from '../contexts/MonthContext';
import { useToast } from '../contexts/ToastContext';
import { formatMonthDate } from '../lib/dateUtils';
import { isOwnChange, isRecurrenceRecent } from '../lib/ownChanges';

const VERBS = { INSERT: 'ajouté', UPDATE: 'modifié', DELETE: 'supprimé' };

/**
 * Garde une page à jour quand un collaborateur modifie une table du dashboard actif.
 *
 * - `onChange`  : recharge les données de la page
 * - `message`   : (nom, verbe) => texte de la notification, ex. « Loyer a été modifiée par un collaborateur »
 * - `feminine`  : accorde le verbe (« ajoutée »)
 * - `accept`    : filtre supplémentaire sur la ligne reçue (ex. la bonne enveloppe)
 * - `allMonths` : réagit aussi aux changements des autres mois (données cumulées, comme l'épargne)
 *
 * Par défaut les changements des autres mois sont ignorés. Nos propres actions ne sont jamais notifiées.
 */
export function useRealtimeSync(table, { onChange, message, feminine = false, accept, allMonths = false }) {
  const { user } = useAuth();
  const { activeDashboard } = useDashboard();
  const { selectedDate } = useMonth();
  const { showToast } = useToast();

  useRealtimeTable(table, activeDashboard?.id, (eventType, newRecord, oldRecord) => {
    const record = newRecord || oldRecord;
    if (!allMonths && record?.month_date && record.month_date !== formatMonthDate(selectedDate)) return;
    if (accept && !accept(record)) return;

    onChange();

    // Une suppression n'arrive qu'avec l'identifiant : on reconnaît nos actions à la ligne touchée.
    const rowId = newRecord?.id ?? oldRecord?.id;
    const isMine = isOwnChange(rowId)
      || (eventType === 'INSERT' && newRecord?.user_id === user?.id)
      || (eventType === 'INSERT' && newRecord?.is_recurrent && isRecurrenceRecent());
    if (isMine) return;

    const verb = (VERBS[eventType] || VERBS.UPDATE) + (feminine ? 'e' : '');
    showToast(message(newRecord?.name || oldRecord?.name, verb), { type: 'info', duration: 4000 });
  });
}
