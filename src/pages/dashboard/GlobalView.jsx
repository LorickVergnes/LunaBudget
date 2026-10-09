import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useMonth } from '../../contexts/MonthContext';
import { useDashboardQuery } from '../../hooks/useDashboardQuery';
import { formatMonthDate, getTodayStr, addMonths } from '../../lib/dateUtils';
import { computeMonthTotals } from '../../lib/budgetCalculations';
import { filterActiveGoals } from '../../lib/savingsGoals';
import { TrendingUp, TrendingDown, Globe, CalendarDays } from 'lucide-react';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import TopBar from '../../components/layout/TopBar';
import useDesktop from '../../hooks/useDesktop';

const EMPTY_HISTORY = { months: [], allTimeBalance: 0 };

const GlobalView = () => {
    const { selectedDate, setSelectedDate } = useMonth();
    const isDesktop = useDesktop();
    const [showForecast, setShowForecast] = useState(false);

    // Reset to current month on mount
    useEffect(() => {
        setSelectedDate(new Date());
    }, [setSelectedDate]);

    const { data: history = EMPTY_HISTORY, loading } = useDashboardQuery('global', [formatMonthDate(selectedDate), showForecast], async (dashboardId) => {
        const todayStr = getTodayStr();
        const currentMonthStrFull = formatMonthDate(new Date());

        const currentMonthStr = formatMonthDate(selectedDate);
        const results = await Promise.all([
            supabase.from('incomes').select('amount, date, month_date').eq('dashboard_id', dashboardId).lte('month_date', currentMonthStr).eq('is_hidden', false),
            supabase.from('expenses').select('amount, date, month_date').eq('dashboard_id', dashboardId).lte('month_date', currentMonthStr).eq('is_hidden', false),
            supabase.from('envelope_expenses').select('amount, date, month_date').eq('dashboard_id', dashboardId).lte('month_date', currentMonthStr),
            supabase.from('envelopes').select('max_amount, month_date').eq('dashboard_id', dashboardId).lte('month_date', currentMonthStr).eq('is_hidden', false),
            supabase.from('savings').select('monthly_amount, start_month, end_month').eq('dashboard_id', dashboardId),
            supabase.from('saving_entries').select('amount, date, month_date').eq('dashboard_id', dashboardId).lte('month_date', currentMonthStr),
        ]);
        const failed = results.find(result => result.error);
        if (failed) throw failed.error;
        const [{ data: allInc }, { data: allExp }, { data: allEnvExp }, { data: allEnvs }, { data: allSav }, { data: allSavEntries }] = results;

        const getMonthlyTotals = (monthStr, isForecastActive) => {
            const monthStatus = monthStr < currentMonthStrFull ? 'past' : monthStr === currentMonthStrFull ? 'current' : 'future';
            const ofMonth = (list) => (list || []).filter(x => x.month_date === monthStr);

            const { real, forecast } = computeMonthTotals(
                {
                    incomes: ofMonth(allInc), expenses: ofMonth(allExp),
                    envelopes: ofMonth(allEnvs), envelopeExpenses: ofMonth(allEnvExp),
                    savings: filterActiveGoals(allSav, monthStr), savingEntries: ofMonth(allSavEntries)
                },
                monthStatus,
                todayStr
            );
            // Le prévisionnel ne s'applique qu'au mois en cours
            const totals = isForecastActive && monthStatus === 'current' ? forecast : real;

            return { income: totals.income, expense: totals.fixedExp + totals.envExp + totals.savings };
        };

        const result = [];
        for (let i = 5; i >= 0; i--) {
            const d = addMonths(selectedDate, -i);
            const str = formatMonthDate(d);
            const label = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
            
            const { income, expense } = getMonthlyTotals(str, showForecast);
            result.push({ label, income, expense, balance: income - expense });
        }

        const allMonths = [...new Set([
            ...(allInc||[]).map(x => x.month_date),
            ...(allExp||[]).map(x => x.month_date),
            ...(allSavEntries||[]).map(x => x.month_date)
        ])].sort();

        let totalIncomesSum = 0;
        let totalExpensesSum = 0;
        allMonths.forEach(mStr => {
            const { income, expense } = getMonthlyTotals(mStr, showForecast);
            totalIncomesSum += income;
            totalExpensesSum += expense;
        });
        
        return { months: result, allTimeBalance: totalIncomesSum - totalExpensesSum };
    });
    const { months, allTimeBalance } = history;

    const allIncome = months.reduce((a, m) => a + m.income, 0);
    const allExpense = months.reduce((a, m) => a + m.expense, 0);
    const bilan = allIncome - allExpense;
    const avgBalance = months.length ? months.reduce((a, m) => a + m.balance, 0) / months.length : 0;
    const maxVal = Math.max(...months.map(m => Math.max(m.income, m.expense)), 1);

    const fmt = (n, sign = false) => {
        const s = n.toLocaleString('fr-FR', { minimumFractionDigits: 2 });
        return sign && n >= 0 ? `+${s} €` : `${s} €`;
    };

    // ──────────────────────────────────────────────
    // DESKTOP LAYOUT
    // ──────────────────────────────────────────────
    if (isDesktop) {
        const KPI_ITEMS = [
            { icon: TrendingUp, label: 'Total Revenus (6 mois)', value: fmt(allIncome, true), color: '#22c55e' },
            { icon: TrendingDown, label: 'Total Dépenses (6 mois)', value: `-${allExpense.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`, color: '#ef4444' },
            { icon: CalendarDays, label: 'Moy. mensuelle', value: fmt(avgBalance, true), color: '#F9A825' },
            { icon: Globe, label: 'Bilan net (6 mois)', value: fmt(bilan, true), color: bilan >= 0 ? '#22c55e' : '#ef4444' },
        ];

        return (
            <>

                {/* ── Top row: greeting + toggle ── */}
                <div className="desktop-greeting-toprow">
                    <div className="desktop-greeting">
                        <h1>Vue Globale 🌍</h1>
                        <p>Analysez l'évolution de votre budget sur les 6 derniers mois.</p>
                    </div>
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

                {loading ? (
                    <LoadingSpinner />
                ) : (
                    <>
                        {/* ── Hero: all-time balance ── */}
                        <div className="desktop-global-hero" style={{ background: 'linear-gradient(135deg, #81BAD8 0%, #CE9C4A 100%)', color: 'white', border: 'none', textShadow: '0 2px 4px rgba(0,0,0,0.15)' }}>
                            <div>
                                <p className="desktop-global-hero-label" style={{ color: 'white', opacity: 0.9, textShadow: 'none' }}>Solde Total (Tous les mois)</p>
                                <p className="desktop-global-hero-value" style={{ color: 'white' }}>{fmt(allTimeBalance)}</p>
                            </div>
                            <div className="desktop-global-hero-icon" style={{ background: 'rgba(255,255,255,0.2)' }}>
                                <Globe size={24} color="white" />
                            </div>
                        </div>

                        {/* ── KPI grid ── */}
                        <div className="desktop-global-kpi-grid">
                            {KPI_ITEMS.map(({ icon: Icon, label, value, color }) => (
                                <div key={label} className="desktop-global-kpi-card">
                                    <div className="desktop-global-kpi-icon-wrap" style={{ background: `${color}18` }}>
                                        <Icon size={18} style={{ color }} />
                                    </div>
                                    <p className="desktop-global-kpi-label">{label}</p>
                                    <p className="desktop-global-kpi-value" style={{ color }}>{value}</p>
                                </div>
                            ))}
                        </div>

                        {/* ── Bar chart ── */}
                        <div className="desktop-chart-card">
                            <div className="desktop-chart-header">
                                <p className="desktop-card-title">Évolution mensuelle</p>
                                <div className="desktop-chart-legend">
                                    <span className="desktop-chart-legend-item">
                                        <span className="desktop-chart-legend-dot" style={{ background: '#A0D2EB' }} />
                                        Revenus
                                    </span>
                                    <span className="desktop-chart-legend-item">
                                        <span className="desktop-chart-legend-dot" style={{ background: '#E5BA73' }} />
                                        Dépenses
                                    </span>
                                </div>
                            </div>
                            <div className="desktop-bars-container">
                                {months.map((m, i) => (
                                    <div key={i} className="desktop-bars-month">
                                        <div className="desktop-bars-pair">
                                            <div
                                                className="desktop-bar"
                                                style={{
                                                    background: '#A0D2EB',
                                                    height: `${(m.income / maxVal) * 136}px`,
                                                }}
                                            />
                                            <div
                                                className="desktop-bar"
                                                style={{
                                                    background: '#E5BA73',
                                                    height: `${(m.expense / maxVal) * 136}px`,
                                                }}
                                            />
                                        </div>
                                        <span className="desktop-bars-label">{m.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* ── Monthly table ── */}
                        <div className="desktop-table-card">
                            <p className="desktop-card-title" style={{ marginBottom: 16 }}>Détail par mois</p>
                            {months.map((m, i) => (
                                <div key={i} className="desktop-table-row">
                                    <span className="desktop-table-month">{m.label}</span>
                                    <span className="desktop-table-income">+{m.income.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</span>
                                    <span className="desktop-table-expense">-{m.expense.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</span>
                                    <span
                                        className="desktop-table-balance"
                                        style={{ color: m.balance >= 0 ? '#22c55e' : '#ef4444' }}
                                    >
                                        {m.balance >= 0 ? '+' : ''}{m.balance.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
                                    </span>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </>
        );
    }

    // ──────────────────────────────────────────────
    // MOBILE LAYOUT (inchangé)
    // ──────────────────────────────────────────────
    return (
        <div className="fade-in" style={{ minHeight: '100vh', background: 'transparent', paddingBottom: 76 }}>
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
                                background: !showForecast ? '#A0D2EB' : 'transparent',
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
                                background: showForecast ? '#A0D2EB' : 'transparent',
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
                        <div className="fade-up" style={{ padding: '24px 20px', marginBottom: 14, background: 'linear-gradient(135deg, #81BAD8 0%, #CE9C4A 100%)', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'white', textShadow: '0 1px 3px rgba(0,0,0,0.2)', boxShadow: '0 4px 14px rgba(160,210,235,0.3)' }}>
                            <div>
                                <p style={{ fontSize: 11, opacity: 0.9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Solde Total (Tous les mois)</p>
                                <p style={{ fontSize: 26, fontWeight: 900 }}>{allTimeBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</p>
                            </div>
                            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Globe size={20} color="white" />
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
                                    <p style={{ fontSize: 16, fontWeight: 900, color: '#4A6984' }}>{value}</p>
                                </div>
                            ))}
                        </div>

                        {/* Bar chart */}
                        <div className="card fade-up" style={{ padding: '20px', marginBottom: 14 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <p style={{ fontSize: 14, fontWeight: 700, color: '#4A6984' }}>Évolution mensuelle</p>
                                <div style={{ display: 'flex', gap: 12, fontSize: 11, fontWeight: 600, color: '#B0B8C9' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#A0D2EB' }} />Revenus
                                    </span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#E5BA73' }} />Dépenses
                                    </span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120 }}>
                                {months.map((m, i) => (
                                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                                        <div style={{ width: '100%', display: 'flex', gap: 2, alignItems: 'flex-end', height: 96 }}>
                                            <div style={{ flex: 1, background: '#A0D2EB', borderRadius: '4px 4px 0 0', height: `${(m.income / maxVal) * 96}px`, minHeight: 2, transition: 'height .7s ease' }} />
                                            <div style={{ flex: 1, background: '#E5BA73', borderRadius: '4px 4px 0 0', height: `${(m.expense / maxVal) * 96}px`, minHeight: 2, transition: 'height .7s ease' }} />
                                        </div>
                                        <span style={{ fontSize: 9, color: '#B0B8C9', fontWeight: 600, marginTop: 4, textTransform: 'capitalize' }}>{m.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Monthly table */}
                        <div className="card fade-up" style={{ padding: '20px' }}>
                            <p style={{ fontSize: 14, fontWeight: 700, color: '#4A6984', marginBottom: 14 }}>Détail par mois</p>
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
        </div>
    );
};
export default GlobalView;
