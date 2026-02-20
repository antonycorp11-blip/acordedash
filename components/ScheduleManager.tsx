
import React, { useState, useMemo, useEffect } from 'react';
import { Teacher, ScheduleSlot, DAYS_OF_WEEK } from '../types';

interface Props {
  teachers: Teacher[];
  slots: ScheduleSlot[];
  onAddSlot: (slot: Omit<ScheduleSlot, 'id' | 'createdAt'>) => void;
  onDeleteSlot: (id: string) => void;
  onClearAll: () => void;
}

const INSTRUMENTS = ['Violão', 'Teclado', 'Guitarra', 'Baixo', 'Bateria', 'Vocal', 'Violino', 'Piano', 'Sopro'];

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
      alert("Preencha todos os campos obrigatórios.");
      return;
    }
    onAddSlot({ teacherId: selectedTeacherId, dayOfWeek: day, time, studentName: student, instrument, isExperimental });
    setTime(''); setStudent(''); setIsExperimental(false);
  };

  if (teachers.length === 0) {
    return (
      <div className="bg-studio-orange/10 border border-studio-orange/20 text-studio-orange p-10 rounded-[3rem] text-center font-black text-xs uppercase tracking-widest">
        Cadastre professores na aba Equipe antes de gerenciar a grade.
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-slide pb-24 max-w-5xl mx-auto">
      {/* Header Info */}
      <div className="flex justify-between items-center px-4">
        <h2 className="text-[10px] font-black text-studio-brown/40 uppercase tracking-[0.4em]">Gestão de Grade Fixa</h2>
        <button onClick={() => confirm("Apagar toda a grade permanentemente?") && onClearAll()} className="text-[9px] font-black text-red-500 uppercase tracking-widest hover:underline px-4 py-2 bg-red-50 dark:bg-red-900/10 rounded-xl">Limpeza Total</button>
      </div>

      {/* Teacher Tabs */}
      <div className="flex gap-2 bg-studio-sand/10 dark:bg-studio-brown/10 p-2 rounded-[2.5rem] border border-studio-brown/5 overflow-x-auto no-scrollbar">
        {teachers.map(t => (
          <button
            key={t.id}
            onClick={() => setSelectedTeacherId(t.id)}
            className={`px-8 py-3.5 rounded-[2rem] text-[11px] font-black uppercase transition-all whitespace-nowrap ${selectedTeacherId === t.id ? 'bg-studio-orange text-white shadow-lg shadow-studio-orange/20' : 'text-studio-brown/40 hover:text-studio-orange'
              }`}
          >
            {t.name}
          </button>
        ))}
      </div>

      {/* Add Slot Form */}
      <div className="card-bg p-8 rounded-[3.5rem] border border-studio-brown/5 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-wrap gap-2 justify-center">
            {DAYS_OF_WEEK.map((d, i) => (
              <button key={i} type="button" onClick={() => setDay(i)} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase transition-all border ${day === i ? 'bg-studio-black text-white border-studio-black' : 'card-bg border-studio-sand dark:border-studio-brown/20 text-studio-brown/40 hover:border-studio-orange'}`}>{d.substring(0, 3)}</button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase text-studio-brown/40 ml-4">Horário</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required className="w-full px-6 py-4 bg-studio-sand/10 dark:bg-studio-brown/20 dark:text-studio-beige border border-studio-sand dark:border-studio-brown/10 rounded-2xl text-sm font-black outline-none" />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase text-studio-brown/40 ml-4">Estudante</label>
              <input type="text" value={student} onChange={(e) => setStudent(e.target.value)} placeholder="Ex: João Silva" required className="w-full px-6 py-4 bg-studio-sand/10 dark:bg-studio-brown/20 dark:text-studio-beige border border-studio-sand dark:border-studio-brown/10 rounded-2xl text-sm font-black outline-none" />
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[9px] font-black uppercase text-studio-brown/40 ml-4">Instrumento</label>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {INSTRUMENTS.map(inst => (
                <button key={inst} type="button" onClick={() => setInstrument(inst)} className={`px-4 py-2.5 rounded-xl text-[9px] font-black border transition-all ${instrument === inst ? 'bg-studio-orange/10 text-studio-orange border-studio-orange' : 'card-bg text-studio-brown/40 border-studio-sand dark:border-studio-brown/10 hover:border-studio-orange/30'}`}>{inst}</button>
              ))}
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-4 border-t border-studio-brown/5">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center transition-all ${isExperimental ? 'bg-studio-orange border-studio-orange text-white' : 'border-studio-sand dark:border-studio-brown/20'}`}>
                {isExperimental && <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="4"><path d="M5 13l4 4L19 7" /></svg>}
              </div>
              <input type="checkbox" checked={isExperimental} onChange={(e) => setIsExperimental(e.target.checked)} className="hidden" />
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase text-studio-black dark:text-studio-beige">Aula Experimental</span>
                <span className="text-[8px] font-bold text-studio-brown/40 uppercase">Marcado em destaque na agenda</span>
              </div>
            </label>
            <button type="submit" className="w-full md:w-auto px-16 py-4 bg-studio-orange text-white rounded-2xl text-xs font-black uppercase shadow-xl shadow-studio-orange/20 active:scale-95 transition-all">Adicionar à Grade</button>
          </div>
        </form>
      </div>

      {/* Weekly View Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {DAYS_OF_WEEK.map((dayName, dayIdx) => {
          const daySlots = sortedSlots.filter(s => s.dayOfWeek === dayIdx);
          if (daySlots.length === 0) return null;
          return (
            <div key={dayIdx} className="card-bg rounded-[3rem] border border-studio-brown/5 shadow-sm overflow-hidden flex flex-col">
              <div className="bg-studio-sand/10 dark:bg-studio-brown/10 px-6 py-4 border-b border-studio-brown/5 font-black text-[10px] text-studio-orange uppercase flex justify-between">
                <span>{dayName}</span><span className="opacity-50 tracking-widest">{daySlots.length} AULAS</span>
              </div>
              <div className="p-4 space-y-2">
                {daySlots.map(slot => (
                  <div key={slot.id} className="flex items-center justify-between px-5 py-4 rounded-[1.5rem] bg-white/50 dark:bg-studio-brown/5 border border-studio-sand dark:border-studio-brown/10 group hover:border-studio-orange/30 transition-all">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-studio-orange text-xs">{slot.time}</span>
                        <span className="text-studio-black dark:text-studio-beige font-black text-xs truncate">{slot.studentName}</span>
                      </div>
                      <div className="text-[9px] font-bold text-studio-brown/40 uppercase mt-1 tracking-widest">
                        {slot.instrument} {slot.isExperimental && <span className="text-studio-orange ml-1">• EXP</span>}
                      </div>
                    </div>
                    <button onClick={() => confirm("Remover?") && onDeleteSlot(slot.id)} className="w-8 h-8 rounded-full flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 opacity-0 group-hover:opacity-100 transition-all">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" /></svg>
                    </button>
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
