import React, { createContext, useContext, useState } from 'react';

const MonthContext = createContext();

export const MonthProvider = ({ children }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());

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
