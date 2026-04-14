import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { useMonth } from '../../contexts/MonthContext';
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
  CreditCard, Mail, PiggyBank, Info, ChevronRight, AlertTriangle, Wallet
} from 'lucide-react';

/* ── Budget Donut SVG chart ── */
const BudgetDonut = ({ segments, total, size = 150 }) => {
  const r = 40, cx = 50, cy = 50;
  const circ = 2 * Math.PI * r; 
  const normalizedTotal = Math.max(total, 1);

  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <svg width={size} height={size} viewBox="0 0 100 100">
        {/* Background track (Light gray) */}
        <circle 
          cx={cx} cy={cy} r={r} 
          fill="none" 
          stroke="#EEF2FB" 
          strokeWidth={12} 
        />
        
        {/* Separator background (White) */}
        <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth={12} stroke="#FFFFFF" />

        {segments.map((seg, i) => {
          const pct = seg.value / normalizedTotal;
          if (pct <= 0) return null;
          
          // Subtract small amount to show white separator
          const dashLength = Math.max(0, pct * circ - 1.5);
          const previousValue = segments.slice(0, i).reduce((a, s) => a + s.value, 0);
          const offset = -(previousValue / normalizedTotal * circ);

          return (
            <circle 
              key={i} 
              cx={cx} cy={cy} r={r} 
              fill="none" 
              strokeWidth={12}
              stroke={seg.color}
              strokeDasharray={`${dashLength} ${circ}`}
              strokeDashoffset={offset}
              strokeLinecap="butt"
              style={{ 
                transform: 'rotate(-90deg)', 
                transformOrigin: '50px 50px',
                transition: 'stroke-dasharray 0.8s ease, stroke-dashoffset 0.8s ease'
              }}
            />
          );
        })}
      </svg>
      {/* Percentage in middle */}
      <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <span style={{ fontSize: 16, fontWeight: 900, color: '#1a1a2e' }}>
          {Math.round(segments.reduce((a,s) => a+s.value, 0) / normalizedTotal * 100)}%
        </span>
      </div>
    </div>
  );
};

/* ── Row item (mobile) ── */
const BudgetRow = ({ icon: Icon, label, amount, color, onClick }) => (
  <button onClick={onClick}
    style={{ display: 'flex', alignItems: 'center', width: '100%', background: 'none', border: 'none', cursor: onClick ? 'pointer' : 'default', padding: '14px 0', borderBottom: '1px solid #F5F7FF', textAlign: 'left' }}>
    <div style={{ width: 40, height: 40, borderRadius: 12, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 14, flexShrink: 0 }}>
      <Icon size={20} style={{ color }} />
    </div>
    <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: '#1a1a2e' }}>{label}</span>
    <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>
      {typeof amount === 'number' ? amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €' : amount}
    </span>
    {onClick && <ChevronRight size={16} style={{ color: '#B0B8C9', marginLeft: 8 }} />}
  </button>
);

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { selectedDate, setSelectedDate } = useMonth();
  const navigate = useNavigate();
  const isDesktop = useDesktop();
  const [loading, setLoading] = useState(true);
  const [showForecast, setShowForecast] = useState(false);
  const [data, setData] = useState({ income: 0, fixedExp: 0, envExp: 0, savings: 0 });
  const [forecastData, setForecastData] = useState({ income: 0, fixedExp: 0, envExp: 0, savings: 0 });

  useEffect(() => { if (user) fetchData(); }, [user, selectedDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      await recurrenceService.checkAndApplyRecurrence(user.id, selectedDate);
      const monthStr = formatMonthDate(selectedDate);
      const [{ data: inc }, { data: exp }, { data: envExp }, { data: envs }, { data: sav }, { data: savEntries }] = await Promise.all([
        supabase.from('incomes').select('amount, date').eq('user_id', user.id).eq('month_date', monthStr).eq('is_hidden', false),
        supabase.from('expenses').select('amount, date').eq('user_id', user.id).eq('month_date', monthStr).eq('is_hidden', false),
        supabase.from('envelope_expenses').select('amount, date').eq('user_id', user.id).eq('month_date', monthStr),
        supabase.from('envelopes').select('max_amount').eq('user_id', user.id).eq('month_date', monthStr).eq('is_hidden', false),
        supabase.from('savings').select('target_amount, month_date').eq('user_id', user.id).eq('month_date', monthStr).eq('is_hidden', false),
        supabase.from('saving_entries').select('amount, date').eq('user_id', user.id).eq('month_date', monthStr),
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

    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const activeData = showForecast ? forecastData : data;
  const balance = activeData.income - (activeData.fixedExp + activeData.envExp) - activeData.savings;

  // Logic for coaching message
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
      tipMessage = <>Prévisionnel : Vous devriez finir le mois avec environ <strong>{balance.toLocaleString('fr-FR')} €</strong> soit <strong>{perDay.toFixed(2)} €</strong>/jour en moyenne.</>;
    } else {
      if (balance >= 0) {
        const perDay = balance / daysLeft;
        tipMessage = (
          <>Il vous reste <strong style={{ color: '#22c55e' }}>{perDay.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</strong> par jour pour finir sereinement les <strong>{daysLeft}</strong> derniers jours du mois.</>
        );
      } else {
        tipMessage = (
          <>Budget dépassé de <strong style={{ color: '#ef4444' }}>{Math.abs(balance).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</strong>. Attention, il reste <strong>{daysLeft} jours</strong> : essayez de limiter les dépenses non essentielles.</>
        );
      }
    }
  } else if (isPastMonth) {
    tipMessage = (
      <>Bilan : Ce mois s'est terminé avec un solde de <strong style={{ color: balance >= 0 ? '#22c55e' : '#ef4444' }}>{balance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</strong>. {balance >= 0 ? "Bravo !" : "On fera mieux le mois prochain !"}</>
    );
  } else if (isFutureMonth) {
    const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
    const perDay = balance / daysInMonth;
    tipMessage = (
      <>Prévision : Pour ce mois, vous disposerez d'un budget quotidien de <strong style={{ color: balance >= 0 ? '#22c55e' : '#ef4444' }}>{perDay.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</strong>.</>
    );
  }

  const donutSegments = [
    { color: '#5C6EFF', value: activeData.fixedExp },
    { color: '#9B5CFF', value: activeData.envExp },
    { color: '#F9A825', value: activeData.savings },
  ];

  const fmt = (n) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €';

  // ──────────────────────────────────────────────
  // DESKTOP LAYOUT
  // ──────────────────────────────────────────────
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

            {/* ── Top row: greeting + month selector + toggle ── */}
            <div className="desktop-greeting-toprow">
              <div className="desktop-greeting">
                <h1>{greeting}</h1>
                <p>Suivez votre budget, contrôlez vos dépenses et atteignez vos objectifs.</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <MonthSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />
                <div className="desktop-toggle">
                  <button
                    className={`desktop-toggle-btn${!showForecast ? ' desktop-toggle-btn--active' : ''}`}
                    onClick={() => setShowForecast(false)}
                  >
                    Réel
                  </button>
                  <button
                    className={`desktop-toggle-btn${showForecast ? ' desktop-toggle-btn--active' : ''}`}
                    onClick={() => setShowForecast(true)}
                  >
                    Prévisions
                  </button>
                </div>
              </div>
            </div>

            {loading ? (
              <LoadingSpinner />
            ) : (
              <>
                {/* ── KPI row ── */}
                <div className="desktop-kpi-row">
                  {/* Solde restant — highlight */}
                  <div className="desktop-kpi-card desktop-kpi-card--highlight">
                    <div className="desktop-kpi-label">
                      <span>Solde {showForecast ? 'Prévu' : 'Réel'}</span>
                      <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Wallet size={18} color="white" />
                      </div>
                    </div>
                    <div className="desktop-kpi-value" style={{ color: balance >= 0 ? 'white' : '#ffa5a5' }}>
                      {fmt(balance)}
                    </div>
                    <div className="desktop-kpi-subtext">
                      {balance >= 0 ? '✓ Budget respecté ce mois' : '⚠ Budget dépassé ce mois'}
                    </div>
                  </div>

                  {/* Revenus */}
                  <div className="desktop-kpi-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/incomes', { state: { date: selectedDate } })}>
                    <div className="desktop-kpi-label">
                      <span>Revenus</span>
                      <div className="desktop-kpi-icon" style={{ background: '#5C6EFF18' }}>
                        <CreditCard size={18} color="#5C6EFF" />
                      </div>
                    </div>
                    <div className="desktop-kpi-value">{fmt(activeData.income)}</div>
                    <div className="desktop-kpi-subtext">Ce mois</div>
                  </div>

                  {/* Total Dépenses */}
                  <div className="desktop-kpi-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/expenses', { state: { date: selectedDate } })}>
                    <div className="desktop-kpi-label">
                      <span>Total Dépenses</span>
                      <div className="desktop-kpi-icon" style={{ background: '#9B5CFF18' }}>
                        <Mail size={18} color="#9B5CFF" />
                      </div>
                    </div>
                    <div className="desktop-kpi-value">{fmt(activeData.fixedExp + activeData.envExp)}</div>
                    <div className="desktop-kpi-subtext">Fixes + Enveloppes</div>
                  </div>
                </div>

                {/* ── Main grid: budget rows + donut ── */}
                <div className="desktop-main-grid">
                  {/* Budget detail card */}
                  <div className="desktop-budget-card">
                    <p className="desktop-card-title">Entrées et sorties d'argent</p>

                    {[
                      { icon: CreditCard, label: 'Revenus', amount: activeData.income, color: '#5C6EFF', path: '/incomes' },
                      { icon: CreditCard, label: 'Dépenses fixes', amount: activeData.fixedExp, color: '#9B5CFF', path: '/expenses' },
                      { icon: Mail, label: 'Dépenses enveloppes', amount: activeData.envExp, color: '#5CBEFF', path: '/envelopes' },
                      { icon: PiggyBank, label: 'Épargne', amount: activeData.savings, color: '#F9A825', path: '/savings' },
                    ].map(({ icon: Icon, label, amount, color, path }) => (
                      <button
                        key={label}
                        className="desktop-budget-row"
                        onClick={() => navigate(path, { state: { date: selectedDate } })}
                      >
                        <div className="desktop-budget-row-icon" style={{ background: `${color}18` }}>
                          <Icon size={20} style={{ color }} />
                        </div>
                        <span className="desktop-budget-row-label">{label}</span>
                        <span className="desktop-budget-row-amount">{fmt(amount)}</span>
                        <ChevronRight size={15} style={{ color: '#B0B8C9', marginLeft: 10 }} />
                      </button>
                    ))}

                    {/* Total row */}
                    <div className="desktop-budget-total-row">
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: balance >= 0 ? '#E8FFE8' : '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                        <span style={{ fontSize: 18 }}>💳</span>
                      </div>
                      <span style={{ flex: 1, fontSize: 15, fontWeight: 800, color: '#1a1a2e' }}>Restant {showForecast ? 'Prévu' : 'Réel'}</span>
                      <span style={{ fontSize: 16, fontWeight: 900, color: balance >= 0 ? '#22c55e' : '#ef4444' }}>
                        {fmt(balance)}
                      </span>
                    </div>
                  </div>

                  {/* Donut chart card */}
                  <div className="desktop-donut-card">
                    <p className="desktop-card-title">Part des dépenses / Revenus</p>

                    {balance < 0 && (
                      <div className="desktop-budget-alert">
                        <AlertTriangle size={18} style={{ color: '#EF4444', flexShrink: 0 }} />
                        <p style={{ fontSize: 12, color: '#991B1B', fontWeight: 600 }}>
                          Vous dépassez votre budget de {Math.abs(balance).toLocaleString('fr-FR')} €
                        </p>
                      </div>
                    )}

                    <div className="desktop-donut-body">
                      <BudgetDonut segments={donutSegments} total={data.income || 1} size={160} />

                      <div className="desktop-donut-legend">
                        {[
                          { label: 'Dépenses fixes', color: '#5C6EFF', val: data.income > 0 ? Math.round(data.fixedExp / data.income * 100) : 0 },
                          { label: 'Enveloppes', color: '#9B5CFF', val: data.income > 0 ? Math.round(data.envExp / data.income * 100) : 0 },
                          { label: 'Épargne', color: '#F9A825', val: data.income > 0 ? Math.round(data.savings / data.income * 100) : 0 },
                        ].map(item => (
                          <div key={item.label} className="desktop-donut-legend-item">
                            <div className="desktop-donut-legend-left">
                              <div className="desktop-donut-dot" style={{ background: item.color }} />
                              <span className="desktop-donut-legend-label">{item.label}</span>
                            </div>
                            <span className="desktop-donut-legend-pct">{item.val}%</span>
                          </div>
                        ))}
                        {data.income > 0 && (data.fixedExp + data.envExp + data.savings) > data.income && (
                          <div className="desktop-donut-legend-item" style={{ borderTop: '1px solid #F5F7FF', paddingTop: 8, marginTop: 4 }}>
                            <div className="desktop-donut-legend-left">
                              <div className="desktop-donut-dot" style={{ background: '#EF4444' }} />
                              <span className="desktop-donut-legend-label" style={{ color: '#EF4444', fontWeight: 700 }}>Total</span>
                            </div>
                            <span className="desktop-donut-legend-pct" style={{ color: '#EF4444' }}>
                              {Math.round((data.fixedExp + data.envExp + data.savings) / data.income * 100)}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Conseil quotidien ── */}
                <div className="desktop-tip-card">
                  <div className="desktop-tip-icon">
                    <Info size={18} style={{ color: '#5C6EFF' }} />
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: '#555', lineHeight: 1.6 }}>
                    {tipMessage}
                  </p>
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────
  // MOBILE LAYOUT (inchangé)
  // ──────────────────────────────────────────────
  return (
    <div className="fade-in" style={{ minHeight: '100vh', background: '#EEF2FB', paddingBottom: 76 }}>
      <TopBar title="Vue d'ensemble" />

      <div style={{ padding: '20px 16px', maxWidth: 480, margin: '0 auto' }}>
        {/* Month selector */}
        <MonthSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />

        {/* Toggle Réel vs Prévisions */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16, marginBottom: 16 }}>
          <div style={{ 
            background: 'white', borderRadius: 14, padding: 4, 
            display: 'flex', gap: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            border: '1px solid #E8ECFF'
          }}>
            <button 
              onClick={() => setShowForecast(false)}
              style={{ 
                border: 'none', padding: '8px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700, 
                cursor: 'pointer', transition: 'all 0.2s',
                background: !showForecast ? '#5C6EFF' : 'transparent',
                color: !showForecast ? 'white' : '#B0B8C9'
              }}
            >
              Réel
            </button>
            <button 
              onClick={() => setShowForecast(true)}
              style={{ 
                border: 'none', padding: '8px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700, 
                cursor: 'pointer', transition: 'all 0.2s',
                background: showForecast ? '#5C6EFF' : 'transparent',
                color: showForecast ? 'white' : '#B0B8C9'
              }}
            >
              Prévisions
            </button>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 18, marginBottom: 6 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#1a1a2e' }}>Budget {showForecast ? 'Prévisionnel' : 'Réel'}</span>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : (
          <>
            {/* Main budget card */}
            <div className="card fade-up" style={{ padding: '20px', marginTop: 8 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 12 }}>Entrées et sorties d'argent</p>
              <BudgetRow icon={CreditCard} label="Revenus" amount={activeData.income} color="#5C6EFF" onClick={() => navigate('/incomes', { state: { date: selectedDate } })} />
              <BudgetRow icon={CreditCard} label="Dépenses fixes" amount={activeData.fixedExp} color="#9B5CFF" onClick={() => navigate('/expenses', { state: { date: selectedDate } })} />
              <BudgetRow icon={Mail} label="Dépenses enveloppes" amount={activeData.envExp} color="#5CBEFF" onClick={() => navigate('/envelopes', { state: { date: selectedDate } })} />
              <BudgetRow icon={PiggyBank} label="Épargne" amount={activeData.savings} color="#F9A825" onClick={() => navigate('/savings', { state: { date: selectedDate } })} />
              <div style={{ display: 'flex', alignItems: 'center', paddingTop: 14, borderTop: '2px solid #EEF2FB' }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#E8FFE8', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                  <span style={{ fontSize: 18 }}>💳</span>
                </div>
                <span style={{ flex: 1, fontSize: 15, fontWeight: 800, color: '#1a1a2e' }}>Restant {showForecast ? 'Prévu' : 'Réel'}</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: balance >= 0 ? '#22c55e' : '#ef4444' }}>
                  {balance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                </span>
              </div>
            </div>

            {/* Daily tip */}
            <div className="card fade-up" style={{ padding: '16px 20px', marginTop: 12, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#EEF2FB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Info size={18} style={{ color: '#5C6EFF' }} />
              </div>
              <p style={{ fontSize: 13, fontWeight: 500, color: '#555', lineHeight: 1.5 }}>
                {tipMessage}
              </p>
            </div>

            {/* Donut chart card */}
            <div className="card fade-up" style={{ padding: '20px', marginTop: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 16 }}>Part des dépenses par rapport aux revenus</p>
              
              {balance < 0 && (
                <div style={{ 
                  background: '#FEE2E2', borderRadius: 12, padding: '10px 14px', 
                  display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
                  border: '1px solid #FECACA'
                }}>
                  <AlertTriangle size={18} style={{ color: '#EF4444' }} />
                  <p style={{ fontSize: 12, color: '#991B1B', fontWeight: 600 }}>
                    Attention : Vous dépassez votre budget de {Math.abs(balance).toLocaleString('fr-FR')} €
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px 24px', flexWrap: 'wrap' }}>
                <BudgetDonut 
                  segments={donutSegments} 
                  total={data.income || 1} 
                  size={150} 
                />
                
                <div style={{ flex: '1 1 140px', display: 'flex', flexDirection: 'column', gap: 8, minWidth: '140px' }}>
                  {[
                    { label: 'Fixe', color: '#5C6EFF', val: data.income > 0 ? Math.round(data.fixedExp / data.income * 100) : 0 },
                    { label: 'Variable', color: '#9B5CFF', val: data.income > 0 ? Math.round(data.envExp / data.income * 100) : 0 },
                    { label: 'Épargne', color: '#F9A825', val: data.income > 0 ? Math.round(data.savings / data.income * 100) : 0 },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                        <span style={{ fontSize: 13, color: '#555' }}>{item.label}</span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>{item.val}%</span>
                    </div>
                  ))}
                  {data.income > 0 && (data.fixedExp + data.envExp + data.savings) > data.income && (
                    <div style={{ borderTop: '1px solid #F5F7FF', paddingTop: 4, marginTop: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 13, color: '#EF4444', fontWeight: 600 }}>Total</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#EF4444' }}>
                          {Math.round((data.fixedExp + data.envExp + data.savings) / data.income * 100)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
};

export default Dashboard;
