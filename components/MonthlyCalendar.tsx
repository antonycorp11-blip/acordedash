import React, { useState, useMemo } from 'react';
import { ScheduleSlot } from '../types';

interface Props {
  selectedDate: string;
  onSelectDate: (d: string) => void;
  slots: ScheduleSlot[];
  teacherId: string;
}

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const WEEKDAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

const MonthlyCalendar: React.FC<Props> = ({ selectedDate, onSelectDate, slots, teacherId }) => {
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

    // Filtra as aulas. Se a aula tiver 'date', compara a data. Caso contrário, usa o dia da semana (grade fixa).
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

  return (
    <div className="flex flex-col h-full gap-2 animate-slide max-w-4xl mx-auto">
      <header className="flex items-center justify-between mb-2 px-1">
        <h3 className="text-xl font-black text-studio-black dark:text-studio-beige tracking-tight uppercase">
          {MONTHS[viewDate.getMonth()]} <span className="text-studio-orange">{viewDate.getFullYear()}</span>
        </h3>
        <div className="flex items-center gap-2 bg-studio-sand/50 dark:bg-studio-brown/30 p-2 rounded-xl border border-studio-brown/5">
          <button
            onClick={() => changeMonth(-1)}
            className="p-2 hover:bg-white dark:hover:bg-studio-black rounded-lg transition-all text-studio-brown dark:text-studio-beige"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button onClick={() => setViewDate(new Date())} className="px-4 py-1.5 text-[10px] font-black uppercase text-studio-brown dark:text-studio-beige/60 hover:text-studio-orange transition-all">Hoje</button>
          <button
            onClick={() => changeMonth(1)}
            className="p-2 hover:bg-white dark:hover:bg-studio-black rounded-lg transition-all text-studio-brown dark:text-studio-beige"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </header>

      <div className="grid grid-cols-7 gap-[2px] bg-studio-sand dark:bg-studio-brown/20 rounded-2xl overflow-hidden border border-studio-sand dark:border-studio-brown/30 shadow-lg">
        {WEEKDAYS.map(w => (
          <div key={w} className="bg-studio-sand/30 dark:bg-studio-brown/40 py-3 text-center text-[9px] font-black text-studio-brown/60 dark:text-studio-beige/30 tracking-[0.2em]">{w}</div>
        ))}
        {calendarDays.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} className="bg-studio-beige/50 dark:bg-studio-black/40 min-h-[62px]"></div>;

          const dateStr = day.toISOString().split('T')[0];
          const isActive = selectedDate === dateStr;
          const isToday = new Date().toISOString().split('T')[0] === dateStr;
          const count = getDayCount(day);

          return (
            <button
              key={dateStr}
              onClick={() => onSelectDate(dateStr)}
              className={`min-h-[50px] md:min-h-[62px] p-1.5 md:p-2.5 flex flex-col gap-1 transition-all relative group ${isActive ? 'bg-studio-orange/10 dark:bg-studio-orange/20' : 'card-bg hover:bg-studio-sand/40 dark:hover:bg-studio-brown/10'
                }`}
            >
              <div className="flex justify-between items-start w-full">
                <span className={`text-sm font-black ${isActive ? 'text-studio-orange' : (isToday ? 'text-studio-orange border-b-2 border-studio-orange pb-0.5' : 'text-studio-black dark:text-studio-beige')}`}>
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
  );
};

export default MonthlyCalendar;