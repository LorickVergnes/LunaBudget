import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LogOut, PieChart, CreditCard, Mail, PiggyBank, Globe, LayoutDashboard } from 'lucide-react';

const TABS = [
  { to: '/', label: 'Budget', icon: LayoutDashboard, exact: true },
  { to: '/global', label: 'Global', icon: Globe },
  { to: '/incomes', label: 'Revenus', icon: CreditCard },
  { to: '/expenses', label: 'Dépenses', icon: CreditCard },
  { to: '/envelopes', label: 'Enveloppes', icon: Mail },
  { to: '/savings', label: 'Épargne', icon: PiggyBank },
];

const DesktopHeader = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Utilisateur';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <header className="desktop-header">
      {/* Logo */}
      <div className="desktop-header-logo" onClick={() => navigate('/')}>
        <div className="desktop-header-logo-icon">
          <PieChart size={18} color="white" />
        </div>
        <span className="desktop-header-logo-text">LunaBudget</span>
      </div>

      {/* Nav tabs */}
      <nav className="desktop-header-nav">
        {TABS.map(({ to, label, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) =>
              isActive ? 'desktop-nav-tab desktop-nav-tab--active' : 'desktop-nav-tab'
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User section */}
      <div className="desktop-header-user">
        <NavLink to="/account" className="desktop-header-avatar-link">
          <div className="desktop-header-avatar">
            <span>{initial}</span>
          </div>
          <div className="desktop-header-userinfo">
            <span className="desktop-header-username">{displayName}</span>
            <span className="desktop-header-useremail">{user?.email}</span>
          </div>
        </NavLink>
        <button className="desktop-header-logout" onClick={() => signOut()} title="Déconnexion">
          <LogOut size={17} />
        </button>
      </div>
    </header>
  );
};

export default DesktopHeader;
