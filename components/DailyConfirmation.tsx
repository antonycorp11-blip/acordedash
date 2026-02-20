
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Teacher, ScheduleSlot, Confirmations, DAYS_OF_WEEK, DateOverrides } from '../types';

interface Props {
  teachers: Teacher[];
  slots: ScheduleSlot[];
  confirmations: Confirmations;
  overrides: DateOverrides;
  onToggle: (date: string, id: string) => void;
  onClearDay: (date: string) => void;
  onImport: (file: File) => void;
  onClearAll: () => void;
  onToast: (msg: string, type?: string) => void;
}

const fmtDate = (d: string) => {
  const [y, m, day] = d.split('-');
  return `${day}/${m}`;
};

const DailyConfirmation: React.FC<Props> = ({
  teachers, slots, confirmations, overrides, onToggle, onClearDay, onImport, onClearAll, onToast
}) => {
  const [selTeacherId, setSelTeacherId] = useState('');
  const [selDate, setSelDate] = useState(new Date().toISOString().split('T')[0]);
  const [modalMsg, setModalMsg] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!selTeacherId && teachers.length > 0) setSelTeacherId(teachers[0].id);
  }, [teachers]);

  const { currentSlots, dowIdx } = useMemo(() => {
    const [y, m, d] = selDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const dow = date.getDay();
    const daily = overrides[selDate] || { hidden: [] };
    const filtered = slots.filter(s => s.teacherId === selTeacherId && s.dayOfWeek === dow && !daily.hidden.includes(s.id));
    return { currentSlots: filtered.sort((a, b) => a.time.localeCompare(b.time)), dowIdx: dow };
  }, [slots, selTeacherId, selDate, overrides]);

  const confIds = confirmations[selDate] || [];

  const handleGenTeacherMsg = () => {
    const t = teachers.find(x => x.id === selTeacherId);
    const confirmed = currentSlots.filter(s => confIds.includes(s.id));
    if (!confirmed.length) return onToast("Selecione aulas confirmadas", "error");

    let text = `Olá, *${t?.name}*! 👋\nSua agenda de *${DAYS_OF_WEEK[dowIdx]}* (${fmtDate(selDate)}):\n\n`;
    confirmed.forEach(s => text += `✅ *${s.time}* - ${s.studentName} [${s.instrument}${s.isExperimental ? ' - EXP' : ''}]\n`);
    text += `\n*Pode confirmar o recebimento?*`;

    setModalTitle("Agenda do Professor");
    setModalMsg(text);
    setShowModal(true);
  };

  const handleGenStudentMsg = (s: ScheduleSlot) => {
    const h = parseInt(s.time.split(':')[0]);
    const limit = h < 12 ? "as *18:00 de HOJE*" : `as *${String(h - 3).padStart(2, '0')}:${s.time.split(':')[1]}* (3h antes)`;
    const text = `Olá, *${s.studentName}*! 👋\nConfirmamos sua aula de *${s.instrument}* dia *${fmtDate(selDate)}* às *${s.time}*?\n\nFavor confirmar até ${limit}. Obrigado!`;

    setModalTitle("Confirmar com Aluno");
    setModalMsg(text);
    setShowModal(true);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(modalMsg);
    onToast("Copiado com sucesso!", "success");
    if (modalTitle.includes("Professor")) {
      setTimeout(() => {
        window.open(`https://wa.me/?text=${encodeURIComponent(modalMsg)}`, '_blank');
      }, 500);
    }
  };

  return (
    <div className="space-y-10 animate-slide pb-20">
      {/* Botões de Ação */}
      <div className="flex gap-4 p-5 rounded-[2.5rem] card-bg border border-studio-brown/5 shadow-sm">
        <button onClick={() => fileRef.current?.click()} className="flex-[2] py-4 bg-studio-orange text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-studio-orange/20 active:scale-95 transition-all flex items-center justify-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          Importar Arquivo
        </button>
        <button onClick={() => confirm("Apagar tudo?") && onClearAll()} className="flex-1 py-4 bg-studio-sand dark:bg-studio-brown/20 text-studio-brown/40 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:text-red-500 transition-all">
          Limpar
        </button>
        <input type="file" ref={fileRef} className="hidden" accept=".xlsx" onChange={e => { const f = e.target.files?.[0]; if (f) onImport(f); }} />
      </div>

      {/* Grid de Professores */}
      <div className="space-y-5">
        <div className="flex justify-between items-end px-4">
          <h3 className="text-[10px] font-black text-studio-brown/40 uppercase tracking-[0.3em]">Selecione o Docente</h3>
          <span className="text-[9px] font-black text-studio-orange uppercase tracking-widest">{teachers.length} Ativos</span>
        </div>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 px-1">
          {teachers.map(t => (
            <button
              key={t.id}
              onClick={() => setSelTeacherId(t.id)}
              className={`px-8 py-4 rounded-[2rem] text-[12px] font-black uppercase transition-all border whitespace-nowrap shadow-sm ${selTeacherId === t.id
                  ? 'bg-studio-black text-white border-studio-black dark:bg-studio-orange dark:border-studio-orange'
                  : 'card-bg border-studio-sand dark:border-studio-brown/20 text-studio-brown/60 dark:text-studio-beige/40'
                }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {/* Date Picker Header */}
      <div className="p-8 rounded-[3rem] card-bg border border-studio-brown/5 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col items-center md:items-start text-center md:text-left">
          <p className="text-[10px] font-black text-studio-orange uppercase tracking-widest mb-1">Data da Agenda</p>
          <input
            type="date"
            value={selDate}
            onChange={e => setSelDate(e.target.value)}
            className="bg-transparent dark:text-studio-beige text-2xl font-black uppercase outline-none cursor-pointer"
          />
        </div>
        <div className="flex flex-col items-center md:items-end text-center md:text-right px-8 py-3 bg-studio-orange/5 dark:bg-studio-orange/10 rounded-2xl border border-studio-orange/20">
          <div className="text-xl font-black text-studio-orange uppercase tracking-tight">{DAYS_OF_WEEK[dowIdx]}</div>
          <div className="text-[10px] font-bold text-studio-brown/40 uppercase tracking-[0.2em]">{currentSlots.length} Aulas Encontradas</div>
        </div>
      </div>

      {/* Slots List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {currentSlots.map(s => {
          const isC = confIds.includes(s.id);
          return (
            <div
              key={s.id}
              onClick={() => onToggle(selDate, s.id)}
              className={`flex items-center justify-between p-6 rounded-[2.5rem] border transition-all cursor-pointer active:scale-95 group relative overflow-hidden ${isC
                  ? 'bg-studio-orange text-white border-studio-orange shadow-xl shadow-studio-orange/20'
                  : 'card-bg border-studio-sand dark:border-studio-brown/20 hover:border-studio-orange/30'
                }`}
            >
              <div className="flex items-center gap-5 z-10 flex-1 min-w-0">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border-2 transition-all shrink-0 ${isC ? 'bg-white text-studio-orange border-white' : 'border-studio-sand dark:border-studio-brown/20 bg-studio-beige/50 dark:bg-studio-brown/20 text-transparent'
                  }`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="4"><path d="M5 13l4 4L19 7" /></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-base font-black leading-tight truncate ${isC ? 'text-white' : 'text-studio-black dark:text-studio-beige'}`}>
                    {s.time} — {s.studentName}
                  </div>
                  <div className={`text-[10px] font-black uppercase tracking-widest mt-1.5 ${isC ? 'text-white/70' : 'text-studio-brown/40'}`}>
                    {s.instrument} {s.isExperimental && <span className="text-studio-orange ml-2">• EXP</span>}
                  </div>
                </div>
              </div>

              {!isC && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    handleGenStudentMsg(s);
                  }}
                  className="w-12 h-12 card-bg text-studio-orange rounded-[1.2rem] flex items-center justify-center border border-studio-sand dark:border-studio-brown/20 active:scale-90 transition-all hover:bg-studio-orange hover:text-white hover:border-studio-orange z-10 lg:opacity-0 lg:group-hover:opacity-100"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {currentSlots.length === 0 && (
        <div className="py-24 text-center">
          <div className="text-[10px] font-black uppercase tracking-[0.5em] text-studio-brown/20">Vazio para este dia</div>
        </div>
      )}

      {/* Floating Action Button for Teacher Msg */}
      {currentSlots.length > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-full max-w-sm z-[100] px-6">
          <button
            onClick={handleGenTeacherMsg}
            className="w-full py-6 bg-studio-black dark:bg-studio-orange text-white rounded-[2.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-4 group"
          >
            <span>Enviar Agenda</span>
            <span className="bg-white/10 px-4 py-2 rounded-full text-[10px]">{confIds.length} Confirmados</span>
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-xl p-6">
          <div className="card-bg rounded-[3rem] w-full max-w-sm overflow-hidden shadow-2xl border border-studio-brown/10 animate-slide">
            <div className="p-8 bg-studio-orange text-white flex justify-between items-center">
              <span className="font-black text-xs uppercase tracking-widest">{modalTitle}</span>
              <button onClick={() => setShowModal(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-all font-bold text-xl">&times;</button>
            </div>
            <div className="p-8 space-y-6">
              <pre className="bg-studio-sand dark:bg-studio-brown/20 p-6 rounded-[2rem] text-[11px] font-bold text-studio-brown dark:text-studio-beige border border-studio-brown/10 max-h-72 overflow-y-auto no-scrollbar whitespace-pre-wrap leading-relaxed">
                {modalMsg}
              </pre>
              <button
                onClick={copyToClipboard}
                className="w-full py-5 bg-studio-black text-white rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"
              >
                Copiar e Abrir Whats
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyConfirmation;
