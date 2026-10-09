import React from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useMonth } from '../../contexts/MonthContext';
import { useDashboard } from '../../contexts/DashboardContext';
import { useDashboardQuery } from '../../hooks/useDashboardQuery';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { useCrudForm, useDeleteFlow } from '../../hooks/useCrud';
import { formatMonthDate } from '../../lib/dateUtils';
import { sumAmounts, roundToCents } from '../../lib/budgetCalculations';
import { isGoalActive, computeGoalProgress } from '../../lib/savingsGoals';
import { formatEuro as fmt } from '../../lib/format';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MonthSelector from '../../components/layout/MonthSelector';
import TopBar from '../../components/layout/TopBar';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import BottomModal from '../../components/ui/BottomModal';
import DeleteConfirmationModal from '../../components/ui/DeleteConfirmationModal';
import { FormCard, AmountInput, TextField, NumberField, MonthField, SubmitButton } from '../../components/ui/FormUI';
import { ProgressLinear, SingleDonut } from '../../components/ui/Gauges';
import IconSelector from '../../components/ui/IconSelector';
import IconBubble from '../../components/ui/IconBubble';
import ColorPicker from '../../components/ui/ColorPicker';
import useDesktop from '../../hooks/useDesktop';

const ACCENT = '#A0D2EB';

const Savings = () => {
  const navigate = useNavigate();
  const { selectedDate, setSelectedDate } = useMonth();
  const { canEdit } = useDashboard();
  const isDesktop = useDesktop();
  const monthStr = formatMonthDate(selectedDate);

  // Tous les objectifs du dashboard avec leurs versements : changer de mois ne recharge rien
  const { data: goals = [], loading, refresh } = useDashboardQuery('savings', [], async (dashboardId) => {
    const { data, error } = await supabase.from('savings')
      .select('*, saving_entries(amount, date, month_date)')
      .eq('dashboard_id', dashboardId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  });

  useRealtimeSync('savings', {
    onChange: refresh,
    message: (name, verb) => `${name || "Un objectif d'épargne"} a été ${verb} par un collaborateur`,
  });

  // On écoute aussi les versements pour mettre à jour la jauge de l'épargne parente
  useRealtimeSync('saving_entries', {
    onChange: refresh,
    allMonths: true,
    message: (_name, verb) => `Un versement a été ${verb} sur un objectif`,
  });

  const form = useCrudForm({
    table: 'savings',
    emptyForm: () => ({ name: '', monthly_amount: '', goal_amount: '', end_month: '', icon: 'PiggyBank', color: '#F9A825' }),
    toForm: (s) => ({
      name: s.name,
      monthly_amount: s.monthly_amount.toString(),
      goal_amount: s.goal_amount != null ? s.goal_amount.toString() : '',
      end_month: s.end_month ? s.end_month.substring(0, 7) : '',
      icon: s.icon || 'PiggyBank',
      color: s.color || '#F9A825',
    }),
    toRow: (formData, { isEditing }) => ({
      name: formData.name,
      icon: formData.icon,
      color: formData.color,
      monthly_amount: roundToCents(formData.monthly_amount),
      goal_amount: formData.goal_amount ? roundToCents(formData.goal_amount) : null,
      // Le champ donne "AAAA-MM"
      end_month: formData.end_month ? `${formData.end_month}-01` : null,
      // Le premier mois est fixé à la création et ne change plus ensuite
      ...(isEditing ? {} : { start_month: monthStr }),
    }),
    messages: { created: 'Objectif créé avec succès', updated: 'Objectif modifié avec succès' },
    refresh,
  });
  const { formData, setField } = form;

  const deletion = useDeleteFlow({
    table: 'savings',
    messages: { deleted: 'Objectif supprimé' },
    refresh,
  });

  // Avancement de chaque objectif vu depuis le mois affiché
  const startedGoals = goals
    .filter(goal => goal.start_month <= monthStr)
    .map(goal => ({ ...goal, progress: computeGoalProgress(goal, goal.saving_entries, monthStr) }));
  const savings = startedGoals.filter(goal => isGoalActive(goal, monthStr));

  // Le patrimoine compte aussi les objectifs terminés : l'argent est toujours épargné
  const totalSaved = sumAmounts(startedGoals.map(goal => goal.progress), 'savedTotal');
  const savedThisMonth = sumAmounts(savings.map(goal => goal.progress), 'savedThisMonth');
  const plannedThisMonth = sumAmounts(savings, 'monthly_amount');

  const modalForm = (
    <BottomModal isOpen={form.showForm} onClose={form.resetForm} title={form.editingId ? "Modifier l'objectif" : "Nouvel objectif"}>
      <form onSubmit={form.submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: '#4A6984', textAlign: 'center' }}>Versement prévu chaque mois</label>
        <AmountInput value={formData.monthly_amount} onChange={e => setField('monthly_amount', e.target.value)} color="#9CA3AF" />
        <TextField label="Nom" placeholder="Voyage, Voiture, Urgences..." value={formData.name} onChange={e => setField('name', e.target.value)} />
        <NumberField label="Montant à atteindre (optionnel)" hint="Le total visé, tous mois confondus. Laissez vide pour une épargne régulière sans plafond."
          placeholder="Ex : 2000" value={formData.goal_amount} onChange={e => setField('goal_amount', e.target.value)} />
        <MonthField label="Dernier mois (optionnel)" hint="L'objectif n'apparaît plus après ce mois. Laissez vide s'il n'a pas de fin."
          min={monthStr.substring(0, 7)} value={formData.end_month} onChange={e => setField('end_month', e.target.value)} />
        <FormCard><IconSelector value={formData.icon} color={formData.color} onChange={val => setField('icon', val)} /></FormCard>
        <FormCard><ColorPicker value={formData.color} onChange={c => setField('color', c)} /></FormCard>
        <SubmitButton loading={form.saving}>{form.editingId ? 'Enregistrer' : "Créer l'objectif"}</SubmitButton>
      </form>
    </BottomModal>
  );

  const deleteModal = (
    <DeleteConfirmationModal {...deletion.modalProps}
      title="Supprimer cet objectif ?"
      message="Voulez-vous vraiment supprimer cet objectif d'épargne ? Tous ses versements, tous mois confondus, seront également supprimés. Pour seulement l'arrêter, modifiez plutôt son dernier mois." />
  );

  const SavingCard = ({ s, i }) => {
    const { target, current, remaining, goalAmount, savedTotal, savedThisMonth, monthlyAmount, requiredMonthly } = s.progress;
    const pct = s.progress.percent;
    const over = s.progress.reached;
    // Avec un montant à atteindre, la jauge suit le cumul ; sinon elle suit le versement du mois
    const hasGoal = goalAmount !== null;
    const info = hasGoal
      ? `Ce mois : ${fmt(savedThisMonth)} sur ${fmt(monthlyAmount)} prévus${requiredMonthly ? ` · ${fmt(requiredMonthly)} / mois pour tenir l'échéance` : ''}`
      : `Total épargné : ${fmt(savedTotal)}`;

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
                <div style={{ fontSize: 11, color: '#B0B8C9', fontWeight: 700 }}>{hasGoal ? 'ÉPARGNÉ' : 'CE MOIS'}</div>
                <div style={{ fontWeight: 800, color: '#4A6984' }}>{fmt(current)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#B0B8C9', fontWeight: 700 }}>{hasGoal ? 'OBJECTIF' : 'PRÉVU'}</div>
                <div style={{ fontWeight: 800, color: '#4A6984' }}>{fmt(target)}</div>
              </div>
            </div>
          </div>

          <ProgressLinear value={current} max={target} color={s.color || '#F9A825'} height={10} />

          <div style={{ fontSize: 12, color: '#B0B8C9', fontWeight: 600 }}>{info}</div>

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
              {canEdit ? <><Plus size={14} /> Alimenter</> : 'Voir les versements'}
            </button>
            {canEdit && <button
              onClick={(ev) => { ev.stopPropagation(); form.openEdit(s); }}
              style={{
                padding: '10px 14px', borderRadius: 12,
                background: '#F5F7FF', color: '#A0D2EB',
                fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer',
              }}
            >
              <Pencil size={14} />
            </button>}
            {canEdit && <button
              onClick={(ev) => { ev.stopPropagation(); deletion.askDelete(s); }}
              style={{
                padding: '10px 14px', borderRadius: 12,
                background: '#FEECEC', color: '#DC2626',
                fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer',
              }}
            >
              <Trash2 size={14} />
            </button>}
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
        <div style={{ fontSize: 11, color: '#B0B8C9', fontWeight: 600, marginTop: 8 }}>{info}</div>

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
            {canEdit ? <><Plus size={14} /> Alimenter</> : 'Voir les versements'}
          </button>
          {canEdit && <button
            onClick={(ev) => { ev.stopPropagation(); form.openEdit(s); }}
            style={{
              padding: '9px 14px', borderRadius: 11,
              background: '#F5F7FF', color: '#A0D2EB',
              fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer',
            }}
          >
            <Pencil size={14} />
          </button>}
          {canEdit && <button
            onClick={(ev) => { ev.stopPropagation(); deletion.askDelete(s); }}
            style={{
              padding: '9px 14px', borderRadius: 11,
              background: '#FEECEC', color: '#DC2626',
              fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer',
            }}
          >
            <Trash2 size={14} />
          </button>}
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
            {canEdit && <button onClick={form.openCreate}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F9A825', color: 'white', border: 'none', borderRadius: 12, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(249,168,37,0.35)' }}>
              <Plus size={18} /> Nouvel objectif
            </button>}
          </div>
        </div>

        {loading ? <LoadingSpinner color="#F9A825" /> : (
          <div>
            <div className="desktop-budget-card" style={{ marginBottom: 24, padding: 24, background: 'linear-gradient(135deg, #81BAD8 0%, #CE9C4A 100%)', color: 'white', border: 'none', textShadow: '0 2px 4px rgba(0,0,0,0.15)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 12, opacity: .9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Patrimoine épargné
                  </div>
                  <div style={{ fontSize: 36, fontWeight: 900, marginTop: 4 }}>{fmt(totalSaved)}</div>
                  <div style={{ fontSize: 14, opacity: .9, fontWeight: 600, marginTop: 4 }}>
                    Ce mois : {fmt(savedThisMonth)} versés sur {fmt(plannedThisMonth)} prévus
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

        {loading ? <LoadingSpinner color="#F9A825" /> : (
          <>
            <div className="fade-up" style={{ padding: 20, background: 'linear-gradient(135deg, #81BAD8 0%, #CE9C4A 100%)', borderRadius: 18, color: 'white', marginBottom: 20, boxShadow: '0 4px 14px rgba(160,210,235,0.3)', textShadow: '0 2px 4px rgba(0,0,0,0.15)' }}>
              <div style={{ fontSize: 11, opacity: .9, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5 }}>
                Patrimoine épargné
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, marginTop: 4 }}>{fmt(totalSaved)}</div>
              <div style={{ fontSize: 12, opacity: .9, fontWeight: 600, marginTop: 4 }}>
                Ce mois : {fmt(savedThisMonth)} versés sur {fmt(plannedThisMonth)} prévus
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
      {canEdit && !form.showForm && (
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
