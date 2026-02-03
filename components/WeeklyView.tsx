
import React, { useMemo } from 'react';
import { ScheduleSlot, Teacher, DAYS_OF_WEEK } from '../types';

interface Props {
  slots: ScheduleSlot[];
  teachers: Teacher[];
  teacherId: string;
}

const WeeklyView: React.FC<Props> = ({ slots, teachers, teacherId }) => {
  const weeklyData = useMemo(() => {
    const days = [1, 2, 3, 4, 5, 6, 0]; // Começa na Segunda
    return days.map(dow => {
      const daySlots = slots.filter(s => (teacherId ? s.teacherId === teacherId : true) && s.dayOfWeek === dow);

      // Deduplicação para a Grade Semanal: Se o mesmo aluno tem a mesma aula no mesmo horário em semanas diferentes, mostra apenas uma vez.
      const seen = new Set();
      const uniqueDaySlots = daySlots.filter(s => {
        const key = `${s.time}-${s.studentName}-${s.teacherId}-${s.instrument}`.toUpperCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).sort((a, b) => a.time.localeCompare(b.time));

      return { dow, slots: uniqueDaySlots };
    });
  }, [slots, teacherId]);

  return (
    <div className="flex h-full gap-2.5 animate-slide overflow-x-auto overflow-y-hidden no-scrollbar weekly-view-container pb-4 md:pb-0">
      {weeklyData.map(({ dow, slots: daySlots }) => (
        <div key={dow} className="flex-1 flex flex-col gap-2 min-w-[140px] bg-studio-sand/30 dark:bg-studio-brown/10 rounded-3xl border border-studio-sand dark:border-studio-brown/20 p-2.5">
          <div className="card-bg p-3 rounded-2xl text-center shadow-sm">
            <div className="text-xs font-black uppercase text-studio-orange tracking-widest">{DAYS_OF_WEEK[dow].split('-')[0]}</div>
            <div className="text-[10px] font-bold text-studio-brown/40 dark:text-studio-beige/30 mt-1 uppercase">{daySlots.length} aulas</div>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-2 pr-0.5">
            {daySlots.map(s => {
              const prof = teachers.find(t => t.id === s.teacherId)?.name.split(' ')[0] || '?';
              return (
                <div key={s.id} className="p-3 card-bg rounded-2xl shadow-sm hover:shadow-xl transition-all">
                  <div className="text-[11px] font-black text-studio-orange mb-1">{s.time}</div>
                  <div className="text-sm font-bold text-studio-black dark:text-studio-beige leading-snug mb-2">{s.studentName}</div>
                  <div className="text-[10px] font-black text-studio-brown/50 dark:text-studio-beige/40 uppercase flex flex-col gap-1 border-t border-studio-sand dark:border-studio-brown/10 pt-2">
                    <span className="truncate">{s.instrument}</span>
                    <span className="text-studio-brown dark:text-studio-beige/60 truncate font-extrabold">{prof}</span>
                  </div>
                </div>
              );
            })}
            {daySlots.length === 0 && (
              <div className="flex-1 flex items-center justify-center py-20 opacity-10 font-black text-[10px] tracking-[0.3em] uppercase [writing-mode:vertical-lr] text-studio-brown">Vazio</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default WeeklyView;
