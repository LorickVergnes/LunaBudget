import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { useMonth } from '../../contexts/MonthContext';
import { formatMonthDate } from '../../lib/dateUtils';
import { TrendingUp, TrendingDown, Globe, CalendarDays } from 'lucide-react';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import BottomNav from '../../components/layout/BottomNav';
import TopBar from '../../components/layout/TopBar';

const GlobalView = () => {
    const { user } = useAuth();
    const { selectedDate, setSelectedDate } = useMonth();
    const [loading, setLoading] = useState(true);
    const [months, setMonths] = useState([]);
    const [allTimeBalance, setAllTimeBalance] = useState(0);
    const [showForecast, setShowForecast] = useState(false);

    // Reset to current month on mount
    useEffect(() => {
        setSelectedDate(new Date());
    }, []);

    useEffect(() => { if (user) fetchGlobal(); }, [user, selectedDate, showForecast]);

    const fetchGlobal = async () => {
        setLoading(true);
        try {
            const now = new Date();
            const todayStr = now.toISOString().split('T')[0];
            const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const currentMonthStrFull = formatMonthDate(now);

            const currentMonthStr = formatMonthDate(selectedDate);
            const [{ data: allInc }, { data: allExp }, { data: allEnvExp }, { data: allEnvs }, { data: allSav }, { data: allSavEntries }] = await Promise.all([
                supabase.from('incomes').select('amount, date, month_date').eq('user_id', user.id).lte('month_date', currentMonthStr).eq('is_hidden', false),
                supabase.from('expenses').select('amount, date, month_date').eq('user_id', user.id).lte('month_date', currentMonthStr).eq('is_hidden', false),
                supabase.from('envelope_expenses').select('amount, date, month_date').eq('user_id', user.id).lte('month_date', currentMonthStr),
                supabase.from('envelopes').select('max_amount, month_date').eq('user_id', user.id).lte('month_date', currentMonthStr).eq('is_hidden', false),
                supabase.from('savings').select('target_amount, month_date').eq('user_id', user.id).lte('month_date', currentMonthStr).eq('is_hidden', false),
                supabase.from('saving_entries').select('amount, date, month_date').eq('user_id', user.id).lte('month_date', currentMonthStr),
            ]);

            const getMonthlyTotals = (monthStr, isForecastActive) => {
                const isThisMonth = monthStr === currentMonthStrFull;
                const isPastMonth = new Date(monthStr + "-01") < currentMonthStart;
                
                // Even if toggle is ON, we only use Forecast logic for the CURRENT month
                const useForecastLogic = isForecastActive && isThisMonth;

                const mInc = (allInc || []).filter(x => x.month_date === monthStr);
                const mExp = (allExp || []).filter(x => x.month_date === monthStr);
                const mEnvExp = (allEnvExp || []).filter(x => x.month_date === monthStr);
                const mEnvs = (allEnvs || []).filter(x => x.month_date === monthStr);
                const mSav = (allSav || []).filter(x => x.month_date === monthStr);
                const mSavEnt = (allSavEntries || []).filter(x => x.month_date === monthStr);

                const filterReal = (list, key = 'date') => list.filter(item => {
                    if (isPastMonth) return true;
                    return item[key] <= todayStr;
                });

                const income = (useForecastLogic ? mInc : filterReal(mInc)).reduce((a, c) => a + parseFloat(c.amount), 0);
                
                const expense = (useForecastLogic ? mExp : filterReal(mExp)).reduce((a, c) => a + parseFloat(c.amount), 0)
                    + (useForecastLogic 
                        ? mEnvs.reduce((a, c) => a + parseFloat(c.max_amount), 0)
                        : filterReal(mEnvExp).reduce((a, c) => a + parseFloat(c.amount), 0)
                      )
                    + (useForecastLogic 
                        ? mSav.reduce((a, c) => a + parseFloat(c.target_amount), 0)
                        : filterReal(mSavEnt).reduce((a, c) => a + parseFloat(c.amount), 0)
                      );

                return { income, expense };
            };

            // Calculate historical list (6 months)
            const result = [];
            for (let i = 5; i >= 0; i--) {
                const d = new Date(selectedDate);
                d.setMonth(d.getMonth() - i);
                const str = formatMonthDate(d);
                const label = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
                
                const { income, expense } = getMonthlyTotals(str, showForecast);
                result.push({ label, income, expense, balance: income - expense });
            }
            setMonths(result);

            // Calculate All-Time Balance based on the same logic (Past = Real, Current = Toggle)
            // We need to iterate through all unique months in the data
            const allMonths = [...new Set([
                ...(allInc||[]).map(x => x.month_date),
                ...(allExp||[]).map(x => x.month_date),
                ...(allSav||[]).map(x => x.month_date)
            ])].sort();

            let totalIncomesSum = 0;
            let totalExpensesSum = 0;
            allMonths.forEach(mStr => {
                const { income, expense } = getMonthlyTotals(mStr, showForecast);
                totalIncomesSum += income;
                totalExpensesSum += expense;
            });
            
            setAllTimeBalance(totalIncomesSum - totalExpensesSum);

        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const allIncome = months.reduce((a, m) => a + m.income, 0);
    const allExpense = months.reduce((a, m) => a + m.expense, 0);
    const bilan = allIncome - allExpense;
    const avgBalance = months.length ? months.reduce((a, m) => a + m.balance, 0) / months.length : 0;
    const maxVal = Math.max(...months.map(m => Math.max(m.income, m.expense)), 1);

    return (
        <div className="fade-in" style={{ minHeight: '100vh', background: '#EEF2FB', paddingBottom: 76 }}>
            <TopBar title="Vue Globale" />

            <div style={{ padding: '16px 16px', maxWidth: 480, margin: '0 auto' }}>
                {/* Toggle Réel vs Prévisions */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                    <div style={{ 
                        background: 'white', borderRadius: 14, padding: 4, 
                        display: 'flex', gap: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' 
                    }}>
                        <button 
                            onClick={() => setShowForecast(false)}
                            style={{ 
                                border: 'none', padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, 
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
                                border: 'none', padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, 
                                cursor: 'pointer', transition: 'all 0.2s',
                                background: showForecast ? '#5C6EFF' : 'transparent',
                                color: showForecast ? 'white' : '#B0B8C9'
                            }}
                        >
                            Prévisions
                        </button>
                    </div>
                </div>

                {loading ? (
                    <LoadingSpinner />
                ) : (
                    <>
                        {/* All-time Balance Card */}
                        <div className="card fade-up" style={{ padding: '24px 20px', marginBottom: 14, background: 'linear-gradient(135deg, #1a1a2e 0%, #2a2a4a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <p style={{ fontSize: 11, color: '#B0B8C9', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Solde Total (Tous les mois)</p>
                                <p style={{ fontSize: 26, fontWeight: 900, color: 'white' }}>{allTimeBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</p>
                            </div>
                            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Globe size={20} color="#5C6EFF" />
                            </div>
                        </div>

                        {/* Summary cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                            {[
                                { icon: TrendingUp, label: 'Total Revenus', value: `+${allIncome.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`, color: '#22c55e' },
                                { icon: TrendingDown, label: 'Total Dépenses', value: `-${allExpense.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`, color: '#ef4444' },
                                { icon: CalendarDays, label: 'Moy. mensuelle', value: `${avgBalance >= 0 ? '+' : ''}${avgBalance.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`, color: '#F9A825' },
                                { icon: Globe, label: 'Bilan net (6 mois)', value: `${bilan >= 0 ? '+' : ''}${bilan.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`, color: bilan >= 0 ? '#22c55e' : '#ef4444' },
                            ].map(({ icon: Icon, label, value, color }) => (
                                <div key={label} className="card fade-up" style={{ padding: '14px 16px' }}>
                                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                                        <Icon size={18} style={{ color }} />
                                    </div>
                                    <p style={{ fontSize: 10, color: '#B0B8C9', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{label}</p>
                                    <p style={{ fontSize: 16, fontWeight: 900, color: '#1a1a2e' }}>{value}</p>
                                </div>
                            ))}
                        </div>

                        {/* Bar chart */}
                        <div className="card fade-up" style={{ padding: '20px', marginBottom: 14 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <p style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>Évolution mensuelle</p>
                                <div style={{ display: 'flex', gap: 12, fontSize: 11, fontWeight: 600, color: '#B0B8C9' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#5C6EFF' }} />Revenus
                                    </span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#9B5CFF' }} />Dépenses
                                    </span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120 }}>
                                {months.map((m, i) => (
                                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                                        <div style={{ width: '100%', display: 'flex', gap: 2, alignItems: 'flex-end', height: 96 }}>
                                            <div style={{ flex: 1, background: '#5C6EFF', borderRadius: '4px 4px 0 0', height: `${(m.income / maxVal) * 96}px`, minHeight: 2, transition: 'height .7s ease' }} />
                                            <div style={{ flex: 1, background: '#9B5CFF', borderRadius: '4px 4px 0 0', height: `${(m.expense / maxVal) * 96}px`, minHeight: 2, transition: 'height .7s ease' }} />
                                        </div>
                                        <span style={{ fontSize: 9, color: '#B0B8C9', fontWeight: 600, marginTop: 4, textTransform: 'capitalize' }}>{m.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Monthly table */}
                        <div className="card fade-up" style={{ padding: '20px' }}>
                            <p style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', marginBottom: 14 }}>Détail par mois</p>
                            {months.map((m, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < months.length - 1 ? '1px solid #F5F7FF' : 'none' }}>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: '#555', minWidth: 52, textTransform: 'capitalize' }}>{m.label}</span>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: '#22c55e', flex: 1, textAlign: 'center' }}>+{m.income.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}</span>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', flex: 1, textAlign: 'center' }}>-{m.expense.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}</span>
                                    <span style={{ fontSize: 13, fontWeight: 800, color: m.balance >= 0 ? '#22c55e' : '#ef4444', minWidth: 60, textAlign: 'right' }}>
                                        {m.balance >= 0 ? '+' : ''}{m.balance.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
                                    </span>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
            <BottomNav />
        </div>
    );
};
export default GlobalView;
