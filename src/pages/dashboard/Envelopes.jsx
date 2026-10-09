import React from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useMonth } from '../../contexts/MonthContext';
import { useDashboard } from '../../contexts/DashboardContext';
import { useDashboardQuery } from '../../hooks/useDashboardQuery';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { useCrudForm, useDeleteFlow } from '../../hooks/useCrud';
import { formatMonthDate, getTodayStr } from '../../lib/dateUtils';
import { getMonthStatus, filterRealized, sumAmounts, roundToCents } from '../../lib/budgetCalculations';
import { formatEuro as fmt } from '../../lib/format';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MonthSelector from '../../components/layout/MonthSelector';
import TopBar from '../../components/layout/TopBar';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import LoadError from '../../components/ui/LoadError';
import BottomModal from '../../components/ui/BottomModal';
import DeleteConfirmationModal from '../../components/ui/DeleteConfirmationModal';
import { FormCard, AmountInput, TextField, SubmitButton } from '../../components/ui/FormUI';
import RecurrenceFields from '../../components/ui/RecurrenceFields';
import { isRecurrent, emptyRecurrenceForm, recurrenceFormOf } from '../../lib/recurrence';
import { ProgressLinear, SingleDonut } from '../../components/ui/Gauges';
import IconSelector from '../../components/ui/IconSelector';
import IconBubble from '../../components/ui/IconBubble';
import ColorPicker from '../../components/ui/ColorPicker';
import useDesktop from '../../hooks/useDesktop';

const ACCENT = '#A0D2EB';

const Envelopes = () => {
  const navigate = useNavigate();
  const { selectedDate, setSelectedDate } = useMonth();
  const { canEdit } = useDashboard();
  const isDesktop = useDesktop();
  const month = formatMonthDate(selectedDate);

  const { data: envelopes = [], loading, error, retry, refresh } = useDashboardQuery('envelopes', [month], async (dashboardId, { applyRecurrence }) => {
    await applyRecurrence(selectedDate);
    const { data: envs, error } = await supabase.from('envelopes')
      .select('*, envelope_expenses(amount, date), recurrence:recurrences(interval_months, end_month)')
      .eq('dashboard_id', dashboardId)
      .eq('month_date', month)
      .eq('is_hidden', false);
    if (error) throw error;

    const todayStr = getTodayStr();
    const monthStatus = getMonthStatus(selectedDate);

    return (envs || []).map(env => ({
      ...env,
      spent: sumAmounts(filterRealized(env.envelope_expenses, monthStatus, todayStr))
    }));
  });

  useRealtimeSync('envelopes', {
    onChange: refresh,
    feminine: true,
    message: (name, verb) => `${name || 'Une enveloppe'} a été ${verb} par un collaborateur`,
  });

  // On écoute aussi les dépenses pour mettre à jour la jauge de l'enveloppe parente
  useRealtimeSync('envelope_expenses', {
    onChange: refresh,
    feminine: true,
    message: (name, verb) => `${name || 'Une dépense'} a été ${verb} dans une enveloppe`,
  });

  const form = useCrudForm({
    table: 'envelopes',
    emptyForm: () => ({ name: '', max_amount: '', icon: 'Wallet', color: ACCENT, ...emptyRecurrenceForm() }),
    toForm: (env) => ({ name: env.name, max_amount: env.max_amount.toString(), icon: env.icon || 'Wallet', color: env.color || ACCENT, ...recurrenceFormOf(env) }),
    // Le mois est fixé à la création : modifier une enveloppe ne la change pas de mois
    toRow: (formData, { isEditing }) => ({ ...formData, max_amount: roundToCents(formData.max_amount), ...(isEditing ? {} : { month_date: month }) }),
    messages: { created: 'Enveloppe créée avec succès', updated: 'Enveloppe modifiée avec succès' },
    refresh,
    recurrence: {
      kind: 'envelope',
      toRule: (formData) => ({ name: formData.name, amount: roundToCents(formData.max_amount), day: 1, icon: formData.icon, color: formData.color, month }),
    },
  });
  const { formData, setField } = form;

  const deletion = useDeleteFlow({
    table: 'envelopes',
    messages: { deleted: 'Enveloppe supprimée', hidden: 'Enveloppe masquée pour ce mois', stopped: 'Récurrence arrêtée' },
    refresh,
  });

  const totalBudget = sumAmounts(envelopes, 'max_amount');
  const totalSpent = sumAmounts(envelopes, 'spent');
  const pctTotal = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  const modalForm = (
    <BottomModal isOpen={form.showForm} onClose={form.resetForm} title={form.editingId ? "Modifier l'enveloppe" : "Nouvelle enveloppe"}>
      <form onSubmit={form.submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <AmountInput value={formData.max_amount} onChange={e => setField('max_amount', e.target.value)} color="#9CA3AF" />
        <TextField label="Nom" placeholder="Alimentation, Loisirs..." value={formData.name} onChange={e => setField('name', e.target.value)} />
        <RecurrenceFields formData={formData} setField={setField} editingRecurrent={isRecurrent(form.editingItem)} month={month}
          monthlyOnly checkbox={{ label: 'Reporter chaque mois', text: 'Enveloppe récurrente' }} />
        <FormCard><IconSelector value={formData.icon} color={formData.color} onChange={val => setField('icon', val)} /></FormCard>
        <FormCard><ColorPicker value={formData.color} onChange={c => setField('color', c)} /></FormCard>
        <SubmitButton loading={form.saving}>{form.editingId ? 'Enregistrer' : "Créer l'enveloppe"}</SubmitButton>
      </form>
    </BottomModal>
  );

  const deleteModal = (
    <DeleteConfirmationModal {...deletion.modalProps}
      title={isRecurrent(deletion.target) ? "Enveloppe récurrente" : "Supprimer cette enveloppe ?"}
      message={isRecurrent(deletion.target)
        ? "« Supprimer ce mois uniquement » la retire de ce mois. « Arrêter la récurrence » la supprime de ce mois, avec ses dépenses, et des mois suivants ; une enveloppe d'un mois suivant qui contient déjà des dépenses est conservée."
        : "Voulez-vous vraiment supprimer cette enveloppe ? Toutes les dépenses liées seront également supprimées."} />
  );

  const EnvelopeCard = ({ e, i }) => {
    const target = parseFloat(e.max_amount);
    const spent = e.spent;
    const pct = Math.round((spent / Math.max(target, 1)) * 100);
    const remaining = target - spent;
    const over = pct >= 100;
  
    if (isDesktop) {
      return (
        <div className="card fade-up" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, animationDelay: `${i * 40}ms`, borderLeft: `4px solid ${e.color || ACCENT}` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div 
              style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
              onClick={() => navigate(`/envelopes/${e.id}`, { state: { date: selectedDate, name: e.name, icon: e.icon, color: e.color } })}
            >
              <IconBubble icon={e.icon} color={e.color || ACCENT} size={44} />
              <div>
                <div style={{ fontWeight: 800, color: '#4A6984', fontSize: 15 }}>{e.name}</div>
                <div style={{ fontSize: 12, color: '#B0B8C9', fontWeight: 600 }}>{over ? "Dépassé" : `${pct}% utilisé`}</div>
              </div>
            </div>
          </div>
  
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '8px 0' }} onClick={() => navigate(`/envelopes/${e.id}`, { state: { date: selectedDate, name: e.name, icon: e.icon, color: e.color } })} >
            <SingleDonut value={spent} max={target} size={130} stroke={12} color={over ? '#EF4444' : (e.color || ACCENT)} label={`${pct}%`} sublabel={remaining >= 0 ? "utilisé" : "dépassé"} />
          </div>
  
          <div>
            <ProgressLinear value={spent} max={target} color={over ? '#EF4444' : (e.color || ACCENT)} height={8} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, fontWeight: 700 }}>
              <span style={{ color: '#8892a4' }}>{fmt(spent)}</span>
              <span style={{ color: '#4A6984' }}>{fmt(target)}</span>
            </div>
          </div>
  
          {canEdit && <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={(ev) => { ev.stopPropagation(); form.openEdit(e); }}
              style={{
                flex: 1, padding: '10px', borderRadius: 12,
                background: '#E6F0F9', color: '#5695B7',
                fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <Pencil size={14} /> Modifier
            </button>
            <button
              onClick={(ev) => { ev.stopPropagation(); deletion.askDelete(e); }}
              style={{
                padding: '10px 14px', borderRadius: 12,
                background: '#FEECEC', color: '#DC2626',
                fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer',
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>}
        </div>
      );
    }
  
    // Mobile layout
    return (
      <div className="card fade-up" style={{ padding: 16, animationDelay: `${i * 40}ms`, minWidth: 0, borderLeft: `4px solid ${e.color || ACCENT}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }} onClick={() => navigate(`/envelopes/${e.id}`, { state: { date: selectedDate, name: e.name, icon: e.icon, color: e.color } })}>
          <IconBubble icon={e.icon} color={e.color || ACCENT} size={42} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontWeight: 800, color: '#4A6984', fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{e.name}</div>
              <div style={{
                fontSize: 11, fontWeight: 800,
                color: over ? "#EF4444" : (e.color || ACCENT),
                background: over ? "#FEECEC" : `${e.color || ACCENT}1A`,
                padding: "3px 8px", borderRadius: 999, flexShrink: 0
              }}>{pct}%</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, fontSize: 12, fontWeight: 700 }}>
              <span style={{ color: '#8892a4' }}>{fmt(spent)} / {fmt(target)}</span>
              <span style={{ color: over ? "#EF4444" : '#8892a4' }}>
                {over ? `+${fmt(-remaining)}` : `${fmt(remaining)} utilisé`}
              </span>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <ProgressLinear value={spent} max={target} color={over ? '#EF4444' : (e.color || ACCENT)} height={8} />
        </div>
        {canEdit && <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={(ev) => { ev.stopPropagation(); form.openEdit(e); }} style={{ flex: 1, padding: '8px', borderRadius: 10, background: '#E6F0F9', color: '#5695B7', fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Pencil size={12} /> Modifier
          </button>
          <button onClick={(ev) => { ev.stopPropagation(); deletion.askDelete(e); }} style={{ padding: '8px 12px', borderRadius: 10, background: '#FEECEC', color: '#DC2626', fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer' }}>
            <Trash2 size={12} />
          </button>
        </div>}
      </div>
    );
  };

  // ── DESKTOP ──
  if (isDesktop) {
    return (
      <>
        <div className="desktop-greeting-toprow">
          <div className="desktop-greeting">
            <h1>Enveloppes budgétaires ✉️</h1>
            <p>Gérez vos enveloppes de dépenses variables.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <MonthSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />
            {canEdit && <button onClick={form.openCreate}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: ACCENT, color: 'white', border: 'none', borderRadius: 12, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(160,210,235,0.35)' }}>
              <Plus size={18} /> Nouvelle enveloppe
            </button>}
          </div>
        </div>

        {loading ? <LoadingSpinner color={ACCENT} /> : error ? <LoadError onRetry={retry} /> : (
          <div>
            <div className="desktop-budget-card" style={{ marginBottom: 24, background: 'linear-gradient(135deg, #81BAD8 0%, #CE9C4A 100%)', color: 'white', border: 'none', textShadow: '0 2px 4px rgba(0,0,0,0.15)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                <SingleDonut value={totalSpent} max={totalBudget} size={140} stroke={14} color="#fff" trackColor="rgba(255,255,255,.25)" label={`${pctTotal}%`} sublabel="global" textColor="white" subTextColor="white" textShadow="0 1px 3px rgba(0,0,0,0.3)" />
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.9, textTransform: 'uppercase', letterSpacing: 0.5 }}>Toutes enveloppes confondues</div>
                  <div style={{ fontSize: 32, fontWeight: 900, marginTop: 4 }}>
                    {fmt(totalSpent)} <span style={{ fontSize: 18, fontWeight: 700, opacity: 0.85 }}>/ {fmt(totalBudget)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                    <span style={{ background: 'rgba(255,255,255,0.2)', color: 'white', padding: '6px 12px', borderRadius: 99, fontSize: 13, fontWeight: 700 }}>{envelopes.length} enveloppes</span>
                    <span style={{ background: 'rgba(255,255,255,0.2)', color: 'white', padding: '6px 12px', borderRadius: 99, fontSize: 13, fontWeight: 700 }}>{fmt(totalBudget - totalSpent)} disponible</span>
                  </div>
                </div>
              </div>
            </div>

            {envelopes.length === 0 ? (
              <div className="desktop-budget-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
                <p style={{ color: '#B0B8C9', fontWeight: 600 }}>Aucune enveloppe ce mois.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                {envelopes.map((env, i) => <EnvelopeCard key={env.id} e={env} i={i} />)}
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
      <TopBar title="Dépenses variables" />
      <div style={{ padding: '20px 16px', maxWidth: 480, margin: '0 auto' }}>
        <MonthSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />
        <div style={{ height: 16 }} />

        {loading ? <LoadingSpinner color={ACCENT} /> : error ? <LoadError onRetry={retry} /> : (
          <>
            <div style={{ background: 'linear-gradient(135deg, #81BAD8 0%, #CE9C4A 100%)', borderRadius: 18, padding: 20, color: 'white', marginBottom: 20, boxShadow: '0 4px 14px rgba(160,210,235,0.3)', textShadow: '0 1px 3px rgba(0,0,0,0.2)' }} className="fade-up">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <SingleDonut value={totalSpent} max={totalBudget} size={90} stroke={10} color="#fff" trackColor="rgba(255,255,255,.25)" textColor="white" subTextColor="white" textShadow="0 1px 3px rgba(0,0,0,0.3)" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, opacity: .9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Budget enveloppes
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4, letterSpacing: -0.3 }}>{fmt(totalSpent)}</div>
                  <div style={{ fontSize: 12, opacity: .85, fontWeight: 700, marginTop: 2 }}>sur {fmt(totalBudget)} · {pctTotal}%</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 1fr)' }}>
              {envelopes.map((env, i) => <EnvelopeCard key={env.id} e={env} i={i} />)}
            </div>
            {envelopes.length === 0 && (
              <div className="card" style={{ padding: '40px 20px', textAlign: 'center' }}><p style={{ color: '#B0B8C9', fontWeight: 600 }}>Aucune enveloppe ce mois.</p></div>
            )}
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
export default Envelopes;

