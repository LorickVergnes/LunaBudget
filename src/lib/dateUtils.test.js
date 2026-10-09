import { describe, it, expect } from 'vitest';
import {
  formatMonthDate, addMonths, startOfMonth, getNextMonth, getPrevMonth,
  formatLocalDate, parseLocalDate, monthOfDateStr, getMonthBounds, defaultDateInMonth,
} from './dateUtils';

describe('navigation par mois', () => {
  it('ne saute pas de mois depuis un 31', () => {
    expect(formatMonthDate(getNextMonth(new Date(2026, 9, 31)))).toBe('2026-11-01');
    expect(formatMonthDate(getNextMonth(new Date(2026, 0, 31)))).toBe('2026-02-01');
  });

  it('le mois précédent n\'est jamais le mois courant', () => {
    expect(formatMonthDate(getPrevMonth(new Date(2026, 6, 31)))).toBe('2026-06-01');
    expect(formatMonthDate(getPrevMonth(new Date(2026, 2, 30)))).toBe('2026-02-01');
    expect(formatMonthDate(getPrevMonth(new Date(2026, 4, 31)))).toBe('2026-04-01');
  });

  it('passe correctement les changements d\'année', () => {
    expect(formatMonthDate(getNextMonth(new Date(2026, 11, 31)))).toBe('2027-01-01');
    expect(formatMonthDate(getPrevMonth(new Date(2027, 0, 31)))).toBe('2026-12-01');
  });

  it('addMonths accepte plusieurs mois d\'écart', () => {
    expect(formatMonthDate(addMonths(new Date(2026, 7, 31), -5))).toBe('2026-03-01');
    expect(formatMonthDate(addMonths(new Date(2026, 7, 31), 6))).toBe('2027-02-01');
  });

  it('startOfMonth ramène au 1er à minuit', () => {
    const d = startOfMonth(new Date(2026, 9, 31, 23, 59));
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 9, 1, 0]);
  });
});

describe('dates locales', () => {
  it('formatLocalDate donne le jour local, même juste après minuit', () => {
    expect(formatLocalDate(new Date(2026, 9, 7, 0, 30))).toBe('2026-10-07');
    expect(formatLocalDate(new Date(2026, 9, 7, 23, 30))).toBe('2026-10-07');
  });

  it('parseLocalDate relit une date de la base sans décalage de jour', () => {
    const d = parseLocalDate('2026-10-01');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 9, 1]);
    expect(parseLocalDate('2026-03-31T00:00:00+00:00').getDate()).toBe(31);
  });

  it('formatLocalDate et parseLocalDate sont réciproques', () => {
    expect(formatLocalDate(parseLocalDate('2026-02-28'))).toBe('2026-02-28');
  });
});

describe('mois d\'une opération', () => {
  it('monthOfDateStr donne le mois auquel appartient une date', () => {
    expect(monthOfDateStr('2026-10-31')).toBe('2026-10-01');
    expect(monthOfDateStr('2027-01-01')).toBe('2027-01-01');
  });

  it('getMonthBounds donne le premier et le dernier jour du mois', () => {
    expect(getMonthBounds('2026-10-01')).toEqual({ min: '2026-10-01', max: '2026-10-31' });
    expect(getMonthBounds('2026-02-01')).toEqual({ min: '2026-02-01', max: '2026-02-28' });
    expect(getMonthBounds('2028-02-01')).toEqual({ min: '2028-02-01', max: '2028-02-29' });
    expect(getMonthBounds('2026-12-01')).toEqual({ min: '2026-12-01', max: '2026-12-31' });
  });

  it('defaultDateInMonth propose aujourd\'hui dans le mois en cours, sinon le 1er du mois', () => {
    const now = new Date(2026, 9, 15);
    expect(defaultDateInMonth('2026-10-01', now)).toBe('2026-10-15');
    expect(defaultDateInMonth('2026-11-01', now)).toBe('2026-11-01');
    expect(defaultDateInMonth('2026-09-01', now)).toBe('2026-09-01');
  });
});
