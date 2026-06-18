import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { useMonth } from '../../contexts/MonthContext';
import { useDashboard } from '../../contexts/DashboardContext';
import { formatMonthDate } from '../../lib/dateUtils';
import { useNavigate } from 'react-router-dom';
import { recurrenceService } from '../../services/recurrenceService';
import BottomNav from '../../components/layout/BottomNav';
import DesktopHeader from '../../components/layout/DesktopHeader';
import DesktopSidebar from '../../components/layout/DesktopSidebar';
import MonthSelector from '../../components/layout/MonthSelector';
import TopBar from '../../components/layout/TopBar';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import useDesktop from '../../hooks/useDesktop';
import {
  CreditCard, Mail, PiggyBank, Info, ChevronRight, AlertTriangle, Wallet,
  ArrowDownLeft, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, Sparkles, Repeat
} from 'lucide-react';
import { getIconComponent } from '../../lib/iconRegistry';

const IconBubble = ({ icon, color, size = 42 }) => {
  const IC = typeof icon === 'string' ? getIconComponent(icon) : icon;
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {IC && <IC size={size * 0.45} style={{ color }} />}
    </div>
  );
};

const ProgressLinear = ({ value, max, color }) => {
  const pct = Math.min(100, Math.max(0, (value / max) * 100)) || 0;
  return (
    <div style={{ height: 6, borderRadius: 999, background: "#EEF2FB", overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 999, transition: "width 0.4s ease" }} />
    </div>
  );
};

const BudgetDonut = ({ segments, total, size = 150, label, sublabel }) => {
  const r = 40, cx = 50, cy = 50;
  const circ = 2 * Math.PI * r; 
  const normalizedTotal = Math.max(total, 1);

  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#EEF2FB" strokeWidth={12} />
        <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth={12} stroke="#FFFFFF" />

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
            />
          );
        })}
      </svg>
      <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', textAlign: 'center' }}>
        <span style={{ fontSize: size * 0.18, fontWeight: 900, color: '#1a1a2e', display: 'block' }}>
          {label || `${Math.round(segments.reduce((a,s) => a+s.value, 0) / normalizedTotal * 100)}%`}
        </span>
        {sublabel && <span style={{ fontSize: size * 0.08, fontWeight: 700, color: '#B0B8C9', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>{sublabel}</span>}
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { selectedDate, setSelectedDate } = useMonth();
  const { activeDashboard, loading: dashLoading } = useDashboard();
  const navigate = useNavigate();
  const isDesktop = useDesktop();
  const [loading, setLoading] = useState(true);
  const [showForecast, setShowForecast] = useState(false);
  const [data, setData] = useState({ income: 0, fixedExp: 0, envExp: 0, savings: 0 });
  const [forecastData, setForecastData] = useState({ income: 0, fixedExp: 0, envExp: 0, savings: 0 });
  const [recentOps, setRecentOps] = useState([]);
  const [envelopesPreview, setEnvelopesPreview] = useState([]);

  useEffect(() => { 
    if (user) {
      if (activeDashboard) {
        fetchData();
      } else if (!dashLoading) {
        setLoading(false);
      }
    }
  }, [user, selectedDate, activeDashboard, dashLoading]);

  const fetchData = async () => {
    if (!activeDashboard) return;
    setLoading(true);
    try {
      await recurrenceService.checkAndApplyRecurrence(activeDashboard.id, selectedDate);
      const monthStr = formatMonthDate(selectedDate);
      const [
        { data: inc }, { data: exp }, { data: envExp }, { data: envs }, { data: sav }, { data: savEntries }
      ] = await Promise.all([
        supabase.from('incomes').select('id, amount, date, name, icon, color, is_recurrent').eq('dashboard_id', activeDashboard.id).eq('month_date', monthStr).eq('is_hidden', false),
        supabase.from('expenses').select('id, amount, date, name, icon, color, is_recurrent').eq('dashboard_id', activeDashboard.id).eq('month_date', monthStr).eq('is_hidden', false),
        supabase.from('envelope_expenses').select('id, amount, date, name, icon, color, envelope_id').eq('dashboard_id', activeDashboard.id).eq('month_date', monthStr),
        supabase.from('envelopes').select('id, name, max_amount, icon, color').eq('dashboard_id', activeDashboard.id).eq('month_date', monthStr).eq('is_hidden', false),
        supabase.from('savings').select('target_amount, month_date').eq('dashboard_id', activeDashboard.id).eq('month_date', monthStr).eq('is_hidden', false),
        supabase.from('saving_entries').select('id, amount, date, savings(name, icon, color)').eq('dashboard_id', activeDashboard.id).eq('month_date', monthStr),
      ]);

      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const isPastMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1) < new Date(now.getFullYear(), now.getMonth(), 1);
      const isFutureMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1) > new Date(now.getFullYear(), now.getMonth(), 1);

      const filterReal = (list, key = 'date') => (list || []).filter(item => {
        if (isPastMonth) return true;
        if (isFutureMonth) return false;
        return item[key] <= todayStr;
      });

      const totalIncForecast = (inc || []).reduce((a, c) => a + parseFloat(c.amount), 0);
      const totalIncReal = filterReal(inc).reduce((a, c) => a + parseFloat(c.amount), 0);
      const totalFixedForecast = (exp || []).reduce((a, c) => a + parseFloat(c.amount), 0);
      const totalFixedReal = filterReal(exp).reduce((a, c) => a + parseFloat(c.amount), 0);
      const totalEnvForecast = (envs || []).reduce((a, c) => a + parseFloat(c.max_amount), 0);
      const totalEnvReal = filterReal(envExp).reduce((a, c) => a + parseFloat(c.amount), 0);
      const totalSavForecast = (sav || []).reduce((a, c) => a + parseFloat(c.target_amount), 0);
      const totalSavReal = filterReal(savEntries).reduce((a, c) => a + parseFloat(c.amount), 0);

      setForecastData({ income: totalIncForecast, fixedExp: totalFixedForecast, envExp: totalEnvForecast, savings: totalSavForecast });
      setData({ income: totalIncReal, fixedExp: totalFixedReal, envExp: totalEnvReal, savings: totalSavReal });

      const recent = [
        ...(inc || []).map(i => ({ ...i, type: 'income', label: i.name })),
        ...(exp || []).map(e => ({ ...e, type: 'expense', label: e.name })),
        ...(envExp || []).map(e => ({ ...e, type: 'expense', label: e.name || 'Dépense' })),
        ...(savEntries || []).map(s => ({
          id: s.id,
          amount: s.amount,
          date: s.date,
          label: s.savings?.name || 'Épargne',
          icon: s.savings?.icon || 'PiggyBank',
          color: s.savings?.color || '#9B5CFF',
          type: 'expense'
        }))
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

      setRecentOps(recent);

      const envPreview = (envs || []).map(env => {
        const spent = filterReal(envExp).filter(ex => ex.envelope_id === env.id).reduce((a, c) => a + parseFloat(c.amount), 0);
        return {
          id: env.id,
          name: env.name,
          icon: env.icon,
          color: env.color,
          target: env.max_amount,
          spent
        };
      });
      setEnvelopesPreview(envPreview);

    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const activeData = showForecast ? forecastData : data;
  const balance = activeData.income - (activeData.fixedExp + activeData.envExp) - activeData.savings;
  const expenseTotal = activeData.fixedExp + activeData.envExp;

  const now = new Date();
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const viewingMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  const isCurrentMonth = currentMonth.getTime() === viewingMonth.getTime();
  const isPastMonth = viewingMonth.getTime() < currentMonth.getTime();
  const isFutureMonth = viewingMonth.getTime() > currentMonth.getTime();

  let tipMessage = null;
  if (isCurrentMonth) {
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysLeft = Math.max(lastDayOfMonth - now.getDate() + 1, 1); 
    if (showForecast) {
      const perDay = (forecastData.income - forecastData.fixedExp - forecastData.envExp - forecastData.savings) / 30;
      tipMessage = <>Prévisionnel : Fin de mois avec environ <strong>{balance.toLocaleString('fr-FR')} €</strong> ({perDay.toFixed(2)} €/j).</>;
    } else {
      if (balance >= 0) {
        const perDay = balance / daysLeft;
        tipMessage = <>Il reste <strong>{perDay.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</strong> / jour pour les {daysLeft} derniers jours.</>;
      } else {
        tipMessage = <>Budget dépassé de <strong>{Math.abs(balance).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</strong>. Attention aux dépenses non essentielles.</>;
      }
    }
  } else if (isPastMonth) {
    tipMessage = <>Bilan : Solde de <strong>{balance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</strong>. {balance >= 0 ? "Bravo !" : "On fera mieux !"}</>;
  } else if (isFutureMonth) {
    const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
    const perDay = balance / daysInMonth;
    tipMessage = <>Prévision : <strong>{perDay.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</strong> / jour.</>;
  }

  const donutSegments = [
    { color: '#5C6EFF', value: activeData.fixedExp },
    { color: '#9B5CFF', value: activeData.envExp },
    { color: '#F9A825', value: activeData.savings },
  ];

  const fmt = (n) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €';

  const dashboardContent = () => (
    <div style={{ display: 'grid', gap: isDesktop ? 20 : 16, gridTemplateColumns: isDesktop ? 'repeat(3, minmax(0, 1fr))' : 'minmax(0, 1fr)' }}>
      
      {/* Hero Card */}
      <div className="fade-up" style={{ 
        gridColumn: isDesktop ? 'span 2' : 'span 1',
        padding: isDesktop ? 24 : 20, 
        background: 'linear-gradient(135deg, #5C6EFF 0%, #9B5CFF 100%)', 
        borderRadius: isDesktop ? 24 : 20, 
        color: 'white', 
        boxShadow: '0 10px 30px rgba(92,110,255,0.3)', 
        position: 'relative', 
        overflow: 'hidden' 
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, opacity: .85 }}>Reste à vivre {showForecast ? '(Prévu)' : '(Réel)'}</div>
            <div style={{ fontSize: isDesktop ? 44 : 36, fontWeight: 900, marginTop: 6, letterSpacing: -1 }}>{fmt(balance)}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,.18)", color: "#fff", padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                <ArrowUpRight size={11} /> {fmt(activeData.income)}
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,.18)", color: "#fff", padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                <ArrowDownRight size={11} /> {fmt(expenseTotal)}
              </span>
            </div>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: "rgba(255,255,255,.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Sparkles size={22} />
          </div>
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,.18)", margin: "16px 0" }} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: isDesktop ? 16 : 8 }}>
          {[
            { label: "Revenus", value: fmt(activeData.income), icon: TrendingUp },
            { label: "Dépensé", value: fmt(expenseTotal), icon: TrendingDown },
            { label: "Épargne", value: fmt(activeData.savings), icon: PiggyBank },
          ].map((s) => (
            <div key={s.label}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, opacity: .8, fontSize: 10, fontWeight: 600 }}>
                <s.icon size={11} /> {s.label}
              </div>
              <div style={{ fontSize: isDesktop ? 16 : 14, fontWeight: 800, marginTop: 3, letterSpacing: -0.2 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Conseil inside Hero */}
        <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 16, marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: isDesktop ? 'center' : 'flex-start', gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Info size={16} color="white" />
            </div>
            <div style={{ flex: 1, minWidth: 0, display: isDesktop ? 'flex' : 'block', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.9, marginBottom: isDesktop ? 0 : 2, whiteSpace: isDesktop ? 'nowrap' : 'normal' }}>
                Conseil du mois {isDesktop && ':'}
              </div>
              <p style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.4, opacity: 0.95, margin: 0, wordBreak: 'break-word', whiteSpace: 'normal' }}>
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
            { icon: Wallet, label: "Enveloppes", color: "#5C6EFF", path: '/envelopes' },
            { icon: PiggyBank, label: "Épargne", color: "#9B5CFF", path: '/savings' },
          ].map((a) => (
            <button key={a.label} onClick={() => navigate(a.path, { state: { date: selectedDate } })} style={{ background: 'white', borderRadius: 16, padding: '12px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
              <div style={{ width: 36, height: 36, borderRadius: 12, background: `${a.color}1A`, color: a.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <a.icon size={18} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#1a1a2e' }}>{a.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Donut Budget Card */}
      <div className="card fade-up" style={{ padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', animationDelay: isDesktop ? '40ms' : '80ms' }}>
        <div style={{ width: '100%', fontSize: 16, fontWeight: 800, color: '#1a1a2e', marginBottom: 20, display: 'flex', justifyContent: 'flex-start' }}>Budget du mois</div>
        <BudgetDonut 
          segments={donutSegments} 
          total={activeData.income || 1} 
          size={160}
          label={`${activeData.income > 0 ? Math.round((expenseTotal / activeData.income) * 100) : 0}%`}
          sublabel="utilisé"
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, width: '100%', marginTop: 24 }}>
          <div style={{ background: "#F5F7FF", borderRadius: 12, padding: "12px 8px", textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: "#B0B8C9", fontWeight: 700, textTransform: "uppercase" }}>Dépensé</div>
            <div style={{ fontWeight: 800, color: "#1a1a2e", marginTop: 4, fontSize: 14 }}>{fmt(expenseTotal)}</div>
          </div>
          <div style={{ background: "#F5F7FF", borderRadius: 12, padding: "12px 8px", textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: "#B0B8C9", fontWeight: 700, textTransform: "uppercase" }}>Revenus</div>
            <div style={{ fontWeight: 800, color: "#1a1a2e", marginTop: 4, fontSize: 14 }}>{fmt(activeData.income)}</div>
          </div>
        </div>
      </div>

      {/* Dernières opérations */}
      <div className="card fade-up" style={{ gridColumn: isDesktop ? 'span 2' : 'span 1', padding: 20, animationDelay: isDesktop ? '80ms' : '120ms' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#1a1a2e' }}>Dernières opérations</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {recentOps.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: '#B0B8C9', fontSize: 13, fontWeight: 600 }}>Aucune opération ce mois-ci</div>
          ) : recentOps.map((t, i) => (
            <div key={`${t.id}-${i}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderTop: i === 0 ? "none" : "1px solid #F1F4FB", borderTopWidth: i === 0 ? 0 : 1, borderTopStyle: 'solid', borderTopColor: '#F1F4FB' }}>
              <IconBubble icon={t.icon || 'ShoppingCart'} color={t.color || '#5C6EFF'} size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ fontWeight: 700, color: "#1a1a2e", fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.label}
                  </div>
                  {t.is_recurrent && <Repeat size={11} style={{ color: "#5C6EFF", flexShrink: 0 }} />}
                </div>
                <div style={{ fontSize: 11, color: "#B0B8C9", fontWeight: 600, marginTop: 2 }}>
                  {new Date(t.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                </div>
              </div>
              <div style={{ fontWeight: 800, fontSize: 14, color: t.type === 'income' ? '#16A34A' : '#1a1a2e', whiteSpace: "nowrap" }}>
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
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1a1a2e' }}>Enveloppes</div>
            <button onClick={() => navigate('/envelopes', { state: { date: selectedDate } })} style={{ background: 'none', border: 'none', color: "#5C6EFF", fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Gérer</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {envelopesPreview.slice(0, 4).map((e) => {
              const pct = Math.round((e.spent / e.target) * 100);
              return (
                <div key={e.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <IconBubble icon={e.icon} color={e.color} size={28} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#1a1a2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</div>
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
      <div className="desktop-shell fade-in">
        <DesktopHeader />
        <div className="desktop-body">
          <DesktopSidebar />
          <main className="desktop-main">
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

            {loading ? <LoadingSpinner /> : dashboardContent()}

          </main>
        </div>
      </div>
    );
  }

  // MOBILE
  return (
    <div className="fade-in pb-fab-spacer" style={{ minHeight: '100vh', background: '#EEF2FB' }}>
      <TopBar title="Vue d'ensemble" />

      <div style={{ padding: '20px 16px', maxWidth: 480, margin: '0 auto' }}>
        <MonthSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16, marginBottom: 24 }}>
          <div style={{ background: 'white', borderRadius: 14, padding: 4, display: 'flex', gap: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid #E8ECFF' }}>
            <button onClick={() => setShowForecast(false)} style={{ border: 'none', padding: '8px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', background: !showForecast ? '#5C6EFF' : 'transparent', color: !showForecast ? 'white' : '#B0B8C9' }}>Réel</button>
            <button onClick={() => setShowForecast(true)} style={{ border: 'none', padding: '8px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', background: showForecast ? '#5C6EFF' : 'transparent', color: showForecast ? 'white' : '#B0B8C9' }}>Prévisions</button>
          </div>
        </div>

        {loading ? <LoadingSpinner /> : dashboardContent()}

      </div>
      <BottomNav />
    </div>
  );
};

export default Dashboard;
