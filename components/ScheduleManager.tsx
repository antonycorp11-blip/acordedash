
import React, { useState, useMemo, useEffect } from 'react';
import { Teacher, ScheduleSlot, DAYS_OF_WEEK } from '../types';

interface Props {
  teachers: Teacher[];
  slots: ScheduleSlot[];
  onAddSlot: (slot: Omit<ScheduleSlot, 'id' | 'createdAt'>) => void;
  onDeleteSlot: (id: string) => void;
  onClearAll: () => void;
}

const INSTRUMENTS = ['Violão', 'Teclado', 'Guitarra', 'Baixo', 'Bateria', 'Vocal'];

const ScheduleManager: React.FC<Props> = ({ teachers, slots, onAddSlot, onDeleteSlot, onClearAll }) => {
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(teachers[0]?.id || '');
  const [day, setDay] = useState(1);
  const [time, setTime] = useState('');
  const [student, setStudent] = useState('');
  const [instrument, setInstrument] = useState('');
  const [isExperimental, setIsExperimental] = useState(false);

  useEffect(() => {
    if (!selectedTeacherId && teachers.length > 0) {
      setSelectedTeacherId(teachers[0].id);
    }
  }, [teachers, selectedTeacherId]);

  const sortedSlots = useMemo(() => {
    return [...slots]
      .filter(s => s.teacherId === selectedTeacherId)
      .sort((a, b) => {
        if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
        return a.time.localeCompare(b.time);
      });
  }, [slots, selectedTeacherId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacherId || !time || !student || !instrument) {
      alert("Preencha todos os campos.");
      return;
    }
    onAddSlot({ teacherId: selectedTeacherId, dayOfWeek: day, time, studentName: student, instrument, isExperimental });
    setTime(''); setStudent(''); setIsExperimental(false);
  };

  if (teachers.length === 0) {
    return (
      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-400 p-6 rounded-xl text-center font-bold text-sm">
        Cadastre um professor antes de gerenciar a agenda.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 mb-2">
        <button onClick={onClearAll} className="flex-1 bg-white dark:bg-slate-900 border border-red-100 dark:border-red-900/30 text-red-500 py-2.5 rounded-xl text-[10px] font-black uppercase shadow-sm">Limpeza Geral</button>
      </div>

      <div className="flex flex-wrap gap-1 bg-white dark:bg-slate-900 p-2 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-x-auto no-scrollbar">
        {teachers.map(t => (
          <button
            key={t.id}
            onClick={() => setSelectedTeacherId(t.id)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase transition-all whitespace-nowrap ${
              selectedTeacherId === t.id ? 'bg-indigo-600 text-white' : 'bg-slate-50 dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:bg-slate-100'
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-7 gap-1">
            {DAYS_OF_WEEK.map((d, i) => (
              <button key={i} type="button" onClick={() => setDay(i)} className={`py-2 rounded-lg text-[10px] font-black uppercase transition-all border ${day === i ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 dark:bg-slate-800 text-gray-400 dark:text-slate-500 border-gray-100 dark:border-slate-700 hover:border-indigo-200'}`}>{d.substring(0, 3)}</button>
            ))}
          </div>
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-4 sm:col-span-3">
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required className="w-full px-2 py-2 bg-slate-50 dark:bg-slate-800 dark:text-white border border-gray-200 dark:border-slate-700 rounded-lg text-xs font-bold outline-none" />
            </div>
            <div className="col-span-8 sm:col-span-9">
              <input type="text" value={student} onChange={(e) => setStudent(e.target.value)} placeholder="Nome do Aluno" required className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 dark:text-white border border-gray-200 dark:border-slate-700 rounded-lg text-xs font-bold outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">
            {INSTRUMENTS.map(inst => (
              <button key={inst} type="button" onClick={() => setInstrument(inst)} className={`py-2 rounded-lg text-[10px] font-bold border transition-all ${instrument === inst ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800' : 'bg-white dark:bg-slate-800 text-gray-400 dark:text-slate-500 border-gray-100 dark:border-slate-700'}`}>{inst}</button>
            ))}
          </div>
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={isExperimental} onChange={(e) => setIsExperimental(e.target.checked)} className="w-4 h-4 text-indigo-600 border-gray-300 dark:border-slate-700 rounded" />
              <span className="text-[10px] font-black uppercase text-gray-500 dark:text-slate-400">Aula Experimental</span>
            </label>
            <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-xs font-black uppercase hover:bg-indigo-700 shadow-md">Adicionar</button>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {DAYS_OF_WEEK.map((dayName, dayIdx) => {
          const daySlots = sortedSlots.filter(s => s.dayOfWeek === dayIdx);
          if (daySlots.length === 0) return null;
          return (
            <div key={dayIdx} className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
              <div className="bg-slate-50 dark:bg-slate-800 px-3 py-1.5 border-b border-gray-100 dark:border-slate-700 font-black text-[9px] text-gray-400 dark:text-slate-500 uppercase flex justify-between">
                <span>{dayName}</span><span>{daySlots.length} aulas</span>
              </div>
              <div className="p-2 space-y-1">
                {daySlots.map(slot => (
                  <div key={slot.id} className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900/50 group transition-all">
                    <div className="leading-none overflow-hidden">
                      <div className="flex items-center gap-1.5"><span className="font-black text-indigo-700 dark:text-indigo-400 text-[11px]">{slot.time}</span><span className="text-gray-800 dark:text-slate-200 font-bold text-[11px] truncate">{slot.studentName}</span></div>
                      <div className="text-[9px] font-black text-gray-400 dark:text-slate-500 uppercase mt-0.5">{slot.instrument} {slot.isExperimental && <span className="text-orange-500">EXP</span>}</div>
                    </div>
                    <button onClick={() => window.confirm("Remover?") && onDeleteSlot(slot.id)} className="text-gray-300 dark:text-slate-700 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-all">×</button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ScheduleManager;
