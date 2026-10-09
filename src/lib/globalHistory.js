import { formatMonthDate, addMonths } from './dateUtils';
import { filterActiveGoals } from './savingsGoals';
import { sumAmounts } from './budgetCalculations';

/**
 * Vue Globale : fonctions pures, couvertes par des tests.
 *
 * Les totaux de chaque mois sont calculés par la base (fonction SQL get_monthly_totals),
 * une ligne par mois : { month_date, income_real, income_planned, fixed_real, fixed_planned,
 * envelope_real, envelope_planned, savings_real }.
 * Seule l'épargne prévue est calculée ici, à partir des objectifs en cours.
 */

const amount = (value) => Number(value) || 0;
// Addition en centimes, comme partout ailleurs dans l'application
const add = (...values) => sumAmounts(values.map(value => ({ amount: amount(value) })));

// Revenus et sorties d'un mois. Le prévisionnel ne s'applique qu'au mois en cours.
export const monthSummary = (row, goals, monthStr, currentMonthStr, showForecast) => {
  const useForecast = showForecast && monthStr === currentMonthStr;
  const income = useForecast ? amount(row?.income_planned) : amount(row?.income_real);
  const expense = useForecast
    ? add(row?.fixed_planned, row?.envelope_planned, sumAmounts(filterActiveGoals(goals, monthStr), 'monthly_amount'))
    : add(row?.fixed_real, row?.envelope_real, row?.savings_real);
  return { income, expense, balance: add(income, -expense) };
};

/**
 * - `months` : les `count` derniers mois jusqu'au mois en cours, du plus ancien au plus récent ;
 * - `allTimeBalance` : solde cumulé depuis le tout premier mois (les mois futurs ne comptent pas).
 */
export const buildGlobalHistory = (rows, goals, { showForecast = false, now = new Date(), count = 6 } = {}) => {
  const currentMonthStr = formatMonthDate(now);
  const rowByMonth = new Map((rows || []).map(row => [row.month_date, row]));
  const summarize = (monthStr) => monthSummary(rowByMonth.get(monthStr), goals, monthStr, currentMonthStr, showForecast);

  const months = [];
  for (let i = count - 1; i >= 0; i--) {
    const date = addMonths(now, -i);
    months.push({ date, ...summarize(formatMonthDate(date)) });
  }

  // Tous les mois qui ont des données, plus le mois en cours (il peut n'avoir que de l'épargne prévue)
  const pastAndCurrent = new Set([...rowByMonth.keys()].filter(monthStr => monthStr <= currentMonthStr));
  pastAndCurrent.add(currentMonthStr);
  const allTimeBalance = add(...[...pastAndCurrent].map(monthStr => summarize(monthStr).balance));

  return { months, allTimeBalance };
};
