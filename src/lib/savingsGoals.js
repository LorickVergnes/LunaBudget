import { formatMonthDate, formatLocalDate } from './dateUtils';
import { isRealized, sumAmounts } from './budgetCalculations';

/**
 * Objectifs d'épargne : fonctions pures, couvertes par des tests.
 *
 * Un objectif existe une seule fois, de `start_month` à `end_month` (ou sans fin).
 * Ses versements se cumulent d'un mois à l'autre. Les mois sont au format 'AAAA-MM-01'.
 */

// L'objectif est-il en cours pendant ce mois ?
export const isGoalActive = (goal, monthStr) =>
  goal.start_month <= monthStr && (!goal.end_month || goal.end_month >= monthStr);

export const filterActiveGoals = (goals, monthStr) =>
  (goals || []).filter(goal => isGoalActive(goal, monthStr));

// Nombre de mois entre deux mois, bornes incluses (octobre -> décembre = 3)
export const countMonths = (fromMonthStr, toMonthStr) => {
  const [fromYear, fromMonth] = fromMonthStr.split('-').map(Number);
  const [toYear, toMonth] = toMonthStr.split('-').map(Number);
  return (toYear - fromYear) * 12 + (toMonth - fromMonth) + 1;
};

const statusOfMonth = (monthStr, currentMonthStr) => {
  if (monthStr < currentMonthStr) return 'past';
  if (monthStr > currentMonthStr) return 'future';
  return 'current';
};

/**
 * Avancement d'un objectif vu depuis le mois `monthStr`.
 *
 * - Avec un montant à atteindre (`goal_amount`), on suit le cumul de tous les versements.
 * - Sans, on suit le versement du mois par rapport au versement mensuel prévu.
 *
 * Seuls les versements déjà réalisés comptent (datés d'aujourd'hui ou avant).
 */
export const computeGoalProgress = (goal, entries, monthStr, now = new Date()) => {
  const todayStr = formatLocalDate(now);
  const currentMonthStr = formatMonthDate(now);

  const realized = (entries || []).filter(entry =>
    entry.month_date <= monthStr
    && isRealized(entry.date, statusOfMonth(entry.month_date, currentMonthStr), todayStr));

  const savedTotal = sumAmounts(realized);
  const savedThisMonth = sumAmounts(realized.filter(entry => entry.month_date === monthStr));
  const monthlyAmount = parseFloat(goal.monthly_amount) || 0;
  const goalAmount = parseFloat(goal.goal_amount) > 0 ? parseFloat(goal.goal_amount) : null;

  const target = goalAmount ?? monthlyAmount;
  const current = goalAmount !== null ? savedTotal : savedThisMonth;
  const remaining = Math.max(Math.round((target - current) * 100) / 100, 0);

  // Avec une échéance : ce qu'il faut verser chaque mois, de ce mois-ci au dernier, pour y arriver
  let requiredMonthly = null;
  if (goalAmount !== null && goal.end_month && goal.end_month >= monthStr && remaining > 0) {
    const savedBefore = savedTotal - savedThisMonth;
    requiredMonthly = Math.ceil(((goalAmount - savedBefore) / countMonths(monthStr, goal.end_month)) * 100) / 100;
  }

  return {
    savedTotal,
    savedThisMonth,
    monthlyAmount,
    goalAmount,
    target,
    current,
    remaining,
    percent: Math.round((current / Math.max(target, 1)) * 100),
    reached: current >= target,
    requiredMonthly,
  };
};
