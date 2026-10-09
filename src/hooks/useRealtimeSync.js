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
 * Par défaut les changements des autres mois sont ignorés. Une action faite depuis cet onglet
 * n'est ni notifiée ni rechargée une seconde fois.
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

    // Changement fait depuis cet onglet (une suppression n'arrive qu'avec l'identifiant, on se fie
    // donc à la ligne touchée) : les données ont déjà été rechargées après l'action, rien à faire.
    if (isOwnChange(newRecord?.id ?? oldRecord?.id)) return;

    onChange();

    // Pas de notification pour un ajout fait par moi sur un autre appareil,
    // ni pour les lignes récurrentes que je viens de faire créer en ouvrant le mois.
    const isMine = eventType === 'INSERT'
      && (newRecord?.user_id === user?.id || (newRecord?.recurrence_id && isRecurrenceRecent()));
    if (isMine) return;

    const verb = (VERBS[eventType] || VERBS.UPDATE) + (feminine ? 'e' : '');
    showToast(message(newRecord?.name || oldRecord?.name, verb), { type: 'info', duration: 4000 });
  });
}
