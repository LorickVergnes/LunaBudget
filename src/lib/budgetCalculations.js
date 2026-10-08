import { formatMonthDate } from './dateUtils';

/**
 * Calculs du budget : fonctions pures, sans React ni Supabase, couvertes par des tests.
 *
 * Vocabulaire :
 *  - "réel"  : ce qui est déjà arrivé (opérations datées d'aujourd'hui ou avant)
 *  - "prévu" : tout ce qui est planifié sur le mois
 */

// Situe un mois par rapport au mois en cours : 'past' | 'current' | 'future'
export const getMonthStatus = (monthDate, now = new Date()) => {
  const month = formatMonthDate(monthDate);
  const current = formatMonthDate(now);
  if (month < current) return 'past';
  if (month > current) return 'future';
  return 'current';
};

// Une opération est "réelle" si son mois est passé, ou si elle est datée d'aujourd'hui ou avant
export const isRealized = (dateStr, monthStatus, todayStr) => {
  if (monthStatus === 'past') return true;
  if (monthStatus === 'future') return false;
  return dateStr <= todayStr;
};

export const filterRealized = (items, monthStatus, todayStr) =>
  (items || []).filter(item => isRealized(item.date, monthStatus, todayStr));

// Somme en centimes pour éviter les erreurs d'arrondi des flottants (0.1 + 0.2 !== 0.3)
export const sumAmounts = (items, key = 'amount') =>
  (items || []).reduce((cents, item) => cents + Math.round(parseFloat(item[key]) * 100), 0) / 100;

// Montant saisi dans un formulaire, arrondi au centime
export const roundToCents = (value) => Math.round(parseFloat(value) * 100) / 100;

// Reste à vivre = revenus - dépenses fixes - enveloppes - épargne
export const computeBalance = ({ income, fixedExp, envExp, savings }) =>
  income - (fixedExp + envExp) - savings;

/**
 * Totaux d'un mois, en réel et en prévu.
 * En prévu, les enveloppes comptent pour leur plafond et l'épargne pour le versement mensuel
 * de chaque objectif (`savings` = les objectifs en cours ce mois-là) ;
 * en réel, on compte ce qui a effectivement été dépensé / versé.
 */
export const computeMonthTotals = (
  { incomes, expenses, envelopes, envelopeExpenses, savings, savingEntries },
  monthStatus,
  todayStr
) => ({
  real: {
    income: sumAmounts(filterRealized(incomes, monthStatus, todayStr)),
    fixedExp: sumAmounts(filterRealized(expenses, monthStatus, todayStr)),
    envExp: sumAmounts(filterRealized(envelopeExpenses, monthStatus, todayStr)),
    savings: sumAmounts(filterRealized(savingEntries, monthStatus, todayStr)),
  },
  forecast: {
    income: sumAmounts(incomes),
    fixedExp: sumAmounts(expenses),
    envExp: sumAmounts(envelopes, 'max_amount'),
    savings: sumAmounts(savings, 'monthly_amount'),
  },
});

// Nombre de jours restants dans le mois, aujourd'hui inclus
export const getDaysLeftInMonth = (now = new Date()) => {
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Math.max(lastDay - now.getDate() + 1, 1);
};

export const getDaysInMonth = (date) =>
  new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
