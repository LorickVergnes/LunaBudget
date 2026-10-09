import { describe, it, expect } from 'vitest';
import {
  planSave, recurrenceFormOf, emptyRecurrenceForm, withoutRecurrenceFields, isRecurrent,
  nextMonthStr, repeatLabel, SCOPE_ONE, SCOPE_FOLLOWING,
} from './recurrence';

const ORDINARY = { id: 'a', recurrence_id: null };
const RECURRENT = { id: 'b', recurrence_id: 'rule-b', recurrence: { interval_months: 3, end_month: '2027-07-01' } };

describe('isRecurrent', () => {
  it('une ligne est récurrente si elle pointe vers une règle', () => {
    expect(isRecurrent(RECURRENT)).toBe(true);
    expect(isRecurrent(ORDINARY)).toBe(false);
    // L'ancienne case « récurrent » ne compte plus
    expect(isRecurrent({ is_recurrent: true })).toBe(false);
    expect(isRecurrent(null)).toBe(false);
  });
});

describe('champs de récurrence du formulaire', () => {
  it('un nouvel élément ne se répète pas', () => {
    expect(emptyRecurrenceForm()).toEqual({ repeat: 0, repeat_end: '', scope: SCOPE_FOLLOWING });
  });

  it('une ligne récurrente reprend le rythme et la fin de sa règle, et propose de ne modifier que ce mois', () => {
    expect(recurrenceFormOf(RECURRENT)).toEqual({ repeat: 3, repeat_end: '2027-07', scope: SCOPE_ONE });
  });

  it('une règle sans fin donne un champ vide ; une règle non jointe est supposée mensuelle', () => {
    expect(recurrenceFormOf({ recurrence_id: 'r', recurrence: { interval_months: 1, end_month: null } }).repeat_end).toBe('');
    expect(recurrenceFormOf({ recurrence_id: 'r' })).toEqual({ repeat: 1, repeat_end: '', scope: SCOPE_ONE });
  });

  it('une ligne ordinaire s\'ouvre comme un nouvel élément', () => {
    expect(recurrenceFormOf(ORDINARY)).toEqual(emptyRecurrenceForm());
  });

  it('withoutRecurrenceFields retire les champs qui n\'existent que dans le formulaire', () => {
    expect(withoutRecurrenceFields({ name: 'Loyer', amount: 700, repeat: 1, repeat_end: '', scope: SCOPE_ONE, is_recurrent: true }))
      .toEqual({ name: 'Loyer', amount: 700 });
  });
});

describe('planSave', () => {
  it('ajout : une ligne ordinaire, ou une règle si l\'élément se répète', () => {
    expect(planSave({ repeat: 0 }, null)).toBe('insert-row');
    expect(planSave({ repeat: 3 }, null)).toBe('create-rule');
    expect(planSave({ repeat: '12' }, null)).toBe('create-rule');
  });

  it('ligne ordinaire : simple modification, ou première occurrence d\'une nouvelle règle', () => {
    expect(planSave({ repeat: 0 }, ORDINARY)).toBe('update-row');
    expect(planSave({ repeat: 1 }, ORDINARY)).toBe('make-recurrent');
  });

  it('ligne récurrente, « ce mois uniquement » : la règle n\'est jamais touchée', () => {
    expect(planSave({ repeat: 3, scope: SCOPE_ONE }, RECURRENT)).toBe('update-row');
    expect(planSave({ repeat: 0, scope: SCOPE_ONE }, RECURRENT)).toBe('update-row');
  });

  it('ligne récurrente, « ce mois et les suivants » : la règle change, ou s\'arrête après ce mois', () => {
    expect(planSave({ repeat: 3, scope: SCOPE_FOLLOWING }, RECURRENT)).toBe('update-following');
    expect(planSave({ repeat: 0, scope: SCOPE_FOLLOWING }, RECURRENT)).toBe('stop-after');
  });
});

describe('libellés et mois', () => {
  it('repeatLabel nomme les rythmes proposés', () => {
    expect(repeatLabel(1)).toBe('Tous les mois');
    expect(repeatLabel(12)).toBe('Tous les ans');
    expect(repeatLabel(5)).toBe('Récurrent');
  });

  it('nextMonthStr passe au mois suivant, y compris en fin d\'année', () => {
    expect(nextMonthStr('2026-10-01')).toBe('2026-11-01');
    expect(nextMonthStr('2026-12-01')).toBe('2027-01-01');
  });
});
