import { addMonths, formatMonthDate, parseLocalDate } from './dateUtils';

/**
 * Récurrences : fonctions pures, couvertes par des tests.
 *
 * Une récurrence est une règle enregistrée une seule fois (table recurrences). Les lignes de chaque
 * mois pointent vers leur règle par `recurrence_id` : une ligne est récurrente si elle en a un.
 */

// Rythmes proposés : une occurrence tous les N mois (0 = pas de répétition)
export const REPEAT_OPTIONS = [
  { value: 0, label: 'Jamais' },
  { value: 1, label: 'Tous les mois' },
  { value: 2, label: 'Tous les 2 mois' },
  { value: 3, label: 'Tous les 3 mois' },
  { value: 6, label: 'Tous les 6 mois' },
  { value: 12, label: 'Tous les ans' },
];

export const repeatLabel = (intervalMonths) =>
  REPEAT_OPTIONS.find(option => option.value === Number(intervalMonths))?.label ?? 'Récurrent';

// Portée d'une modification sur une ligne récurrente
export const SCOPE_ONE = 'one';             // ce mois uniquement : la règle ne change pas
export const SCOPE_FOLLOWING = 'following'; // ce mois et les suivants : la règle change

export const isRecurrent = (item) => Boolean(item?.recurrence_id);

// Champs de récurrence d'un formulaire vide
export const emptyRecurrenceForm = () => ({ repeat: 0, repeat_end: '', scope: SCOPE_FOLLOWING });

// Champs de récurrence d'un formulaire ouvert sur une ligne existante.
// Sur une ligne récurrente, on propose d'abord de ne modifier que ce mois.
export const recurrenceFormOf = (item) => (isRecurrent(item)
  ? {
    repeat: item.recurrence?.interval_months ?? 1,
    repeat_end: item.recurrence?.end_month ? item.recurrence.end_month.slice(0, 7) : '',
    scope: SCOPE_ONE,
  }
  : emptyRecurrenceForm());

const FORM_ONLY_FIELDS = ['repeat', 'repeat_end', 'scope', 'is_recurrent'];

// Retire d'une ligne les champs qui n'existent que dans le formulaire
export const withoutRecurrenceFields = (row) =>
  Object.fromEntries(Object.entries(row).filter(([key]) => !FORM_ONLY_FIELDS.includes(key)));

// Mois suivant, au format 'AAAA-MM-01'
export const nextMonthStr = (monthStr) => formatMonthDate(addMonths(parseLocalDate(monthStr), 1));

/**
 * Ce qu'il faut enregistrer à la validation d'un formulaire.
 *
 * - `formData` : { repeat, repeat_end, scope, ... }
 * - `editingItem` : la ligne modifiée, ou null pour un ajout
 *
 * Retourne l'une de ces actions :
 *   'insert-row'        ajout d'une ligne ordinaire
 *   'create-rule'       ajout d'une règle (la base crée la ligne du mois)
 *   'update-row'        modification de cette seule ligne
 *   'make-recurrent'    la ligne ordinaire devient la première occurrence d'une nouvelle règle
 *   'update-following'  la règle change à partir de ce mois
 *   'stop-after'        la récurrence s'arrête après ce mois (la ligne du mois est gardée et modifiée)
 */
export const planSave = (formData, editingItem) => {
  const repeats = Number(formData.repeat) > 0;
  if (!editingItem) return repeats ? 'create-rule' : 'insert-row';
  if (!isRecurrent(editingItem)) return repeats ? 'make-recurrent' : 'update-row';
  if (formData.scope !== SCOPE_FOLLOWING) return 'update-row';
  return repeats ? 'update-following' : 'stop-after';
};
