import { describe, it, expect } from 'vitest';
import {
  getMonthStatus, isRealized, filterRealized, sumAmounts,
  computeBalance, computeMonthTotals, getDaysLeftInMonth, getDaysInMonth,
} from './budgetCalculations';

const NOW = new Date(2026, 9, 15); // 15 octobre 2026
const TODAY = '2026-10-15';

describe('getMonthStatus', () => {
  it('situe le mois par rapport au mois en cours', () => {
    expect(getMonthStatus(new Date(2026, 8, 1), NOW)).toBe('past');
    expect(getMonthStatus(new Date(2026, 9, 1), NOW)).toBe('current');
    expect(getMonthStatus(new Date(2026, 10, 1), NOW)).toBe('future');
  });

  it('ignore le jour du mois', () => {
    expect(getMonthStatus(new Date(2026, 9, 31), NOW)).toBe('current');
    expect(getMonthStatus(new Date(2026, 8, 30), NOW)).toBe('past');
  });

  it('gère le changement d\'année', () => {
    expect(getMonthStatus(new Date(2025, 11, 1), new Date(2026, 0, 10))).toBe('past');
    expect(getMonthStatus(new Date(2027, 0, 1), new Date(2026, 11, 31))).toBe('future');
  });
});

describe('isRealized', () => {
  it('compte tout dans un mois passé, rien dans un mois futur', () => {
    expect(isRealized('2026-09-30', 'past', TODAY)).toBe(true);
    expect(isRealized('2026-11-01', 'future', TODAY)).toBe(false);
  });

  it('dans le mois en cours, compte jusqu\'à aujourd\'hui inclus', () => {
    expect(isRealized('2026-10-14', 'current', TODAY)).toBe(true);
    expect(isRealized('2026-10-15', 'current', TODAY)).toBe(true);
    expect(isRealized('2026-10-16', 'current', TODAY)).toBe(false);
  });
});

describe('filterRealized', () => {
  const items = [{ date: '2026-10-01' }, { date: '2026-10-15' }, { date: '2026-10-28' }];

  it('garde les opérations déjà arrivées', () => {
    expect(filterRealized(items, 'current', TODAY)).toHaveLength(2);
    expect(filterRealized(items, 'past', TODAY)).toHaveLength(3);
    expect(filterRealized(items, 'future', TODAY)).toHaveLength(0);
  });

  it('accepte une liste absente', () => {
    expect(filterRealized(null, 'current', TODAY)).toEqual([]);
    expect(filterRealized(undefined, 'current', TODAY)).toEqual([]);
  });
});

describe('sumAmounts', () => {
  it('additionne des montants reçus en texte ou en nombre', () => {
    expect(sumAmounts([{ amount: '1380.00' }, { amount: 175 }, { amount: '0.50' }])).toBe(1555.5);
  });

  it('ne produit pas d\'erreur d\'arrondi', () => {
    expect(sumAmounts([{ amount: '0.10' }, { amount: '0.20' }])).toBe(0.3);
    expect(sumAmounts(Array.from({ length: 10 }, () => ({ amount: '0.10' })))).toBe(1);
  });

  it('lit une autre colonne et accepte une liste vide ou absente', () => {
    expect(sumAmounts([{ max_amount: '400.00' }, { max_amount: '150.00' }], 'max_amount')).toBe(550);
    expect(sumAmounts([])).toBe(0);
    expect(sumAmounts(null)).toBe(0);
  });
});

describe('computeBalance', () => {
  it('retire les dépenses fixes, les enveloppes et l\'épargne des revenus', () => {
    expect(computeBalance({ income: 1555, fixedExp: 625, envExp: 300, savings: 100 })).toBe(530);
  });

  it('peut être négatif', () => {
    expect(computeBalance({ income: 100, fixedExp: 250, envExp: 0, savings: 0 })).toBe(-150);
  });
});

describe('computeMonthTotals', () => {
  const data = {
    incomes: [{ amount: '1380.00', date: '2026-10-06' }, { amount: '175.00', date: '2026-10-25' }],
    expenses: [{ amount: '250.00', date: '2026-10-06' }, { amount: '200.00', date: '2026-10-27' }],
    envelopes: [{ max_amount: '400.00' }],
    envelopeExpenses: [{ amount: '35.20', date: '2026-10-10' }, { amount: '12.30', date: '2026-10-20' }],
    savings: [{ target_amount: '100.00' }],
    savingEntries: [{ amount: '50.00', date: '2026-10-02' }],
  };

  it('en cours de mois : le réel s\'arrête à aujourd\'hui, le prévu compte tout', () => {
    const { real, forecast } = computeMonthTotals(data, 'current', TODAY);
    expect(real).toEqual({ income: 1380, fixedExp: 250, envExp: 35.2, savings: 50 });
    expect(forecast).toEqual({ income: 1555, fixedExp: 450, envExp: 400, savings: 100 });
    expect(computeBalance(real)).toBeCloseTo(1044.8, 2);
    expect(computeBalance(forecast)).toBe(605);
  });

  it('mois passé : le réel compte toutes les opérations', () => {
    const { real } = computeMonthTotals(data, 'past', TODAY);
    expect(real).toEqual({ income: 1555, fixedExp: 450, envExp: 47.5, savings: 50 });
  });

  it('mois futur : rien de réel, le prévu reste identique', () => {
    const { real, forecast } = computeMonthTotals(data, 'future', TODAY);
    expect(real).toEqual({ income: 0, fixedExp: 0, envExp: 0, savings: 0 });
    expect(forecast.income).toBe(1555);
  });

  it('accepte des listes absentes', () => {
    const { real, forecast } = computeMonthTotals({}, 'current', TODAY);
    expect(computeBalance(real)).toBe(0);
    expect(computeBalance(forecast)).toBe(0);
  });
});

describe('jours du mois', () => {
  it('compte les jours restants, aujourd\'hui inclus', () => {
    expect(getDaysLeftInMonth(new Date(2026, 9, 15))).toBe(17);
    expect(getDaysLeftInMonth(new Date(2026, 9, 31))).toBe(1);
    expect(getDaysLeftInMonth(new Date(2026, 9, 1))).toBe(31);
  });

  it('connaît la longueur des mois', () => {
    expect(getDaysInMonth(new Date(2026, 1, 1))).toBe(28);
    expect(getDaysInMonth(new Date(2028, 1, 1))).toBe(29);
    expect(getDaysInMonth(new Date(2026, 11, 1))).toBe(31);
  });
});
