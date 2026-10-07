import React, { createContext, useContext, useState, useCallback } from 'react';
import { startOfMonth } from '../lib/dateUtils';

const MonthContext = createContext();

export const MonthProvider = ({ children }) => {
  // Toujours le 1er du mois : le jour n'a aucun sens ici et fausse les calculs de mois
  const [selectedDate, setSelectedDateRaw] = useState(() => startOfMonth(new Date()));

  const setSelectedDate = useCallback((date) => {
    const next = startOfMonth(date);
    // Même mois : on garde l'objet existant pour ne pas relancer les fetch
    setSelectedDateRaw(prev => (prev.getTime() === next.getTime() ? prev : next));
  }, []);

  return (
    <MonthContext.Provider value={{ selectedDate, setSelectedDate }}>
      {children}
    </MonthContext.Provider>
  );
};

export const useMonth = () => {
  const context = useContext(MonthContext);
  if (context === undefined) {
    throw new Error('useMonth must be used within a MonthProvider');
  }
  return context;
};
