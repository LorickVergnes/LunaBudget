import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { useMonth } from '../../contexts/MonthContext';
import { useDashboardQuery } from '../../hooks/useDashboardQuery';
import { formatMonthDate, getTodayStr, parseLocalDate } from '../../lib/dateUtils';
import {
  getMonthStatus, isRealized, filterRealized, sumAmounts, computeBalance, computeMonthTotals,
  getDaysLeftInMonth, getDaysInMonth
} from '../../lib/budgetCalculations';
import { filterActiveGoals } from '../../lib/savingsGoals';
import { useNavigate } from 'react-router-dom';
import MonthSelector from '../../components/layout/MonthSelector';
import TopBar from '../../components/layout/TopBar';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import LoadError from '../../components/ui/LoadError';
import useDesktop from '../../hooks/useDesktop';
import {
  PiggyBank, Info, Wallet, ArrowDownLeft, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, Sparkles, Repeat
} from 'lucide-react';
import IconBubble from '../../components/ui/IconBubble';

const ProgressLinear = ({ value, max, color }) => {
  const pct = Math.min(100, Math.max(0, (value / max) * 100)) || 0;
  return (
    <div style={{ height: 6, borderRadius: 999, background: "#F4F7F6", overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 999, transition: "width 0.4s ease" }} />
    </div>
  );
};

// Couleurs des trois parts du budget : choisies pour rester distinctes entre elles,
// y compris pour les personnes daltoniennes. La légende sous l'anneau porte les libellés et les montants.
const BUDGET_PARTS = [
  { key: 'fixedExp', label: 'Dépenses fixes', color: '#C98A1F' },
  { key: 'envExp', label: 'Enveloppes', color: '#3D94C9' },
  { key: 'savings', label: 'Épargne', color: '#7C5CE0' },
];

const BudgetDonut = ({ segments, total, size = 150, label, sublabel }) => {
  const r = 40, cx = 50, cy = 50;
  const circ = 2 * Math.PI * r;
  // L'anneau entier représente les revenus ; si le budget les dépasse, il représente le total engagé
  const normalizedTotal = Math.max(total, segments.reduce((sum, seg) => sum + seg.value, 0), 1);

  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
      <svg width={size} height={size} viewBox="0 0 100 100">
        {/* Piste : la part des revenus qui n'est pas engagée */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#EEF1F6" strokeWidth={12} />

        {segments.map((seg, i) => {
          const pct = seg.value / normalizedTotal;
          if (pct <= 0) return null;
          const dashLength = Math.max(0, pct * circ - 1.5);
          const previousValue = segments.slice(0, i).reduce((a, s) => a + s.value, 0);
          const offset = -(previousValue / normalizedTotal * circ);

          return (
            <circle
              key={i} cx={cx} cy={cy} r={r} fill="none" strokeWidth={12}
              stroke={seg.color} strokeDasharray={`${dashLength} ${circ}`}
              strokeDashoffset={offset} strokeLinecap="butt"
              style={{
                transform: 'rotate(-90deg)', transformOrigin: '50px 50px',
                transition: 'stroke-dasharray 0.8s ease, stroke-dashoffset 0.8s ease'
              }}
            >
              {seg.title && <title>{seg.title}</title>}
            </circle>
          );
        })}
      </svg>
      <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', textAlign: 'center' }}>
        <span style={{ fontSize: size * 0.18, fontWeight: 900, color: '#4A6984', display: 'block' }}>
          {label}
        </span>
        {sublabel && <span style={{ fontSize: size * 0.08, fontWeight: 700, color: '#B0B8C9', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>{sublabel}</span>}
      </div>
    </div>
  );
};

const NO_TOTALS = { income: 0, fixedExp: 0, envExp: 0, savings: 0 };
const EMPTY_OVERVIEW = { data: NO_TOTALS, forecastData: NO_TOTALS, operations: [], envelopesPreview: [] };

const Dashboard = () => {
  const { user } = useAuth();
  const { selectedDate, setSelectedDate } = useMonth();
  const navigate = useNavigate();
  const isDesktop = useDesktop();
  const [showForecast, setShowForecast] = useState(false);
  const month = formatMonthDate(selectedDate);

  const { data: overview = EMPTY_OVERVIEW, loading, error, retry } = useDashboardQuery('overview', [month], async (dashboardId, { applyRecurrence }) => {
    await applyRecurrence(selectedDate);
    const monthStr = month;
    const results = await Promise.all([
      supabase.from('incomes').select('id, amount, date, name, icon, color, is_recurrent').eq('dashboard_id', dashboardId).eq('month_date', monthStr).eq('is_hidden', false),
      supabase.from('expenses').select('id, amount, date, name, icon, color, is_recurrent').eq('dashboard_id', dashboardId).eq('month_date', monthStr).eq('is_hidden', false),
      supabase.from('envelope_expenses').select('id, amount, date, name, icon, color, envelope_id').eq('dashboard_id', dashboardId).eq('month_date', monthStr),
      supabase.from('envelopes').select('id, name, max_amount, icon, color').eq('dashboard_id', dashboardId).eq('month_date', monthStr).eq('is_hidden', false),
      supabase.from('savings').select('monthly_amount, start_month, end_month').eq('dashboard_id', dashboardId),
      supabase.from('saving_entries').select('id, amount, date, savings(name, icon, color)').eq('dashboard_id', dashboardId).eq('month_date', monthStr),
    ]);
    const failed = results.find(result => result.error);
    if (failed) throw failed.error;
    const [{ data: inc }, { data: exp }, { data: envExp }, { data: envs }, { data: sav }, { data: savEntries }] = results;

    const todayStr = getTodayStr();
    const monthStatus = getMonthStatus(selectedDate);

    const { real, forecast } = computeMonthTotals(
      { incomes: inc, expenses: exp, envelopes: envs, envelopeExpenses: envExp, savings: filterActiveGoals(sav, monthStr), savingEntries: savEntries },
      monthStatus,
      todayStr
    );

    // Toutes les opérations du mois, la plus récente en premier. `realized` distingue ce qui est
    // déjà arrivé de ce qui est seulement prévu (un récurrent daté de la fin du mois, par exemple).
    const operations = [
      ...(inc || []).map(i => ({ ...i, type: 'income', label: i.name })),
      ...(exp || []).map(e => ({ ...e, type: 'expense', label: e.name })),
      ...(envExp || []).map(e => ({ ...e, type: 'expense', label: e.name || 'Dépense' })),
      ...(savEntries || []).map(s => ({
        id: s.id,
        amount: s.amount,
        date: s.date,
        label: s.savings?.name || 'Épargne',
        icon: s.savings?.icon || 'PiggyBank',
        color: s.savings?.color || '#E5BA73',
        type: 'expense'
      }))
    ].map(op => ({ ...op, realized: isRealized(op.date, monthStatus, todayStr) }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const realEnvExp = filterRealized(envExp, monthStatus, todayStr);
    const envPreview = (envs || []).map(env => {
      const spent = sumAmounts(realEnvExp.filter(ex => ex.envelope_id === env.id));
      return {
        id: env.id,
        name: env.name,
        icon: env.icon,
        color: env.color,
        target: env.max_amount,
        spent
      };
    });

    return { data: real, forecastData: forecast, operations, envelopesPreview: envPreview };
  });
  const { data, forecastData, operations, envelopesPreview } = overview;
  // En réel, « dernières opérations » ne montre que ce qui est déjà arrivé
  const recentOps = (showForecast ? operations : operations.filter(op => op.realized)).slice(0, 5);

  const activeData = showForecast ? forecastData : data;
  const balance = computeBalance(activeData);
  const expenseTotal = activeData.fixedExp + activeData.envExp;
  // Tout ce qui est engagé sur les revenus : c'est ce que montre l'anneau, épargne comprise
  const committedTotal = expenseTotal + activeData.savings;

  const now = new Date();
  const monthStatus = getMonthStatus(selectedDate, now);

  let tipMessage = null;
  if (monthStatus === 'current') {
    const daysLeft = getDaysLeftInMonth(now);
    if (showForecast) {
      const perDay = computeBalance(forecastData) / getDaysInMonth(selectedDate);
      tipMessage = <>Prévisionnel : Fin de mois avec environ <strong>{balance.toLocaleString('fr-FR')} €</strong> ({perDay.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/j).</>;
    } else {
      if (balance >= 0) {
        const perDay = balance / daysLeft;
        tipMessage = <>Il reste <strong>{perDay.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</strong> / jour pour les {daysLeft} derniers jours.</>;
      } else {
        tipMessage = <>Budget dépassé de <strong>{Math.abs(balance).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</strong>. Attention aux dépenses non essentielles.</>;
      }
    }
  } else if (monthStatus === 'past') {
    tipMessage = <>Bilan : Solde de <strong>{balance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</strong>. {balance >= 0 ? "Bravo !" : "On fera mieux !"}</>;
  } else {
    const perDay = balance / getDaysInMonth(selectedDate);
    tipMessage = <>Prévision : <strong>{perDay.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</strong> / jour.</>;
  }

  const fmt = (n) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €';

  const donutSegments = BUDGET_PARTS.map(part => ({
    ...part,
    value: activeData[part.key],
    title: `${part.label} : ${fmt(activeData[part.key])}`,
  }));

  const dashboardContent = () => (
    <div style={{ display: 'grid', gap: isDesktop ? 20 : 16, gridTemplateColumns: isDesktop ? 'repeat(3, minmax(0, 1fr))' : 'minmax(0, 1fr)' }}>

      {/* Hero Card */}
      <div className="fade-up" style={{
        gridColumn: isDesktop ? 'span 2' : 'span 1',
        padding: isDesktop ? 24 : 20,
        background: 'linear-gradient(135deg, #81BAD8 0%, #CE9C4A 100%)',
        borderRadius: isDesktop ? 24 : 20,
        color: 'white',
        textShadow: '0 2px 4px rgba(0,0,0,0.15)',
        boxShadow: '0 10px 30px rgba(160,210,235,0.3)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, opacity: .9 }}>Reste à vivre {showForecast ? '(Prévu)' : '(Réel)'}</div>
            <div style={{ fontSize: isDesktop ? 44 : 36, fontWeight: 900, marginTop: 6, letterSpacing: -1 }}>{fmt(balance)}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(0,0,0,0.15)", color: "#fff", padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, textShadow: 'none' }}>
                <ArrowUpRight size={11} /> {fmt(activeData.income)}
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(0,0,0,0.15)", color: "#fff", padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, textShadow: 'none' }}>
                <ArrowDownRight size={11} /> {fmt(expenseTotal)}
              </span>
            </div>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: "rgba(0,0,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Sparkles size={22} color="white" />
          </div>
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,.25)", margin: "16px 0", boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: isDesktop ? 16 : 8 }}>
          {[
            { label: "Revenus", value: fmt(activeData.income), icon: TrendingUp },
            { label: "Dépensé", value: fmt(expenseTotal), icon: TrendingDown },
            { label: "Épargne", value: fmt(activeData.savings), icon: PiggyBank },
          ].map((s) => (
            <div key={s.label}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, opacity: .9, fontSize: 10, fontWeight: 600 }}>
                <s.icon size={11} /> {s.label}
              </div>
              <div style={{ fontSize: isDesktop ? 16 : 14, fontWeight: 800, marginTop: 3, letterSpacing: -0.2 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Conseil inside Hero */}
        <div style={{ background: 'rgba(0,0,0,0.12)', borderRadius: 16, padding: 16, marginTop: 16, border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: isDesktop ? 'center' : 'flex-start', gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Info size={16} color="white" />
            </div>
            <div style={{ flex: 1, minWidth: 0, display: isDesktop ? 'flex' : 'block', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.95, marginBottom: isDesktop ? 0 : 2, whiteSpace: isDesktop ? 'nowrap' : 'normal' }}>
                Conseil du mois {isDesktop && ':'}
              </div>
              <p style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.4, opacity: 0.95, margin: 0, wordBreak: 'break-word', whiteSpace: 'normal', textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                {tipMessage}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions (Mobile Only) */}
      {!isDesktop && (
        <div className="fade-up" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, animationDelay: '40ms' }}>
          {[
            { icon: ArrowDownLeft, label: "Revenus", color: "#22C55E", path: '/incomes' },
            { icon: ArrowUpRight, label: "Dépenses", color: "#EF4444", path: '/expenses' },
            { icon: Wallet, label: "Enveloppes", color: "#A0D2EB", path: '/envelopes' },
            { icon: PiggyBank, label: "Épargne", color: "#E5BA73", path: '/savings' },
          ].map((a) => (
            <button key={a.label} onClick={() => navigate(a.path, { state: { date: selectedDate } })} style={{ background: 'white', borderRadius: 16, padding: '12px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
              <div style={{ width: 36, height: 36, borderRadius: 12, background: `${a.color}1A`, color: a.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <a.icon size={18} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#4A6984' }}>{a.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Donut Budget Card */}
      <div className="card fade-up" style={{ padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', animationDelay: isDesktop ? '40ms' : '80ms' }}>
        <div style={{ width: '100%', fontSize: 16, fontWeight: 800, color: '#4A6984', marginBottom: 20, display: 'flex', justifyContent: 'flex-start' }}>Budget du mois</div>
        <BudgetDonut
          segments={donutSegments}
          total={activeData.income}
          size={160}
          label={activeData.income > 0 ? `${Math.round((committedTotal / activeData.income) * 100)}%` : '—'}
          sublabel="des revenus"
        />
        {/* Légende : chaque part de l'anneau avec son montant, puis le total rapporté aux revenus */}
        <ul style={{ listStyle: 'none', padding: 0, margin: '20px 0 0', width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {donutSegments.map(seg => (
            <li key={seg.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: seg.color, flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, color: '#4A6984', fontWeight: 600 }}>{seg.label}</span>
              <span style={{ color: '#4A6984', fontWeight: 800, whiteSpace: 'nowrap' }}>{fmt(seg.value)}</span>
            </li>
          ))}
          <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, borderTop: '1px solid #F1F4FB', paddingTop: 8 }}>
            <span style={{ flex: 1, minWidth: 0, color: '#6B7280', fontWeight: 600, whiteSpace: 'nowrap' }}>Total</span>
            <span style={{ color: '#6B7280', fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(committedTotal)} sur {fmt(activeData.income)}</span>
          </li>
        </ul>
      </div>

      {/* Dernières opérations */}
      <div className="card fade-up" style={{ gridColumn: isDesktop ? 'span 2' : 'span 1', padding: 20, animationDelay: isDesktop ? '80ms' : '120ms' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#4A6984' }}>Dernières opérations</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {recentOps.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: '#B0B8C9', fontSize: 13, fontWeight: 600 }}>
              {operations.length > 0 ? "Aucune opération réalisée pour l'instant" : 'Aucune opération ce mois-ci'}
            </div>
          ) : recentOps.map((t, i) => (
            <div key={`${t.id}-${i}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderTop: i === 0 ? "none" : "1px solid #F1F4FB", borderTopWidth: i === 0 ? 0 : 1, borderTopStyle: 'solid', borderTopColor: '#F1F4FB' }}>
              <IconBubble icon={t.icon || 'ShoppingCart'} color={t.color || '#A0D2EB'} size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ fontWeight: 700, color: "#4A6984", fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.label}
                  </div>
                  {t.is_recurrent && <Repeat size={11} style={{ color: "#A0D2EB", flexShrink: 0 }} />}
                  {!t.realized && <span style={{ fontSize: 10, color: '#B7791F', fontWeight: 700, flexShrink: 0 }}>Prévu</span>}
                </div>
                <div style={{ fontSize: 11, color: "#B0B8C9", fontWeight: 600, marginTop: 2 }}>
                  {parseLocalDate(t.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                </div>
              </div>
              <div style={{ fontWeight: 800, fontSize: 14, color: t.type === 'income' ? '#16A34A' : '#4A6984', whiteSpace: "nowrap" }}>
                {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Envelopes preview */}
      {envelopesPreview.length > 0 && (
        <div className="card fade-up" style={{ padding: 20, animationDelay: isDesktop ? '120ms' : '160ms' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#4A6984' }}>Enveloppes</div>
            <button onClick={() => navigate('/envelopes', { state: { date: selectedDate } })} style={{ background: 'none', border: 'none', color: "#A0D2EB", fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Gérer</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {envelopesPreview.slice(0, 4).map((e) => {
              const pct = Math.round((e.spent / e.target) * 100);
              return (
                <div key={e.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <IconBubble icon={e.icon} color={e.color} size={28} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#4A6984", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</div>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: pct >= 100 ? "#EF4444" : "#B0B8C9" }}>
                      {fmt(e.spent)} / {fmt(e.target)}
                    </div>
                  </div>
                  <ProgressLinear value={e.spent} max={e.target} color={e.color} />
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );

  if (isDesktop) {
    const greeting = (() => {
      const h = now.getHours();
      const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Utilisateur';
      if (h < 12) return `Bonjour, ${name} 👋`;
      if (h < 18) return `Bon après-midi, ${name} 👋`;
      return `Bonsoir, ${name} 👋`;
    })();

    return (
      <>
        <div className="desktop-greeting-toprow">
          <div className="desktop-greeting">
            <h1>{greeting}</h1>
            <p>Suivez votre budget, contrôlez vos dépenses et atteignez vos objectifs.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <MonthSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />
            <div className="desktop-toggle">
              <button className={`desktop-toggle-btn${!showForecast ? ' desktop-toggle-btn--active' : ''}`} onClick={() => setShowForecast(false)}>Réel</button>
              <button className={`desktop-toggle-btn${showForecast ? ' desktop-toggle-btn--active' : ''}`} onClick={() => setShowForecast(true)}>Prévisions</button>
            </div>
          </div>
        </div>

        {loading ? <LoadingSpinner /> : error ? <LoadError onRetry={retry} /> : dashboardContent()}
      </>
    );
  }

  // MOBILE
  return (
    <div className="fade-in pb-fab-spacer" style={{ minHeight: '100vh', background: 'transparent' }}>
      <TopBar title="Vue d'ensemble" />

      <div style={{ padding: '20px 16px', maxWidth: 480, margin: '0 auto' }}>
        <MonthSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16, marginBottom: 24 }}>
          <div style={{ background: 'white', borderRadius: 14, padding: 4, display: 'flex', gap: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid #E8ECFF' }}>
            <button onClick={() => setShowForecast(false)} style={{ border: 'none', padding: '8px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', background: !showForecast ? '#A0D2EB' : 'transparent', color: !showForecast ? 'white' : '#B0B8C9' }}>Réel</button>
            <button onClick={() => setShowForecast(true)} style={{ border: 'none', padding: '8px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', background: showForecast ? '#A0D2EB' : 'transparent', color: showForecast ? 'white' : '#B0B8C9' }}>Prévisions</button>
          </div>
        </div>

        {loading ? <LoadingSpinner /> : error ? <LoadError onRetry={retry} /> : dashboardContent()}

      </div>
    </div>
  );
};

export default Dashboard;
