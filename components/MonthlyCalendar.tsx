import React, { useState, useMemo, useLayoutEffect } from 'react';
import { ScheduleSlot } from '../types';

interface Props {
  selectedDate: string;
  onSelectDate: (d: string) => void;
  slots: ScheduleSlot[];
  teacherId: string;
  confirmations: any;
  overrides: any;
  onToggle: (date: string, id: string) => void;
  onClearDay: (date: string) => void;
  onToast: (msg: string, type?: string) => void;
}

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const WEEKDAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

const MonthlyCalendar: React.FC<Props> = ({ selectedDate, onSelectDate, slots, teacherId, confirmations, overrides, onToggle, onClearDay, onToast }) => {
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date(selectedDate);
    return isNaN(d.getTime()) ? new Date() : d;
  });

  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    return days;
  }, [viewDate]);

  const getDayCount = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const dow = date.getDay();

    return slots.filter(s => {
      const matchesTeacher = teacherId ? s.teacherId === teacherId : true;
      if (!matchesTeacher) return false;

      if (s.date) return s.date === dateStr;
      return s.dayOfWeek === dow;
    }).length;
  };

  const changeMonth = (offset: number) => {
    const d = new Date(viewDate);
    d.setMonth(d.getMonth() + offset);
    setViewDate(d);
  };

  const MONTH_NAMES = MONTHS;

  // Auto-scroll to selected date on mobile
  useLayoutEffect(() => {
    const activeEl = document.getElementById('selected-mobile-date');
    if (activeEl) {
      setTimeout(() => {
        activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }, 100);
    }
  }, [selectedDate, viewDate]);

  return (
    <div className="flex h-full animate-slide w-full overflow-hidden">
      {/* Desktop Calendar View */}
      <div className="hidden md:flex flex-col gap-6 h-full flex-1">
        <header className="flex items-center justify-between mb-4 px-1">
          <h3 className="text-3xl font-black text-studio-black dark:text-studio-beige tracking-tighter uppercase">
            {MONTH_NAMES[viewDate.getMonth()]} <span className="text-studio-orange">{viewDate.getFullYear()}</span>
          </h3>
          <div className="flex items-center gap-3 bg-studio-sand/50 dark:bg-studio-brown/30 p-3 rounded-2xl border border-studio-brown/5">
            <button
              onClick={() => changeMonth(-1)}
              className="p-2.5 hover:bg-white dark:hover:bg-studio-black rounded-xl transition-all text-studio-brown dark:text-studio-beige"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button onClick={() => setViewDate(new Date())} className="px-6 py-2 text-[11px] font-black uppercase text-studio-brown dark:text-studio-beige/60 hover:text-studio-orange transition-all tracking-widest">Hoje</button>
            <button
              onClick={() => changeMonth(1)}
              className="p-2.5 hover:bg-white dark:hover:bg-studio-black rounded-xl transition-all text-studio-brown dark:text-studio-beige"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </header>

        <div className="grid grid-cols-7 gap-[3px] bg-studio-sand dark:bg-studio-brown/20 rounded-[2.5rem] overflow-hidden border border-studio-sand dark:border-studio-brown/30 shadow-2xl">
          {WEEKDAYS.map(w => (
            <div key={w} className="bg-studio-sand/30 dark:bg-studio-brown/40 py-5 text-center text-[10px] font-black text-studio-brown/60 dark:text-studio-beige/30 tracking-[0.3em] uppercase">{w}</div>
          ))}
          {calendarDays.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} className="bg-studio-beige/50 dark:bg-studio-black/40 min-h-[100px]"></div>;

            const dateStr = day.toISOString().split('T')[0];
            const isActive = selectedDate === dateStr;
            const isToday = new Date().toISOString().split('T')[0] === dateStr;
            const count = getDayCount(day);

            return (
              <button
                key={dateStr}
                onClick={() => onSelectDate(dateStr)}
                className={`min-h-[100px] xl:min-h-[130px] p-4 md:p-6 flex flex-col gap-2 transition-all relative group ${isActive ? 'bg-studio-orange/10 dark:bg-studio-orange/20' : 'card-bg hover:bg-studio-sand/40 dark:hover:bg-studio-brown/10'
                  }`}
              >
                <div className="flex justify-between items-start w-full">
                  <span className={`text-xl font-black ${isActive ? 'text-studio-orange' : (isToday ? 'text-studio-orange border-b-4 border-studio-orange pb-1' : 'text-studio-black dark:text-studio-beige')}`}>
                    {day.getDate()}
                  </span>
                  {count > 0 && (
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${isActive ? 'bg-studio-orange text-white' : 'bg-studio-sand dark:bg-studio-brown text-studio-brown dark:text-studio-beige'}`}>
                      {count}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1 mt-auto">
                  {Array.from({ length: Math.min(count, 3) }).map((_, idx) => (
                    <div key={idx} className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-studio-orange' : 'bg-studio-brown/20 dark:bg-studio-beige/20'}`}></div>
                  ))}
                </div>

                {isActive && (
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-studio-orange"></div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile Horizontal Calendar View */}
      <div className="md:hidden flex flex-col w-full">
        <header className="px-4 py-2 flex justify-between items-center bg-white/5 border-b border-studio-brown/5">
          <span className="text-[10px] font-black text-studio-orange uppercase tracking-widest">
            {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
          </span>
          <div className="flex gap-2">
            <button onClick={() => changeMonth(-1)} className="p-1 text-studio-brown dark:text-studio-beige/40">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button onClick={() => changeMonth(1)} className="p-1 text-studio-brown dark:text-studio-beige/40">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </header>

        <div className="flex gap-3 px-4 py-4 overflow-x-auto no-scrollbar bg-white/30 dark:bg-studio-black/20 border-b border-studio-brown/5">
          {calendarDays.filter(day => day !== null).map((day) => {
            const dateStr = day!.toISOString().split('T')[0];
            const isActive = selectedDate === dateStr;
            const isToday = new Date().toISOString().split('T')[0] === dateStr;
            const count = getDayCount(day!);
            const dowName = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"][day!.getDay()];

            return (
              <button
                key={dateStr}
                id={isActive ? 'selected-mobile-date' : undefined}
                onClick={() => onSelectDate(dateStr)}
                className={`flex flex-col items-center justify-center shrink-0 w-14 h-16 rounded-2xl transition-all relative ${isActive
                  ? 'bg-studio-orange text-white shadow-lg scale-105'
                  : 'bg-white dark:bg-studio-brown/10 text-studio-black dark:text-studio-beige border border-studio-brown/5'
                  }`}
              >
                <span className="text-[8px] font-black uppercase opacity-60 leading-none mb-1.5">{dowName}</span>
                <span className="text-lg font-black leading-none">{day!.getDate()}</span>
                {count > 0 && (
                  <div className={`mt-1.5 w-1 h-1 rounded-full ${isActive ? 'bg-white' : 'bg-studio-orange'}`}></div>
                )}
                {isToday && !isActive && (
                  <div className="absolute top-1 right-1 w-1 h-1 rounded-full bg-studio-orange"></div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MonthlyCalendar;