import { describe, it, expect } from 'vitest';
import { monthSummary, buildGlobalHistory } from './globalHistory';
import { formatMonthDate } from './dateUtils';

const NOW = new Date(2026, 9, 15); // 15 octobre 2026
const OCT = '2026-10-01';
const SEP = '2026-09-01';

// Lignes telles que renvoyées par la fonction SQL get_monthly_totals
const row = (month_date, values = {}) => ({
  month_date,
  income_real: 0, income_planned: 0, fixed_real: 0, fixed_planned: 0,
  envelope_real: 0, envelope_planned: 0, savings_real: 0,
  ...values,
});
const OCT_ROW = row(OCT, {
  income_real: 1440.5, income_planned: 1615.5, fixed_real: 339.9, fixed_planned: 539.9,
  envelope_real: 53.2, envelope_planned: 418, savings_real: 50,
});
const GOALS = [
  { monthly_amount: 100, start_month: '2026-07-01', end_month: '2027-03-01' },
  { monthly_amount: 40, start_month: OCT, end_month: null },
  { monthly_amount: 30, start_month: '2026-05-01', end_month: '2026-08-01' },
];

describe('monthSummary', () => {
  it('en réel, additionne ce qui est déjà arrivé', () => {
    expect(monthSummary(OCT_ROW, GOALS, OCT, OCT, false)).toEqual({ income: 1440.5, expense: 443.1, balance: 997.4 });
  });

  it('en prévisionnel, le mois en cours compte le prévu et l\'épargne des objectifs en cours', () => {
    // 539,90 + 418 + (100 + 40) d'épargne : l'objectif terminé en août ne compte pas
    expect(monthSummary(OCT_ROW, GOALS, OCT, OCT, true)).toEqual({ income: 1615.5, expense: 1097.9, balance: 517.6 });
  });

  it('le prévisionnel ne s\'applique pas aux mois passés', () => {
    const september = row(SEP, { income_real: 1380, income_planned: 1380, fixed_real: 250, fixed_planned: 250 });
    expect(monthSummary(september, GOALS, SEP, OCT, true)).toEqual({ income: 1380, expense: 250, balance: 1130 });
  });

  it('un mois sans données vaut zéro', () => {
    expect(monthSummary(undefined, [], SEP, OCT, false)).toEqual({ income: 0, expense: 0, balance: 0 });
  });

  it('accepte des montants reçus sous forme de texte', () => {
    const textRow = row(OCT, { income_real: '100.10', fixed_real: '0.20', envelope_real: '0.10' });
    expect(monthSummary(textRow, [], OCT, OCT, false)).toEqual({ income: 100.1, expense: 0.3, balance: 99.8 });
  });
});

describe('buildGlobalHistory', () => {
  const rows = [
    row('2025-01-01', { income_real: 500, income_planned: 500 }),
    row(SEP, { income_real: 1380, income_planned: 1380, fixed_real: 250, fixed_planned: 250 }),
    OCT_ROW,
    // Mois futur déjà rempli par la récurrence : il ne compte nulle part
    row('2026-11-01', { income_planned: 1380, fixed_planned: 250 }),
  ];

  it('couvre les 6 derniers mois jusqu\'au mois en cours, du plus ancien au plus récent', () => {
    const { months } = buildGlobalHistory(rows, GOALS, { now: NOW });
    expect(months.map(m => formatMonthDate(m.date))).toEqual(
      ['2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01', SEP, OCT]);
    expect(months[4]).toMatchObject({ income: 1380, expense: 250, balance: 1130 });
    expect(months[0]).toMatchObject({ income: 0, expense: 0, balance: 0 });
  });

  it('le solde total compte tous les mois passés, même hors des 6 derniers, mais pas les mois futurs', () => {
    expect(buildGlobalHistory(rows, GOALS, { now: NOW }).allTimeBalance).toBe(500 + 1130 + 997.4);
  });

  it('en prévisionnel, seul le mois en cours change', () => {
    const { months, allTimeBalance } = buildGlobalHistory(rows, GOALS, { now: NOW, showForecast: true });
    expect(months[5]).toMatchObject({ income: 1615.5, expense: 1097.9 });
    expect(allTimeBalance).toBe(500 + 1130 + 517.6);
  });

  it('en prévisionnel, le mois en cours compte son épargne prévue même sans aucune opération', () => {
    const { allTimeBalance } = buildGlobalHistory([], GOALS, { now: NOW, showForecast: true });
    expect(allTimeBalance).toBe(-140);
  });

  it('sans aucune donnée, tout vaut zéro', () => {
    const { months, allTimeBalance } = buildGlobalHistory(undefined, undefined, { now: NOW });
    expect(months).toHaveLength(6);
    expect(allTimeBalance).toBe(0);
  });
});
