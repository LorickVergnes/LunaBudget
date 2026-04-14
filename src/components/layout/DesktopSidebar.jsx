import React from 'react';
import { NavLink } from 'react-router-dom';
import { PieChart, CreditCard, Mail, PiggyBank, Globe, LayoutDashboard, Settings } from 'lucide-react';

const SIDEBAR_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Budget', exact: true, color: '#9B5CFF' },
  { to: '/global', icon: Globe, label: 'Global', color: '#5C6EFF' },
  { to: '/incomes', icon: CreditCard, label: 'Revenus', color: '#5C6EFF' },
  { to: '/expenses', icon: CreditCard, label: 'Dépenses', color: '#9B5CFF' },
  { to: '/envelopes', icon: Mail, label: 'Enveloppes', color: '#5CBEFF' },
  { to: '/savings', icon: PiggyBank, label: 'Épargne', color: '#F9A825' },
];

const DesktopSidebar = () => {
  return (
    <aside className="desktop-sidebar">
      <div className="desktop-sidebar-items">
        {SIDEBAR_ITEMS.map(({ to, icon: Icon, label, exact, color }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) =>
              isActive ? 'desktop-sidebar-item desktop-sidebar-item--active' : 'desktop-sidebar-item'
            }
            title={label}
          >
            {({ isActive }) => (
              <div
                className="desktop-sidebar-icon-wrap"
                style={{ background: isActive ? `${color}1A` : 'transparent' }}
              >
                <Icon
                  size={22}
                  strokeWidth={isActive ? 2.5 : 1.8}
                  style={{ color: isActive ? color : '#B0B8C9', transition: 'all 0.2s' }}
                />
              </div>
            )}
          </NavLink>
        ))}
      </div>
      <NavLink to="/account" className="desktop-sidebar-item desktop-sidebar-settings" title="Paramètres">
        {({ isActive }) => (
          <div
            className="desktop-sidebar-icon-wrap"
            style={{ background: isActive ? '#5C6EFF1A' : 'transparent' }}
          >
            <Settings
              size={22}
              strokeWidth={isActive ? 2.5 : 1.8}
              style={{ color: isActive ? '#5C6EFF' : '#B0B8C9', transition: 'all 0.2s' }}
            />
          </div>
        )}
      </NavLink>
    </aside>
  );
};

export default DesktopSidebar;
