import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { useMonth } from '../../contexts/MonthContext';
import { formatMonthDate } from '../../lib/dateUtils';
import { useNavigate } from 'react-router-dom';
import { recurrenceService } from '../../services/recurrenceService';
import BottomNav from '../../components/layout/BottomNav';
import MonthSelector from '../../components/layout/MonthSelector';
import TopBar from '../../components/layout/TopBar';
import {
  CreditCard, Mail, PiggyBank, Loader2, Info, ChevronRight
} from 'lucide-react';

/* ── Semi-donut SVG chart ── */
const SemiDonut = ({ segments, size = 180 }) => {
  const r = 70, cx = 90, cy = 90;
  const c = Math.PI * r; // half circle circumference
  let offset = 0;
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 180 100" style={{ overflow: 'visible' }}>
      {segments.map((seg, i) => {
        const pct = seg.value / total;
        const dash = pct * c;
        const el = (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" strokeWidth={18}
            stroke={seg.color}
            strokeDasharray={`${dash} ${c - dash}`}
            strokeDashoffset={-offset}
            strokeLinecap="round"
            style={{ transform: 'rotate(-180deg)', transformOrigin: '90px 90px' }}
          />
        );
        offset += dash + 2;
        return el;
      })}
      <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth={18} stroke="#EEF2FB"
        style={{ transform: 'rotate(-180deg)', transformOrigin: '90px 90px' }}
        strokeDasharray={`${c} ${c}`} />
      {segments.map((seg, i) => {
        const pct = seg.value / total;
        const realOffset = segments.slice(0, i).reduce((a, s) => a + (s.value / total) * c + 2, 0);
        const angle = (realOffset / c) * 180 - 180 + (pct / 2 * 180);
        return null; // dots could go here
      })}
    </svg>
  );
};

/* ── Row item ── */
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
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ income: 0, fixedExp: 0, envExp: 0, savings: 0 });

  useEffect(() => { if (user) fetchData(); }, [user, selectedDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      await recurrenceService.checkAndApplyRecurrence(user.id, selectedDate);
      const monthStr = formatMonthDate(selectedDate);
      const [{ data: inc }, { data: exp }, { data: envExp }, { data: sav }] = await Promise.all([
        supabase.from('incomes').select('amount').eq('user_id', user.id).eq('month_date', monthStr),
        supabase.from('expenses').select('amount').eq('user_id', user.id).eq('month_date', monthStr),
        supabase.from('envelope_expenses').select('amount').eq('user_id', user.id).eq('month_date', monthStr),
        supabase.from('savings').select('target_amount').eq('user_id', user.id).eq('month_date', monthStr),
      ]);
      const income = (inc || []).reduce((a, c) => a + parseFloat(c.amount), 0);
      const fixedExp = (exp || []).reduce((a, c) => a + parseFloat(c.amount), 0);
      const envExpA = (envExp || []).reduce((a, c) => a + parseFloat(c.amount), 0);
      const savings = (sav || []).reduce((a, c) => a + parseFloat(c.target_amount), 0);
      setData({ income, fixedExp, envExp: envExpA, savings });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const totalExp = data.fixedExp + data.envExp;
  const balance = data.income - totalExp - data.savings;

  // Days remaining in month
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = lastDay - now.getDate();
  const perDay = daysLeft > 0 ? balance / daysLeft : 0;

  const donutSegments = [
    { color: '#5C6EFF', value: data.fixedExp },
    { color: '#9B5CFF', value: data.envExp },
    { color: '#F9A825', value: data.savings },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#EEF2FB', paddingBottom: 76 }}>
      <TopBar title="Vue d'ensemble" />

      <div style={{ padding: '20px 16px', maxWidth: 480, margin: '0 auto' }}>
        {/* Month selector */}
        <MonthSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />

        <div style={{ textAlign: 'center', marginTop: 18, marginBottom: 6 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#1a1a2e' }}>Budget</span>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <Loader2 size={32} style={{ color: '#5C6EFF' }} className="animate-spin" />
          </div>
        ) : (
          <>
            {/* Main budget card */}
            <div className="card fade-up" style={{ padding: '20px', marginTop: 8 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 12 }}>Entrées et sorties d'argent</p>
              <BudgetRow icon={CreditCard} label="Revenus" amount={data.income} color="#5C6EFF" onClick={() => navigate('/incomes', { state: { date: selectedDate } })} />
              <BudgetRow icon={CreditCard} label="Dépenses fixes" amount={data.fixedExp} color="#9B5CFF" onClick={() => navigate('/expenses', { state: { date: selectedDate } })} />
              <BudgetRow icon={Mail} label="Dépenses enveloppes" amount={data.envExp} color="#5CBEFF" onClick={() => navigate('/envelopes', { state: { date: selectedDate } })} />
              <BudgetRow icon={PiggyBank} label="Épargne" amount={data.savings} color="#F9A825" onClick={() => navigate('/savings', { state: { date: selectedDate } })} />
              <div style={{ display: 'flex', alignItems: 'center', paddingTop: 14, borderTop: '2px solid #EEF2FB' }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#E8FFE8', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                  <span style={{ fontSize: 18 }}>💳</span>
                </div>
                <span style={{ flex: 1, fontSize: 15, fontWeight: 800, color: '#1a1a2e' }}>Restant réel</span>
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
                Il reste <strong style={{ color: '#ef4444' }}>{daysLeft} jours</strong> avant la fin du mois &{' '}
                <strong style={{ color: '#22c55e' }}>{perDay.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</strong> à dépenser par jour !
              </p>
            </div>

            {/* Donut chart card */}
            <div className="card fade-up" style={{ padding: '20px', marginTop: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 16 }}>Part des dépenses par rapport aux revenus</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                {/* SVG donut */}
                <svg width={130} height={80} viewBox="0 0 180 100" style={{ flexShrink: 0 }}>
                  {/* background arc */}
                  <path d="M 20 90 A 70 70 0 0 1 160 90" fill="none" stroke="#EEF2FB" strokeWidth={18} />
                  {/* fixed */}
                  {data.income > 0 && (() => {
                    const total = data.income;
                    const fPct = Math.min(data.fixedExp / total, 1);
                    const ePct = Math.min(data.envExp / total, 1 - fPct);
                    const sPct = Math.min(data.savings / total, 1 - fPct - ePct);
                    const arc = (startPct, endPct, color) => {
                      const r = 70, cx = 90, cy = 90;
                      const startA = Math.PI + startPct * Math.PI;
                      const endA = Math.PI + endPct * Math.PI;
                      const x1 = cx + r * Math.cos(startA), y1 = cy + r * Math.sin(startA);
                      const x2 = cx + r * Math.cos(endA), y2 = cy + r * Math.sin(endA);
                      const large = (endPct - startPct) > 0.5 ? 1 : 0;
                      return <path key={color} d={`M${x1} ${y1} A${r} ${r} 0 ${large} 1 ${x2} ${y2}`} fill="none" stroke={color} strokeWidth={18} strokeLinecap="round" />;
                    };
                    return [
                      arc(0, fPct, '#5C6EFF'),
                      arc(fPct + 0.02, fPct + ePct, '#9B5CFF'),
                      arc(fPct + ePct + 0.02, fPct + ePct + sPct, '#F9A825'),
                    ];
                  })()}
                </svg>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { label: 'Fixe', color: '#5C6EFF', val: data.income > 0 ? Math.round(data.fixedExp / data.income * 100) : 0 },
                    { label: 'Variable', color: '#9B5CFF', val: data.income > 0 ? Math.round(data.envExp / data.income * 100) : 0 },
                    { label: 'Épargne', color: '#F9A825', val: data.income > 0 ? Math.round(data.savings / data.income * 100) : 0 },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                      <span style={{ fontSize: 13, color: '#555', flex: 1 }}>{item.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>{item.val}%</span>
                    </div>
                  ))}
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
