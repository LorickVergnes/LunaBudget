import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import useDesktop from '../../hooks/useDesktop';
import DesktopHeader from './DesktopHeader';
import DesktopSidebar from './DesktopSidebar';
import BottomNav from './BottomNav';

/**
 * Cadre commun à toutes les pages connectées : la page active s'affiche dans <Outlet />.
 *
 * - Desktop : en-tête et barre latérale, qui restent en place d'une page à l'autre.
 * - Mobile  : barre de navigation en bas (chaque page affiche sa propre TopBar avec son titre).
 *
 * `mobileOnly` garde la mise en page mobile même sur grand écran (pages de détail).
 */
const AppLayout = ({ mobileOnly = false }) => {
  const isDesktop = useDesktop();
  const { pathname } = useLocation();

  if (isDesktop && !mobileOnly) {
    return (
      <div className="desktop-shell">
        <DesktopHeader />
        <div className="desktop-body">
          {/* key : la barre latérale se replie à chaque changement de page */}
          <DesktopSidebar key={`sidebar-${pathname}`} />
          {/* key : rejoue le fondu d'apparition du contenu à chaque changement de page */}
          <main className="desktop-main fade-in" key={pathname}>
            <Outlet />
          </main>
        </div>
      </div>
    );
  }

  return (
    <>
      <Outlet />
      <BottomNav />
    </>
  );
};

export default AppLayout;
