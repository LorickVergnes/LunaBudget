import React, { useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useMonth } from '../../contexts/MonthContext';
import { useDashboardFetch } from '../../hooks/useDashboardFetch';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { useCrudForm, useDeleteFlow } from '../../hooks/useCrud';
import { formatMonthDate, getTodayStr } from '../../lib/dateUtils';
import { getMonthStatus, filterRealized, sumAmounts, roundToCents } from '../../lib/budgetCalculations';
import { formatEuro as fmt } from '../../lib/format';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { recurrenceService } from '../../services/recurrenceService';
import MonthSelector from '../../components/layout/MonthSelector';
import TopBar from '../../components/layout/TopBar';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import BottomModal from '../../components/ui/BottomModal';
import DeleteConfirmationModal from '../../components/ui/DeleteConfirmationModal';
import { FormCard, AmountInput, TextField, CheckboxCard, SubmitButton } from '../../components/ui/FormUI';
import { ProgressLinear, SingleDonut } from '../../components/ui/Gauges';
import IconSelector from '../../components/ui/IconSelector';
import IconBubble from '../../components/ui/IconBubble';
import ColorPicker from '../../components/ui/ColorPicker';
import useDesktop from '../../hooks/useDesktop';

const ACCENT = '#A0D2EB';

const Savings = () => {
  const navigate = useNavigate();
  const { selectedDate, setSelectedDate } = useMonth();
  const isDesktop = useDesktop();
  const [savings, setSavings] = useState([]);

  const load = useCallback(async (dashboardId) => {
    await recurrenceService.checkAndApplyRecurrence(dashboardId, selectedDate);
    const { data: savs } = await supabase.from('savings')
      .select('*, saving_entries(amount, date)')
      .eq('dashboard_id', dashboardId)
      .eq('month_date', formatMonthDate(selectedDate))
      .eq('is_hidden', false);

    const todayStr = getTodayStr();
    const monthStatus = getMonthStatus(selectedDate);

    setSavings((savs || []).map(s => ({
      ...s,
      currentReal: sumAmounts(filterRealized(s.saving_entries, monthStatus, todayStr))
    })));
  }, [selectedDate]);

  const { loading, setLoading, refresh } = useDashboardFetch(load);

  useRealtimeSync('savings', {
    onChange: refresh,
    message: (name, verb) => `${name || "Un objectif d'épargne"} a été ${verb} par un collaborateur`,
  });

  // On écoute aussi les versements pour mettre à jour la jauge de l'épargne parente
  useRealtimeSync('saving_entries', {
    onChange: refresh,
    message: (_name, verb) => `Un versement a été ${verb} sur un objectif`,
  });

  const form = useCrudForm({
    table: 'savings',
    emptyForm: () => ({ name: '', target_amount: '', icon: 'PiggyBank', color: '#F9A825', is_recurrent: false, max_month: '' }),
    toForm: (s) => ({ name: s.name, target_amount: s.target_amount.toString(), icon: s.icon || 'PiggyBank', color: s.color || '#F9A825', is_recurrent: s.is_recurrent, max_month: s.max_month ? s.max_month.substring(0, 7) : '' }),
    toRow: (formData) => ({
      ...formData,
      target_amount: roundToCents(formData.target_amount),
      month_date: formatMonthDate(selectedDate),
      // La date de fin ne vaut que pour un objectif récurrent ; le champ donne "AAAA-MM"
      max_month: formData.is_recurrent && formData.max_month ? `${formData.max_month}-01` : null,
    }),
    messages: { created: 'Objectif créé avec succès', updated: 'Objectif modifié avec succès' },
    refresh,
    setLoading,
  });
  const { formData, setField } = form;

  const deletion = useDeleteFlow({
    table: 'savings',
    messages: { deleted: 'Objectif supprimé', hidden: 'Objectif masqué pour ce mois' },
    refresh,
  });

  const totalTarget = sumAmounts(savings, 'target_amount');
  const totalSaved = sumAmounts(savings, 'currentReal');

  const modalForm = (
    <BottomModal isOpen={form.showForm} onClose={form.resetForm} title={form.editingId ? "Modifier l'objectif" : "Nouvel objectif"}>
      <form onSubmit={form.submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <AmountInput value={formData.target_amount} onChange={e => setField('target_amount', e.target.value)} color="#9CA3AF" />
        <TextField label="Nom" placeholder="Voyage, Voiture, Urgences..." value={formData.name} onChange={e => setField('name', e.target.value)} />
        <CheckboxCard label="Objectif récurrent" text="Créer chaque mois" checked={formData.is_recurrent} onToggle={() => setField('is_recurrent', !formData.is_recurrent)} />
        {formData.is_recurrent && (
          <FormCard>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#4A6984', display: 'block', marginBottom: 4 }}>Date de fin (Optionnel)</label>
            <span style={{ fontSize: 12, color: '#9CA3AF', display: 'block', marginBottom: 8 }}>Mois et année finaux d'application pour cet objectif.</span>
            <input type="month" value={formData.max_month} onChange={e => setField('max_month', e.target.value)}
              style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: 15, color: '#4B5563' }} />
          </FormCard>
        )}
        <FormCard><IconSelector value={formData.icon} color={formData.color} onChange={val => setField('icon', val)} /></FormCard>
        <FormCard><ColorPicker value={formData.color} onChange={c => setField('color', c)} /></FormCard>
        <SubmitButton loading={loading}>{form.editingId ? 'Enregistrer' : "Créer l'objectif"}</SubmitButton>
      </form>
    </BottomModal>
  );

  const deleteModal = (
    <DeleteConfirmationModal {...deletion.modalProps}
      title={deletion.target?.is_recurrent ? "Objectif récurrent" : "Supprimer cet objectif ?"}
      message={deletion.target?.is_recurrent
        ? "Cet objectif est récurrent. Voulez-vous le supprimer définitivement ou seulement pour ce mois-ci ?"
        : "Voulez-vous vraiment supprimer cet objectif d'épargne ? Toutes les entrées liées seront également supprimées."} />
  );

  const SavingCard = ({ s, i }) => {
    const target = parseFloat(s.target_amount);
    const current = s.currentReal;
    const pct = Math.round((current / Math.max(target, 1)) * 100);
    const remaining = Math.max(target - current, 0);
    const over = current >= target;

    if (isDesktop) {
      return (
        <div className="card fade-up" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, animationDelay: `${i * 40}ms`, borderLeft: `4px solid ${s.color || '#F9A825'}` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <IconBubble icon={s.icon} color={s.color || '#F9A825'} size={48} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, color: '#4A6984', fontSize: 16, cursor: 'pointer' }} onClick={() => navigate(`/savings/${s.id}`, { state: { date: selectedDate, name: s.name, icon: s.icon, color: s.color } })}>{s.name}</div>
              <div style={{ fontSize: 12, color: '#B0B8C9', fontWeight: 600, marginTop: 2 }}>
                {over ? "Objectif atteint 🎉" : `Reste ${fmt(remaining)}`}
              </div>
            </div>
            <div style={{ background: 'transparent', color: '#A0D2EB', padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
              {pct}%
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }} onClick={() => navigate(`/savings/${s.id}`, { state: { date: selectedDate, name: s.name, icon: s.icon, color: s.color } })}>
            <SingleDonut value={current} max={target} size={100} stroke={10} color={s.color || '#F9A825'} label={`${pct}%`} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <div style={{ fontSize: 11, color: '#B0B8C9', fontWeight: 700 }}>ACTUEL</div>
                <div style={{ fontWeight: 800, color: '#4A6984' }}>{fmt(current)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#B0B8C9', fontWeight: 700 }}>OBJECTIF</div>
                <div style={{ fontWeight: 800, color: '#4A6984' }}>{fmt(target)}</div>
              </div>
            </div>
          </div>

          <ProgressLinear value={current} max={target} color={s.color || '#F9A825'} height={10} />

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => navigate(`/savings/${s.id}`, { state: { date: selectedDate, name: s.name, icon: s.icon, color: s.color } })}
              style={{
                flex: 1, padding: '10px', borderRadius: 12,
                background: 'linear-gradient(135deg, #81BAD8 0%, #CE9C4A 100%)', color: '#fff',
                fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                boxShadow: '0 6px 14px rgba(160,210,235,.3)',
                textShadow: '0 1px 2px rgba(0,0,0,0.2)'
              }}
            >
              <Plus size={14} /> Alimenter
            </button>
            <button
              onClick={(ev) => { ev.stopPropagation(); form.openEdit(s); }}
              style={{
                padding: '10px 14px', borderRadius: 12,
                background: '#F5F7FF', color: '#A0D2EB',
                fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer',
              }}
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={(ev) => { ev.stopPropagation(); deletion.askDelete(s); }}
              style={{
                padding: '10px 14px', borderRadius: 12,
                background: '#FEECEC', color: '#DC2626',
                fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer',
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      );
    }

    // Mobile Layout
    return (
      <div className="card fade-up" style={{ padding: 16, animationDelay: `${i * 40}ms`, minWidth: 0, borderLeft: `4px solid ${s.color || '#F9A825'}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0 }}>
          <IconBubble icon={s.icon} color={s.color || '#F9A825'} size={44} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontWeight: 800, color: '#4A6984', fontSize: 15, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }} onClick={() => navigate(`/savings/${s.id}`, { state: { date: selectedDate, name: s.name, icon: s.icon, color: s.color } })}>{s.name}</div>
              <div style={{
                fontSize: 11, fontWeight: 800, color: s.color || '#F9A825',
                background: `${s.color || '#F9A825'}1A`, padding: '3px 8px', borderRadius: 999, flexShrink: 0
              }}>{pct}%</div>
            </div>
            <div style={{ fontSize: 11, color: '#B0B8C9', fontWeight: 600, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {over ? "Objectif atteint 🎉" : `Reste ${fmt(remaining)}`}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 12, fontSize: 13, fontWeight: 700 }}>
          <span style={{ color: '#4A6984', fontWeight: 800, fontSize: 16 }}>{fmt(current)}</span>
          <span style={{ color: '#B0B8C9' }}>{fmt(target)}</span>
        </div>
        <div style={{ marginTop: 6 }}>
          <ProgressLinear value={current} max={target} color={s.color || '#F9A825'} height={10} />
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            onClick={() => navigate(`/savings/${s.id}`, { state: { date: selectedDate, name: s.name, icon: s.icon, color: s.color } })}
            style={{
              flex: 1, padding: '9px', borderRadius: 11,
              background: 'linear-gradient(135deg, #81BAD8 0%, #CE9C4A 100%)', color: '#fff',
              fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              boxShadow: '0 6px 14px rgba(160,210,235,.28)',
              textShadow: '0 1px 2px rgba(0,0,0,0.2)'
            }}
          >
            <Plus size={14} /> Alimenter
          </button>
          <button
            onClick={(ev) => { ev.stopPropagation(); form.openEdit(s); }}
            style={{
              padding: '9px 14px', borderRadius: 11,
              background: '#F5F7FF', color: '#A0D2EB',
              fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer',
            }}
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={(ev) => { ev.stopPropagation(); deletion.askDelete(s); }}
            style={{
              padding: '9px 14px', borderRadius: 11,
              background: '#FEECEC', color: '#DC2626',
              fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer',
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    );
  };

  // ── DESKTOP ──
  if (isDesktop) {
    return (
      <>
        <div className="desktop-greeting-toprow">
          <div className="desktop-greeting">
            <h1>Épargne 🐖</h1>
            <p>Suivez vos objectifs d'épargne et vos versements.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <MonthSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />
            <button onClick={form.openCreate}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F9A825', color: 'white', border: 'none', borderRadius: 12, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(249,168,37,0.35)' }}>
              <Plus size={18} /> Nouvel objectif
            </button>
          </div>
        </div>

        {loading && !form.showForm ? <LoadingSpinner color="#F9A825" /> : (
          <div>
            <div className="desktop-budget-card" style={{ marginBottom: 24, padding: 24, background: 'linear-gradient(135deg, #81BAD8 0%, #CE9C4A 100%)', color: 'white', border: 'none', textShadow: '0 2px 4px rgba(0,0,0,0.15)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 12, opacity: .9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Patrimoine épargné
                  </div>
                  <div style={{ fontSize: 36, fontWeight: 900, marginTop: 4 }}>{fmt(totalSaved)}</div>
                  <div style={{ fontSize: 14, opacity: .9, fontWeight: 600, marginTop: 4 }}>
                    Objectif total : {fmt(totalTarget)}
                  </div>
                </div>
              </div>
            </div>

            {savings.length === 0 ? (
              <div className="desktop-budget-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
                <p style={{ color: '#B0B8C9', fontWeight: 600 }}>Aucun objectif. Préparez l'avenir !</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {savings.map((s, i) => <SavingCard key={s.id} s={s} i={i} />)}
              </div>
            )}
          </div>
        )}
        {modalForm}
        {deleteModal}
      </>
    );
  }

  // ── MOBILE ──
  return (
    <div className="fade-in pb-fab-spacer" style={{ minHeight: '100vh', background: 'transparent' }}>
      <TopBar title="Épargne" />
      <div style={{ padding: '20px 16px', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <MonthSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />
        </div>

        {loading && !form.showForm ? <LoadingSpinner color="#F9A825" /> : (
          <>
            <div className="fade-up" style={{ padding: 20, background: 'linear-gradient(135deg, #81BAD8 0%, #CE9C4A 100%)', borderRadius: 18, color: 'white', marginBottom: 20, boxShadow: '0 4px 14px rgba(160,210,235,0.3)', textShadow: '0 2px 4px rgba(0,0,0,0.15)' }}>
              <div style={{ fontSize: 11, opacity: .9, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5 }}>
                Patrimoine épargné
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, marginTop: 4 }}>{fmt(totalSaved)}</div>
              <div style={{ fontSize: 12, opacity: .9, fontWeight: 600, marginTop: 4 }}>
                Objectif total : {fmt(totalTarget)}
              </div>
            </div>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 1fr)' }}>
              {savings.map((s, i) => <SavingCard key={s.id} s={s} i={i} />)}
            </div>
            {savings.length === 0 && (
              <div className="card" style={{ padding: '40px 20px', textAlign: 'center' }}><p style={{ color: '#B0B8C9', fontWeight: 600 }}>Aucun objectif. Préparez l'avenir !</p></div>
            )}
          </>
        )}
      </div>
      {!form.showForm && (
        <button onClick={form.openCreate}
          style={{ position: 'fixed', bottom: 90, right: 20, width: 56, height: 56, borderRadius: '50%', background: '#F9A825', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 24px rgba(249,168,37,.5)', zIndex: 40 }}>
          <Plus size={26} color="white" />
        </button>
      )}
      {modalForm}
      {deleteModal}
    </div>
  );
};

export default Savings;
