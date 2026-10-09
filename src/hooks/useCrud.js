import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './useAuth';
import { useDashboard } from '../contexts/DashboardContext';
import { useToast } from '../contexts/ToastContext';
import { markOwnChange, newRowId } from '../lib/ownChanges';

/**
 * Formulaire d'ajout / modification d'une ligne d'une table du dashboard.
 *
 * - `emptyForm()` : valeurs d'un formulaire vide
 * - `toForm(item)` : remplit le formulaire à partir d'une ligne existante
 * - `toRow(formData, { isEditing })` : ligne à enregistrer (user_id et dashboard_id sont ajoutés ici, à la création)
 * - `messages` : { created, updated }
 * - `refresh` : vient de useDashboardQuery, recharge les données après l'enregistrement
 *
 * `saving` est vrai pendant l'enregistrement (pour le bouton du formulaire).
 */
export function useCrudForm({ table, emptyForm, toForm, toRow, messages, refresh }) {
  const { user } = useAuth();
  const { activeDashboard } = useDashboard();
  const { showToast } = useToast();
  const [formData, setFormData] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setFormData(emptyForm());
    setShowForm(false);
    setEditingId(null);
  };

  const openCreate = () => {
    setFormData(emptyForm());
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (item) => {
    setFormData(toForm(item));
    setEditingId(item.id);
    setShowForm(true);
  };

  const setField = (name, value) => setFormData(prev => ({ ...prev, [name]: value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const row = toRow(formData, { isEditing: Boolean(editingId) });
    // L'identifiant d'une nouvelle ligne est choisi ici, pour reconnaître notre propre ajout
    // quand le temps réel nous le renvoie (et ne pas recharger les données une seconde fois).
    const rowId = editingId || newRowId();
    markOwnChange(rowId);
    // L'auteur et le dashboard sont fixés à la création : modifier une ligne ne change pas son auteur
    const { error } = editingId
      ? await supabase.from(table).update(row).eq('id', editingId)
      : await supabase.from(table).insert([{ id: rowId, ...row, user_id: user.id, dashboard_id: activeDashboard.id }]);
    setSaving(false);

    if (error) {
      showToast(error.message, { type: 'error' });
      return;
    }
    showToast(editingId ? messages.updated : messages.created, { type: 'success' });
    resetForm();
    refresh();
  };

  return { formData, setField, showForm, editingId, saving, resetForm, openCreate, openEdit, submit };
}

/**
 * Suppression d'une ligne avec confirmation.
 * Pour un élément récurrent, la modale propose aussi de le masquer pour ce mois seulement.
 *
 * - `messages` : { deleted, hidden }
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
    } finally {
      setIsDeleting(false);
      setIsOpen(false);
      setTarget(null);
    }
  };

  const confirmDelete = () => run(() => supabase.from(table).delete().eq('id', target.id), messages.deleted);
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
      isRecurrent: target?.is_recurrent,
    },
  };
}
