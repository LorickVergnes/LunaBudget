import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './useAuth';
import { useDashboard } from '../contexts/DashboardContext';
import { useToast } from '../contexts/ToastContext';
import { markOwnChange } from '../lib/ownChanges';

/**
 * Formulaire d'ajout / modification d'une ligne d'une table du dashboard.
 *
 * - `emptyForm()` : valeurs d'un formulaire vide
 * - `toForm(item)` : remplit le formulaire à partir d'une ligne existante
 * - `toRow(formData)` : ligne à enregistrer (user_id et dashboard_id sont ajoutés ici)
 * - `messages` : { created, updated }
 * - `refresh`, `setLoading` : viennent de useDashboardFetch
 */
export function useCrudForm({ table, emptyForm, toForm, toRow, messages, refresh, setLoading }) {
  const { user } = useAuth();
  const { activeDashboard } = useDashboard();
  const { showToast } = useToast();
  const [formData, setFormData] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

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
    setLoading(true);
    const row = { ...toRow(formData), user_id: user.id, dashboard_id: activeDashboard.id };
    if (editingId) markOwnChange(editingId);
    const { error } = editingId
      ? await supabase.from(table).update(row).eq('id', editingId)
      : await supabase.from(table).insert([row]);

    if (error) {
      showToast(error.message, { type: 'error' });
      setLoading(false);
      return;
    }
    showToast(editingId ? messages.updated : messages.created, { type: 'success' });
    resetForm();
    refresh();
  };

  return { formData, setField, showForm, editingId, resetForm, openCreate, openEdit, submit };
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
