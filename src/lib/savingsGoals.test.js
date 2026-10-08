import { describe, it, expect } from 'vitest';
import { isGoalActive, filterActiveGoals, countMonths, computeGoalProgress } from './savingsGoals';

const NOW = new Date(2026, 9, 15); // 15 octobre 2026
const OCT = '2026-10-01';

describe('isGoalActive', () => {
  const open = { start_month: '2026-07-01', end_month: null };
  const bounded = { start_month: '2026-07-01', end_month: '2026-09-01' };

  it('un objectif sans fin est actif à partir de son premier mois', () => {
    expect(isGoalActive(open, '2026-06-01')).toBe(false);
    expect(isGoalActive(open, '2026-07-01')).toBe(true);
    expect(isGoalActive(open, '2030-01-01')).toBe(true);
  });

  it('un objectif borné est actif du premier au dernier mois inclus', () => {
    expect(isGoalActive(bounded, '2026-07-01')).toBe(true);
    expect(isGoalActive(bounded, '2026-09-01')).toBe(true);
    expect(isGoalActive(bounded, '2026-10-01')).toBe(false);
  });

  it('filterActiveGoals garde les objectifs du mois et accepte une liste absente', () => {
    expect(filterActiveGoals([open, bounded], OCT)).toEqual([open]);
    expect(filterActiveGoals(null, OCT)).toEqual([]);
  });
});

describe('countMonths', () => {
  it('compte les mois, bornes incluses', () => {
    expect(countMonths('2026-10-01', '2026-10-01')).toBe(1);
    expect(countMonths('2026-10-01', '2026-12-01')).toBe(3);
    expect(countMonths('2026-10-01', '2027-03-01')).toBe(6);
  });
});

describe('computeGoalProgress', () => {
  const entries = [
    { amount: '50.00', date: '2026-07-10', month_date: '2026-07-01' },
    { amount: '100.00', date: '2026-08-12', month_date: '2026-08-01' },
    { amount: '25.50', date: '2026-10-03', month_date: OCT },
    { amount: '40.00', date: '2026-10-28', month_date: OCT }, // pas encore réalisé le 15 octobre
  ];

  it('avec un montant à atteindre, suit le cumul de tous les mois', () => {
    const goal = { monthly_amount: '100.00', goal_amount: '2000.00', start_month: '2026-07-01', end_month: null };
    const p = computeGoalProgress(goal, entries, OCT, NOW);
    expect(p.savedTotal).toBe(175.5);
    expect(p.savedThisMonth).toBe(25.5);
    expect(p.target).toBe(2000);
    expect(p.current).toBe(175.5);
    expect(p.remaining).toBe(1824.5);
    expect(p.percent).toBe(9);
    expect(p.reached).toBe(false);
    expect(p.requiredMonthly).toBeNull();
  });

  it('sans montant à atteindre, suit le versement du mois', () => {
    const goal = { monthly_amount: '100.00', goal_amount: null, start_month: '2026-07-01', end_month: null };
    const p = computeGoalProgress(goal, entries, OCT, NOW);
    expect(p.goalAmount).toBeNull();
    expect(p.target).toBe(100);
    expect(p.current).toBe(25.5);
    expect(p.remaining).toBe(74.5);
    expect(p.percent).toBe(26);
    expect(p.savedTotal).toBe(175.5);
  });

  it('vu depuis un mois passé, ne compte que les versements jusqu\'à ce mois', () => {
    const goal = { monthly_amount: '100.00', goal_amount: '2000.00', start_month: '2026-07-01', end_month: null };
    const p = computeGoalProgress(goal, entries, '2026-08-01', NOW);
    expect(p.savedTotal).toBe(150);
    expect(p.savedThisMonth).toBe(100);
  });

  it('vu depuis un mois futur, les versements à venir ne comptent pas encore', () => {
    const goal = { monthly_amount: '100.00', goal_amount: '2000.00', start_month: '2026-07-01', end_month: null };
    const future = [...entries, { amount: '100.00', date: '2026-11-05', month_date: '2026-11-01' }];
    const p = computeGoalProgress(goal, future, '2026-11-01', NOW);
    expect(p.savedTotal).toBe(175.5);
    expect(p.savedThisMonth).toBe(0);
  });

  it('avec une échéance, calcule le versement mensuel nécessaire', () => {
    // 2 000 € à atteindre fin décembre, 150 € déjà versés avant octobre : (2000 - 150) / 3 mois
    const goal = { monthly_amount: '100.00', goal_amount: '2000.00', start_month: '2026-07-01', end_month: '2026-12-01' };
    const p = computeGoalProgress(goal, entries, OCT, NOW);
    expect(p.requiredMonthly).toBe(616.67);
  });

  it('objectif atteint : plus rien à verser', () => {
    const goal = { monthly_amount: '100.00', goal_amount: '150.00', start_month: '2026-07-01', end_month: '2026-12-01' };
    const p = computeGoalProgress(goal, entries, OCT, NOW);
    expect(p.reached).toBe(true);
    expect(p.remaining).toBe(0);
    expect(p.percent).toBe(117);
    expect(p.requiredMonthly).toBeNull();
  });

  it('accepte un objectif sans versement', () => {
    const goal = { monthly_amount: 60, goal_amount: null, start_month: OCT, end_month: null };
    const p = computeGoalProgress(goal, undefined, OCT, NOW);
    expect(p.savedTotal).toBe(0);
    expect(p.current).toBe(0);
    expect(p.percent).toBe(0);
  });
});
