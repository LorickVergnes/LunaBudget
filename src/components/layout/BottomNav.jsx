import React from 'react';
import { NavLink } from 'react-router-dom';
import { CreditCard, Mail, Wallet, PiggyBank, PieChart } from 'lucide-react';

const TABS = [
    { to: '/incomes', label: 'Revenus', Icon: CreditCard, color: '#A0D2EB' },
    { to: '/expenses', label: 'Dépenses', Icon: CreditCard, color: '#E5BA73' },
    { to: '/envelopes', label: 'Enveloppes', Icon: Mail, color: '#A0D2EB' },
    { to: '/savings', label: 'Épargne', Icon: PiggyBank, color: '#F9A825' },
    { to: '/', label: 'Budget', Icon: PieChart, color: '#E5BA73', exact: true },
    { to: '/global', label: 'Global', Icon: PieChart, color: '#A0D2EB' },
];

const BottomNav = () => (
    <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: 'white',
        borderTop: '1px solid #F4F7F6',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.06)',
        paddingBottom: 'env(safe-area-inset-bottom,0)',
    }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', height: 64, maxWidth: 480, margin: '0 auto', padding: '0 4px' }}>
            {TABS.map(({ to, label, Icon, color, exact }) => (
                <NavLink key={to} to={to} end={exact} style={{ flex: 1, textDecoration: 'none' }}>
                    {({ isActive }) => (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '4px 0' }}>
                            <div style={{
                                width: 40, height: 40, borderRadius: 12,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: isActive ? `${color}18` : 'transparent',
                                transition: 'all 0.2s',
                            }}>
                                <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8}
                                    style={{ color: isActive ? color : '#B0B8C9' }} />
                            </div>
                            <span style={{
                                fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
                                textTransform: 'uppercase',
                                color: isActive ? color : '#B0B8C9',
                            }}>{label}</span>
                        </div>
                    )}
                </NavLink>
            ))}
        </div>
    </nav>
);

export default BottomNav;
