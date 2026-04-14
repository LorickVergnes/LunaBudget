import { useState, useEffect } from 'react';

/**
 * Hook simple pour détecter si l'écran est en mode desktop (≥ 900px).
 * Remplace le useEffect + useState répété dans chaque page.
 */
const useDesktop = () => {
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 900);
  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 900);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isDesktop;
};

export default useDesktop;
