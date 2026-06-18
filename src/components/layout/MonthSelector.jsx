import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getMonthName, getNextMonth, getPrevMonth } from '../../lib/dateUtils';

const MonthSelector = ({ selectedDate, onDateChange }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: 'white', borderRadius: 16, padding: '10px 16px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    maxWidth: 280, margin: '0 auto',
  }}>
    <button onClick={() => onDateChange(getPrevMonth(selectedDate))}
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 8, color: '#B0B8C9', display: 'flex' }}>
      <ChevronLeft size={22} />
    </button>
    <span style={{ fontSize: 17, fontWeight: 800, color: '#4A6984', letterSpacing: '-0.02em' }}>
      {getMonthName(selectedDate)}
    </span>
    <button onClick={() => onDateChange(getNextMonth(selectedDate))}
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 8, color: '#B0B8C9', display: 'flex' }}>
      <ChevronRight size={22} />
    </button>
  </div>
);

export default MonthSelector;
