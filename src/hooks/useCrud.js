import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './useAuth';
import { useDashboard } from '../contexts/DashboardContext';
import { useToast } from '../contexts/ToastContext';
import { markOwnChange, newRowId } from '../lib/ownChanges';
import { planSave, withoutRecurrenceFields, isRecurrent, nextMonthStr } from '../lib/recurrence';
import { recurrenceService } from '../services/recurrenceService';

/**
 * Formulaire d'ajout / modification d'une ligne d'une table du dashboard.
 *
 * - `emptyForm()` : valeurs d'un formulaire vide
 * - `toForm(item)` : remplit le formulaire à partir d'une ligne existante
 * - `toRow(formData, { isEditing })` : ligne à enregistrer (user_id et dashboard_id sont ajoutés ici, à la création)
 * - `messages` : { created, updated }
 * - `refresh` : vient de useDashboardQuery, recharge les données après l'enregistrement
 * - `recurrence` (facultatif) : la table accepte des éléments récurrents.
 *     { kind, toRule(formData) } où `toRule` retourne { name, amount, day, icon, color, month }
 *     (`month` = mois de la ligne, 'AAAA-MM-01'). Le formulaire porte alors les champs
 *     `repeat`, `repeat_end` et `scope` (voir lib/recurrence), qui ne sont jamais écrits dans la ligne.
 *
 * `saving` est vrai pendant l'enregistrement (pour le bouton du formulaire).
 * `editingItem` est la ligne en cours de modification (null pour un ajout).
 */
export function useCrudForm({ table, emptyForm, toForm, toRow, messages, refresh, recurrence }) {
  const { user } = useAuth();
  const { activeDashboard } = useDashboard();
  const { showToast } = useToast();
  const [formData, setFormData] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const editingId = editingItem?.id ?? null;

  const resetForm = () => {
    setFormData(emptyForm());
    setShowForm(false);
    setEditingItem(null);
  };

  const openCreate = () => {
    setFormData(emptyForm());
    setEditingItem(null);
    setShowForm(true);
  };

  const openEdit = (item) => {
    setFormData(toForm(item));
    setEditingItem(item);
    setShowForm(true);
  };

  const setField = (name, value) => setFormData(prev => ({ ...prev, [name]: value }));

  // Enregistre selon ce que le formulaire demande (voir planSave) et retourne l'erreur éventuelle
  const save = async () => {
    const row = withoutRecurrenceFields(toRow(formData, { isEditing: Boolean(editingId) }));
    const action = recurrence ? planSave(formData, editingItem) : (editingId ? 'update-row' : 'insert-row');
    const updateRow = () => supabase.from(table).update(row).eq('id', editingId);

    if (action === 'insert-row') {
      // L'identifiant d'une nouvelle ligne est choisi ici, pour reconnaître notre propre ajout
      // quand le temps réel nous le renvoie (et ne pas recharger les données une seconde fois).
      const rowId = newRowId();
      markOwnChange(rowId);
      // L'auteur et le dashboard sont fixés à la création : modifier une ligne ne change pas son auteur
      return supabase.from(table).insert([{ id: rowId, ...row, user_id: user.id, dashboard_id: activeDashboard.id }]);
    }

    if (editingId) markOwnChange(editingId);
    if (action === 'update-row') return updateRow();

    // Les autres actions touchent une règle de récurrence
    const { month, ...values } = recurrence.toRule(formData);
    const rule = { ...values, interval: Number(formData.repeat), end: formData.repeat_end ? `${formData.repeat_end}-01` : null };
    if (rule.end && rule.end < month) {
      return { error: { message: 'La fin de la répétition ne peut pas précéder ce mois.' } };
    }

    switch (action) {
      case 'create-rule':
        return recurrenceService.create(activeDashboard.id, recurrence.kind, month, rule);
      case 'make-recurrent': {
        const updated = await updateRow();
        return updated.error ? updated : recurrenceService.create(activeDashboard.id, recurrence.kind, month, rule, editingId);
      }
      case 'update-following':
        return recurrenceService.updateFrom(editingItem.recurrence_id, month, rule);
      case 'stop-after': {
        // La ligne de ce mois est gardée (et modifiée) ; il n'y en aura plus ensuite
        const updated = await updateRow();
        return updated.error ? updated : recurrenceService.stop(editingItem.recurrence_id, nextMonthStr(month));
      }
      default:
        return { error: { message: 'Action inconnue.' } };
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await save();
    setSaving(false);

    if (error) {
      showToast(error.message, { type: 'error' });
      return;
    }
    showToast(editingId ? messages.updated : messages.created, { type: 'success' });
    resetForm();
    refresh();
  };

  return { formData, setField, showForm, editingId, editingItem, saving, resetForm, openCreate, openEdit, submit };
}

/**
 * Suppression d'une ligne avec confirmation.
 * Pour un élément récurrent, la modale propose de le retirer de ce mois seulement,
 * ou d'arrêter la récurrence (ce mois et les suivants).
 *
 * - `messages` : { deleted, hidden, stopped }
 * - `modalProps` se passe tel quel à DeleteConfirmationModal ; `target` est la ligne concernée.
 */
export function useDeleteFlow({ table, messages, refresh }) {
  const { showToast } = useToast();
  const [target, setTarget] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const askDelete = (item) => {
    setTarget(item);
    setIsOpen(true);
  };

  const run = async (query, successMessage) => {
    setIsDeleting(true);
    try {
      markOwnChange(target.id);
      const { error } = await query();
      if (error) showToast(error.message, { type: 'error' });
      else { showToast(successMessage, { type: 'success' }); refresh(); }
    } catch (e) {
      console.error(e);
      showToast("La suppression n'a pas pu être effectuée. Réessayez.", { type: 'error' });
    } finally {
      setIsDeleting(false);
      setIsOpen(false);
      setTarget(null);
    }
  };

  // Élément récurrent : la règle s'arrête et ses lignes de ce mois et des suivants disparaissent
  const confirmDelete = () => (isRecurrent(target)
    ? run(() => recurrenceService.stop(target.recurrence_id, target.month_date), messages.stopped || messages.deleted)
    : run(() => supabase.from(table).delete().eq('id', target.id), messages.deleted));
  const confirmHideOnly = () => run(() => supabase.from(table).update({ is_hidden: true }).eq('id', target.id), messages.hidden);

  return {
    target,
    askDelete,
    modalProps: {
      isOpen,
      onClose: () => setIsOpen(false),
      onConfirm: confirmDelete,
      onConfirmAlternative: confirmHideOnly,
      loading: isDeleting,
      isRecurrent: isRecurrent(target),
    },
  };
}
