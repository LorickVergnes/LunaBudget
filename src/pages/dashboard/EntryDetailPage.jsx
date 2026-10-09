import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useMonth } from '../../contexts/MonthContext';
import { useDashboard } from '../../contexts/DashboardContext';
import { useToast } from '../../contexts/ToastContext';
import { useRealtimeTable } from '../../hooks/useRealtimeTable';
import { formatMonthDate, getTodayStr, parseLocalDate } from '../../lib/dateUtils';
import { sumAmounts, roundToCents } from '../../lib/budgetCalculations';
import { ArrowLeft, Plus, Trash2, Pencil } from 'lucide-react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { getIconComponent } from '../../lib/iconRegistry';
import TopBar from '../../components/layout/TopBar';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import BottomModal from '../../components/ui/BottomModal';
import DeleteConfirmationModal from '../../components/ui/DeleteConfirmationModal';
import { AmountInput, TextField, DateField, SubmitButton } from '../../components/ui/FormUI';
import { useDashboardQuery } from '../../hooks/useDashboardQuery';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { useCrudForm, useDeleteFlow } from '../../hooks/useCrud';

/**
 * Détail d'un élément parent (enveloppe ou objectif d'épargne) : la liste de ses lignes
 * (dépenses ou versements), avec ajout, modification et suppression.
 * Tout ce qui diffère entre les deux vient de `config`.
 */
const EntryDetailPage = ({ config }) => {
  const { table, parentKey, texts } = config;
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedDate } = useMonth();
  const { canEdit } = useDashboard();
  const { showToast } = useToast();
  // Nom, icône et couleur du parent sont transmis par la page de liste
  const [parentName] = useState(location.state?.name || config.defaultName);
  const parentIcon = getIconComponent(location.state?.icon || config.defaultIcon);
  const parentColor = location.state?.color || config.defaultColor;

  const { data: entries = [], loading, refresh, dashboardId } = useDashboardQuery(table, [id], async (activeDashboardId) => {
    const { data, error } = await supabase.from(table).select('*')
      .eq(parentKey, id)
      .eq('dashboard_id', activeDashboardId)
      .order('date', { ascending: false });
    if (error) throw error;
    return data || [];
  });

  useRealtimeSync(table, {
    onChange: refresh,
    feminine: texts.feminine,
    message: texts.realtimeMessage,
    allMonths: config.allMonths,
    // Uniquement les lignes de ce parent
    accept: (record) => !(record?.[parentKey] && record[parentKey] !== id),
  });

  // Retour à la liste si le parent est supprimé par un collaborateur
  useRealtimeTable(config.parentTable, dashboardId, (eventType, _newRecord, oldRecord) => {
    if (eventType === 'DELETE' && oldRecord?.id?.toString() === id) {
      showToast(texts.parentDeleted, { type: 'error', duration: 5000 });
      navigate(config.parentRoute);
    }
  });

  const withName = (values, name) => (config.hasName ? { name, ...values } : values);

  const form = useCrudForm({
    table,
    emptyForm: () => withName({ amount: '', date: getTodayStr() }, ''),
    toForm: (entry) => withName({ amount: entry.amount.toString(), date: entry.date.split('T')[0] }, entry.name),
    toRow: (formData) => ({
      ...formData,
      amount: roundToCents(formData.amount),
      [parentKey]: id,
      month_date: formatMonthDate(selectedDate),
      ...config.extraRow,
    }),
    messages: { created: texts.created, updated: texts.updated },
    refresh,
  });
  const { formData, setField } = form;

  const deletion = useDeleteFlow({ table, messages: { deleted: texts.deleted }, refresh });

  const total = sumAmounts(entries);

  return (
    <div className="fade-in pb-fab-spacer" style={{ minHeight: '100vh', background: 'transparent' }}>
      <TopBar title={parentName} />

      <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: '#ffffff', border: '1px solid #E8ECFF', cursor: 'pointer', display: 'flex', padding: '8px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <ArrowLeft size={20} style={{ color: '#4A6984' }} />
        </button>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, color: '#B0B8C9', fontWeight: 600, lineHeight: 1 }}>{texts.headerLabel}</p>
        </div>
        <span style={{ fontSize: 16, fontWeight: 800, color: config.totalColor, background: `${config.totalColor}15`, padding: '6px 12px', borderRadius: '12px' }}>
          {config.totalPrefix}{total.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
        </span>
      </div>

      <div style={{ padding: '0px 16px', maxWidth: 480, margin: '0 auto' }}>
        {loading ? (
          <LoadingSpinner color={config.spinnerColor} />
        ) : entries.length === 0 ? (
          <div className="card" style={{ padding: '60px 20px', textAlign: 'center', marginTop: 16 }}>
            {React.createElement(parentIcon, { size: 40, style: { color: '#D1D5DB', margin: '0 auto 12px' } })}
            <p style={{ color: '#B0B8C9', fontWeight: 600 }}>{texts.empty}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {entries.map((entry, i) => (
              <div key={entry.id} className="card fade-up" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, animationDelay: `${i * 40}ms` }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: `${parentColor}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {React.createElement(parentIcon, { size: 20, style: { color: parentColor } })}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#4A6984', marginBottom: 2 }}>{config.hasName ? entry.name : texts.entryTitle}</p>
                  <p style={{ fontSize: 12, color: '#B0B8C9', fontWeight: 500 }}>
                    {parseFloat(entry.amount).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € – {parseLocalDate(entry.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {canEdit && <button
                    onClick={() => form.openEdit(entry)}
                    style={{
                      background: '#F3F4F6', border: 'none', borderRadius: 10, width: 36, height: 36,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                    }}
                  >
                    <Pencil size={18} style={{ color: '#6B7280' }} />
                  </button>}
                  {canEdit && <button
                    onClick={() => deletion.askDelete(entry)}
                    style={{
                      background: '#FEE2E2', border: 'none', borderRadius: 10, width: 36, height: 36,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                    }}
                  >
                    <Trash2 size={18} style={{ color: '#EF4444' }} />
                  </button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {canEdit && !form.showForm && (
        <button onClick={form.openCreate}
          style={{ position: 'fixed', bottom: 90, right: 20, width: 56, height: 56, borderRadius: '50%', background: '#A0D2EB', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 24px rgba(160,210,235,.5)', zIndex: 40 }}>
          <Plus size={26} color="white" />
        </button>
      )}

      <BottomModal isOpen={form.showForm} onClose={form.resetForm} title={form.editingId ? texts.editTitle : texts.addTitle}>
        <form onSubmit={form.submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <AmountInput value={formData.amount} onChange={e => setField('amount', e.target.value)} color="#9CA3AF" />
          {config.hasName && (
            <TextField label="Nom" placeholder={texts.namePlaceholder} value={formData.name} onChange={e => setField('name', e.target.value)} />
          )}
          <DateField value={formData.date} onChange={e => setField('date', e.target.value)} />
          <SubmitButton loading={form.saving}>{form.editingId ? 'Enregistrer' : texts.submitLabel}</SubmitButton>
        </form>
      </BottomModal>

      <DeleteConfirmationModal
        isOpen={deletion.modalProps.isOpen}
        onClose={deletion.modalProps.onClose}
        onConfirm={deletion.modalProps.onConfirm}
        loading={deletion.modalProps.loading}
        title={texts.deleteTitle}
        message={texts.deleteMessage}
      />
    </div>
  );
};

export default EntryDetailPage;
