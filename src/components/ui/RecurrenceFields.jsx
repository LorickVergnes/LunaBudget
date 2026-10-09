import React from 'react';
import { FormCard, SelectField, MonthField, CheckboxCard } from './FormUI';
import { REPEAT_OPTIONS, SCOPE_ONE, SCOPE_FOLLOWING } from '../../lib/recurrence';

const SCOPES = [
  { value: SCOPE_ONE, label: 'Ce mois uniquement', hint: 'Les autres mois ne changent pas.' },
  {
    value: SCOPE_FOLLOWING,
    label: 'Ce mois et les suivants',
    hint: 'Les mois précédents ne changent pas. Les mois suivants déjà créés sont mis à jour, même ceux que vous aviez ajustés.',
  },
];

// Choix de la portée d'une modification sur un élément récurrent
const ScopeChoice = ({ value, onChange }) => (
  <FormCard>
    <span id="recurrence-scope-label" style={{ fontSize: 12, fontWeight: 700, color: '#4A6984', display: 'block', marginBottom: 8 }}>
      Appliquer la modification à
    </span>
    <div role="radiogroup" aria-labelledby="recurrence-scope-label" style={{ display: 'flex', flexDirection: 'column', gap: 4, background: '#F3F4F6', borderRadius: 12, padding: 4 }}>
      {SCOPES.map(scope => {
        const selected = value === scope.value;
        return (
          <button key={scope.value} type="button" role="radio" aria-checked={selected} onClick={() => onChange(scope.value)}
            style={{
              border: 'none', borderRadius: 9, padding: '9px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', textAlign: 'left',
              background: selected ? 'white' : 'transparent', color: selected ? '#4A6984' : '#6B7280',
              boxShadow: selected ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}>
            {scope.label}
          </button>
        );
      })}
    </div>
    <span style={{ fontSize: 12, color: '#6B7280', display: 'block', marginTop: 8 }}>
      {SCOPES.find(scope => scope.value === value)?.hint}
    </span>
  </FormCard>
);

/**
 * Champs de récurrence d'un formulaire : rythme, mois de fin et, sur un élément déjà récurrent,
 * portée de la modification. Lit et écrit `repeat`, `repeat_end` et `scope` dans le formulaire.
 *
 * - `editingRecurrent` : le formulaire modifie un élément déjà récurrent
 * - `month` : mois de l'élément ('AAAA-MM-01'), plus petite valeur possible pour la fin
 * - `monthlyOnly` : une simple case à cocher « chaque mois » remplace le choix du rythme (enveloppes)
 * - `checkbox` : { label, text } de cette case
 */
const RecurrenceFields = ({ formData, setField, editingRecurrent = false, month, monthlyOnly = false, checkbox }) => {
  const repeat = Number(formData.repeat) || 0;
  // « Ce mois uniquement » : la règle n'est pas modifiée, inutile d'en montrer les réglages
  const ruleHidden = editingRecurrent && formData.scope !== SCOPE_FOLLOWING;

  return (
    <>
      {editingRecurrent && <ScopeChoice value={formData.scope} onChange={scope => setField('scope', scope)} />}

      {!ruleHidden && (monthlyOnly ? (
        <CheckboxCard label={checkbox.label} text={checkbox.text} checked={repeat > 0} onToggle={() => setField('repeat', repeat > 0 ? 0 : 1)} />
      ) : (
        <SelectField label="Répéter" options={REPEAT_OPTIONS} value={repeat} onChange={e => setField('repeat', Number(e.target.value))} />
      ))}

      {!ruleHidden && repeat > 0 && (
        <MonthField label="Jusqu'à (optionnel)" hint="Dernier mois de la répétition. Laissez vide si elle n'a pas de fin."
          min={month.slice(0, 7)} value={formData.repeat_end} onChange={e => setField('repeat_end', e.target.value)} />
      )}

      {!ruleHidden && editingRecurrent && repeat === 0 && (
        <span style={{ fontSize: 12, color: '#6B7280', padding: '0 8px' }}>
          La répétition s'arrêtera après ce mois : les mois suivants déjà créés seront supprimés.
        </span>
      )}
    </>
  );
};

export default RecurrenceFields;
