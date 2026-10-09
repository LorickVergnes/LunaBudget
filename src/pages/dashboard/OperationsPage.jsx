import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useMonth } from '../../contexts/MonthContext';
import { useDashboard } from '../../contexts/DashboardContext';
import { formatMonthDate, getTodayStr, parseLocalDate, monthOfDateStr, getMonthBounds, defaultDateInMonth } from '../../lib/dateUtils';
import { getMonthStatus, isRealized, filterRealized, sumAmounts, roundToCents } from '../../lib/budgetCalculations';
import { Plus, RotateCw, Trash2, Pencil } from 'lucide-react';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import LoadError from '../../components/ui/LoadError';
import MonthSelector from '../../components/layout/MonthSelector';
import TopBar from '../../components/layout/TopBar';
import BottomModal from '../../components/ui/BottomModal';
import DeleteConfirmationModal from '../../components/ui/DeleteConfirmationModal';
import { FormCard, AmountInput, TextField, DateField, CheckboxCard, SubmitButton } from '../../components/ui/FormUI';
import IconSelector from '../../components/ui/IconSelector';
import { getIconComponent } from '../../lib/iconRegistry';
import DonutChart from '../../components/ui/DonutChart';
import ColorPicker from '../../components/ui/ColorPicker';
import useDesktop from '../../hooks/useDesktop';
import { useDashboardQuery } from '../../hooks/useDashboardQuery';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { useCrudForm, useDeleteFlow } from '../../hooks/useCrud';

const euros = (value, options) => parseFloat(value).toLocaleString('fr-FR', options);

// Ligne de la liste : une opération avec ses boutons modifier / supprimer
const OperationItem = ({ item, index, config, isUpcoming, showForecast, canEdit, onEdit, onDelete }) => {
  const color = item.color || config.accent;
  return (
    <div className="card fade-up" style={{
      padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14,
      animationDelay: `${index * 40}ms`,
      opacity: isUpcoming ? 0.6 : 1,
      background: !showForecast && isUpcoming ? 'rgba(255,255,255,0.4)' : 'white',
      border: isUpcoming ? '1px dashed #E8ECFF' : 'none',
      borderLeft: `4px solid ${color}`
    }}>
      <div style={{ width: 44, height: 44, borderRadius: '50%', background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {React.createElement(getIconComponent(item.icon), { size: 20, style: { color } })}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#4A6984', marginBottom: 2 }}>
          {item.name} {isUpcoming && <span style={{ fontSize: 10, color: '#E5BA73', fontWeight: 600, marginLeft: 4 }}>(Prévu)</span>}
        </p>
        <p style={{ fontSize: 12, color: '#B0B8C9', fontWeight: 500 }}>
          {euros(item.amount, { minimumFractionDigits: 2 })} € – {parseLocalDate(item.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {item.is_recurrent && <RotateCw size={12} style={{ color: config.recurrentIconColor }} />}
        {canEdit && <button
          onClick={onEdit}
          style={{
            background: '#F3F4F6', border: 'none', borderRadius: 10, width: 36, height: 36,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
          }}
        >
          <Pencil size={18} style={{ color: '#6B7280' }} />
        </button>}
        {canEdit && <button
          onClick={onDelete}
          style={{
            background: '#FEE2E2', border: 'none', borderRadius: 10, width: 36, height: 36,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
          }}
        >
          <Trash2 size={18} style={{ color: '#EF4444' }} />
        </button>}
      </div>
    </div>
  );
};

/**
 * Page d'opérations datées du mois : sert aux Revenus et aux Dépenses fixes.
 * Tout ce qui diffère entre les deux (table, couleurs, textes) vient de `config`.
 */
const OperationsPage = ({ config }) => {
  const { table, accent, texts } = config;
  const { selectedDate, setSelectedDate } = useMonth();
  const { canEdit } = useDashboard();
  const isDesktop = useDesktop();
  const [showForecast, setShowForecast] = useState(false);
  const month = formatMonthDate(selectedDate);

  const { data: items = [], loading, error, retry, refresh } = useDashboardQuery(table, [month], async (dashboardId, { applyRecurrence }) => {
    await applyRecurrence(selectedDate);
    const { data, error } = await supabase.from(table).select('*')
      .eq('dashboard_id', dashboardId)
      .eq('month_date', month)
      .eq('is_hidden', false)
      .order('date', { ascending: false });
    if (error) throw error;
    return data || [];
  });

  useRealtimeSync(table, {
    onChange: refresh,
    feminine: texts.feminine,
    message: (name, verb) => `${name || texts.realtimeFallbackName} a été ${verb} par un collaborateur`,
  });

  const form = useCrudForm({
    table,
    emptyForm: () => ({ name: '', amount: '', date: defaultDateInMonth(month), is_recurrent: false, icon: config.defaultIcon, color: accent }),
    toForm: (item) => ({ name: item.name, amount: item.amount.toString(), date: item.date.split('T')[0], is_recurrent: item.is_recurrent, icon: item.icon || config.defaultIcon, color: item.color || accent }),
    // Le mois de l'opération vient de sa date (le champ date est limité au mois affiché)
    toRow: (formData) => ({ ...formData, amount: roundToCents(formData.amount), month_date: monthOfDateStr(formData.date) }),
    messages: { created: texts.created, updated: texts.updated },
    refresh,
  });
  const { formData, setField } = form;

  const deletion = useDeleteFlow({ table, messages: { deleted: texts.deleted, hidden: texts.hidden }, refresh });

  const todayStr = getTodayStr();
  const monthStatus = getMonthStatus(selectedDate);
  const dateBounds = getMonthBounds(month);

  const visibleItems = showForecast ? items : filterRealized(items, monthStatus, todayStr);

  const total = sumAmounts(visibleItems);
  const totalForecast = sumAmounts(items);

  const donutSegments = visibleItems.map(item => ({
    value: parseFloat(item.amount),
    color: item.color || accent
  }));

  const modalForm = (
    <BottomModal isOpen={form.showForm} onClose={form.resetForm} title={form.editingId ? texts.editTitle : texts.addTitle}>
      <form onSubmit={form.submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <AmountInput value={formData.amount} onChange={e => setField('amount', e.target.value)} color="#9CA3AF" />
        <TextField label="Nom" placeholder={texts.namePlaceholder} value={formData.name} onChange={e => setField('name', e.target.value)} />
        <DateField value={formData.date} min={dateBounds.min} max={dateBounds.max} onChange={e => setField('date', e.target.value)} />
        <CheckboxCard label="Ajouter chaque mois" text={texts.recurrentText} checked={formData.is_recurrent} onToggle={() => setField('is_recurrent', !formData.is_recurrent)} />
        <FormCard><IconSelector value={formData.icon} color={formData.color} onChange={val => setField('icon', val)} /></FormCard>
        <FormCard><ColorPicker value={formData.color} onChange={c => setField('color', c)} /></FormCard>
        <SubmitButton loading={form.saving}>{form.editingId ? 'Enregistrer' : 'Ajouter'}</SubmitButton>
      </form>
    </BottomModal>
  );

  const deleteModal = (
    <DeleteConfirmationModal
      {...deletion.modalProps}
      title={deletion.target?.is_recurrent ? "Élément récurrent" : texts.deleteTitle}
      message={deletion.target?.is_recurrent ? texts.deleteRecurrentMessage : texts.deleteMessage} />
  );

  const list = items.map((item, i) => (
    <OperationItem key={item.id} item={item} index={i} config={config} showForecast={showForecast} canEdit={canEdit}
      isUpcoming={!isRealized(item.date, monthStatus, todayStr)}
      onEdit={() => form.openEdit(item)} onDelete={() => deletion.askDelete(item)} />
  ));

  if (isDesktop) {
    return (
      <>
        <div className="desktop-greeting-toprow">
          <div className="desktop-greeting">
            <h1>{texts.title}</h1>
            <p>{texts.subtitle}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <MonthSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />
            <div className="desktop-toggle">
              <button className={`desktop-toggle-btn${!showForecast ? ' desktop-toggle-btn--active' : ''}`} onClick={() => setShowForecast(false)}>Réel</button>
              <button className={`desktop-toggle-btn${showForecast ? ' desktop-toggle-btn--active' : ''}`} onClick={() => setShowForecast(true)}>Prévisions</button>
            </div>
            {canEdit && <button onClick={form.openCreate}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: accent, color: 'white', border: 'none', borderRadius: 12, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: config.addButtonShadow }}>
              <Plus size={18} /> Ajouter
            </button>}
          </div>
        </div>

        {loading ? <LoadingSpinner /> : error ? <LoadError onRetry={retry} /> : (
          <div className="desktop-main-grid">
            <div className="desktop-budget-card" style={{ display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg, #81BAD8 0%, #CE9C4A 100%)', color: 'white', border: 'none', textShadow: '0 2px 4px rgba(0,0,0,0.15)' }}>
              <p className="desktop-card-title" style={{ color: 'white', textShadow: 'none' }}>{texts.summaryTitle}</p>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 32, padding: '10px 0' }}>
                <DonutChart segments={donutSegments} total={total || 0} size={200} centerLabel={showForecast ? "Prévu" : "Réel"} textColor="white" subTextColor="white" textShadow="0 1px 3px rgba(0,0,0,0.3)" />

                <div style={{ width: '100%' }}>
                   <div style={{ display: 'flex', justifyContent: 'center', gap: 40, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.25)', paddingBottom: 16 }}>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: 12, fontWeight: 700, opacity: 0.9, textTransform: 'uppercase', marginBottom: 4 }}>Total {showForecast ? 'Prévu' : 'Réel'}</p>
                        <p style={{ fontSize: 24, fontWeight: 900 }}>{total.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</p>
                      </div>
                      {!showForecast && totalForecast > total && (
                        <div style={{ textAlign: 'center' }}>
                          <p style={{ fontSize: 12, fontWeight: 700, opacity: 0.9, textTransform: 'uppercase', marginBottom: 4 }}>{texts.forecastLabel}</p>
                          <p style={{ fontSize: 24, fontWeight: 900 }}>{totalForecast.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</p>
                        </div>
                      )}
                   </div>

                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', background: 'rgba(0,0,0,0.1)', padding: 16, borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)' }}>
                    {visibleItems.map(item => (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color || accent, flexShrink: 0 }} />
                          <span style={{ fontSize: 13, color: 'white', fontWeight: 600, opacity: 0.95, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 800, color: 'white', flexShrink: 0 }}>{euros(item.amount, { maximumFractionDigits: 0 })} €</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="desktop-budget-card" style={{ overflowY: 'auto', maxHeight: 600 }}>
              <p className="desktop-card-title">{texts.historyTitle}</p>
              {items.length === 0 ? (
                <p style={{ color: '#B0B8C9', fontWeight: 600, textAlign: 'center', padding: '40px 0' }}>{texts.empty}</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {list}
                </div>
              )}
            </div>
          </div>
        )}
        {modalForm}
        {deleteModal}
      </>
    );
  }

  return (
    <div className="fade-in pb-fab-spacer" style={{ minHeight: '100vh', background: 'transparent' }}>
      <TopBar title={texts.mobileTitle} />
      <div style={{ padding: '20px 16px', maxWidth: 480, margin: '0 auto' }}>
        <MonthSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
          <div style={{ background: 'white', borderRadius: 14, padding: 4, display: 'flex', gap: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <button onClick={() => setShowForecast(false)} style={{ border: 'none', padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', background: !showForecast ? accent : 'transparent', color: !showForecast ? 'white' : '#B0B8C9' }}>Réel</button>
            <button onClick={() => setShowForecast(true)} style={{ border: 'none', padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', background: showForecast ? accent : 'transparent', color: showForecast ? 'white' : '#B0B8C9' }}>Prévisions</button>
          </div>
        </div>
        {loading ? <LoadingSpinner /> : error ? <LoadError onRetry={retry} /> : (
          <>
            <div className="fade-up" style={{ padding: '20px', marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px 24px', flexWrap: 'wrap', background: 'linear-gradient(135deg, #81BAD8 0%, #CE9C4A 100%)', borderRadius: 20, color: 'white', textShadow: '0 1px 3px rgba(0,0,0,0.2)', boxShadow: '0 4px 14px rgba(160,210,235,0.3)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '100px' }}>
                <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.9, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{showForecast ? 'Total Prévu' : 'Total Réel'}</span>
                <span style={{ fontSize: 24, fontWeight: 900 }}>{total.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                {!showForecast && totalForecast > total && <span style={{ fontSize: 11, opacity: 0.85, marginTop: 4 }}>Sur {totalForecast.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} € prévus</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <DonutChart segments={donutSegments} total={total || 1} size={120} textColor="white" subTextColor="white" textShadow="0 1px 3px rgba(0,0,0,0.3)" />
              </div>
              <div style={{ flex: '1 1 140px', display: 'flex', flexDirection: 'column', gap: 6, minWidth: '140px', background: 'rgba(0,0,0,0.1)', padding: 12, borderRadius: 14, border: '1px solid rgba(255,255,255,0.1)' }}>
                {visibleItems.slice(0, 3).map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color || accent, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: 'white', opacity: 0.95, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'white', flexShrink: 0 }}>{euros(item.amount, { maximumFractionDigits: 0 })} €</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 20 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#4A6984', marginBottom: 10, paddingLeft: 4 }}>{texts.historyTitle}</p>
              {items.length === 0 ? (
                <div className="card" style={{ padding: '40px 20px', textAlign: 'center' }}><p style={{ color: '#B0B8C9', fontWeight: 600 }}>{texts.empty}</p></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {list}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      {canEdit && !form.showForm && (
        <button onClick={form.openCreate}
          style={{ position: 'fixed', bottom: 90, right: 20, width: 56, height: 56, borderRadius: '50%', background: '#A0D2EB', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 24px rgba(160,210,235,.5)', zIndex: 40 }}>
          <Plus size={26} color="white" />
        </button>
      )}
      {modalForm}
      {deleteModal}
    </div>
  );
};

export default OperationsPage;
