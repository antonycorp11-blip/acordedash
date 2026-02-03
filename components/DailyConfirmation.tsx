
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
    return { currentSlots: filtered.sort((a,b) => a.time.localeCompare(b.time)), dowIdx: dow };
  }, [slots, selTeacherId, selDate, overrides]);

  const confIds = confirmations[selDate] || [];

  const handleGenTeacherMsg = () => {
    const t = teachers.find(x => x.id === selTeacherId);
    const confirmed = currentSlots.filter(s => confIds.includes(s.id));
    if(!confirmed.length) return onToast("Selecione aulas confirmadas", "error");
    
    let text = `Olá, *${t?.name}*! 👋\nSua agenda de *${DAYS_OF_WEEK[dowIdx]}* (${fmtDate(selDate)}):\n\n`;
    confirmed.forEach(s => text += `✅ *${s.time}* - ${s.studentName} [${s.instrument}${s.isExperimental ? ' - EXP':''}]\n`);
    text += `\n*Pode confirmar o recebimento?*`;
    
    setModalTitle("Agenda do Professor");
    setModalMsg(text);
    setShowModal(true);
  };

  const handleGenStudentMsg = (s: ScheduleSlot) => {
    const h = parseInt(s.time.split(':')[0]);
    const limit = h < 12 ? "as *18:00 de HOJE*" : `as *${String(h-3).padStart(2,'0')}:${s.time.split(':')[1]}* (3h antes)`;
    const text = `Olá, *${s.studentName}*! 👋\nConfirmamos sua aula de *${s.instrument}* dia *${fmtDate(selDate)}* às *${s.time}*?\n\nFavor confirmar até ${limit}. Obrigado!`;
    
    setModalTitle("Confirmar com Aluno");
    setModalMsg(text);
    setShowModal(true);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(modalMsg);
    onToast("Copiado com sucesso!", "success");
    // Se for agenda de professor, facilitamos a abertura pós-cópia
    if (modalTitle.includes("Professor")) {
       setTimeout(() => {
         window.open(`https://wa.me/?text=${encodeURIComponent(modalMsg)}`, '_blank');
       }, 500);
    }
  };

  return (
    <div className="space-y-10 animate-fade-in">
      {/* Botões de Importação/Reset */}
      <div className="flex gap-4 bg-white dark:bg-slate-900 p-5 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-800">
        <button onClick={() => fileRef.current?.click()} className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/30 active:scale-95 transition-all flex items-center justify-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          Importar XLSX
        </button>
        <button onClick={onClearAll} className="flex-1 py-4 bg-slate-50 dark:bg-slate-800 text-slate-400 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:text-red-500 transition-all">
          Resetar
        </button>
        <input type="file" ref={fileRef} className="hidden" accept=".xlsx" onChange={e => { const f=e.target.files?.[0]; if(f) onImport(f); }} />
      </div>

      {/* Carrossel de Professores */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] px-4">Professores Cadastrados</h3>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 px-1">
          {teachers.map(t => (
            <button 
              key={t.id} 
              onClick={() => setSelTeacherId(t.id)} 
              className={`px-7 py-4 rounded-3xl text-[12px] font-black uppercase transition-all border-2 whitespace-nowrap shadow-sm ${
                selTeacherId === t.id 
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-500/20' 
                : 'bg-white dark:bg-slate-900 text-slate-500 border-transparent hover:border-slate-200 dark:hover:border-slate-700'
              }`}
            >
              {t.name.split(' ')[0]}
            </button>
          ))}
          {teachers.length === 0 && <p className="text-[11px] font-bold text-slate-400 italic px-4 py-4 opacity-50">Nenhuma planilha importada.</p>}
        </div>
      </div>

      {/* Seletor de Data Premium */}
      <div className="bg-white dark:bg-slate-900 p-7 rounded-[2.5rem] shadow-xl border border-slate-50 dark:border-slate-800 flex items-center justify-between group transition-all hover:shadow-2xl">
        <div className="space-y-1">
          <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Agendamentos para:</p>
          <input 
            type="date" 
            value={selDate} 
            onChange={e => setSelDate(e.target.value)} 
            className="bg-transparent dark:text-white text-xl font-black uppercase outline-none cursor-pointer" 
          />
        </div>
        <div className="text-right">
          <div className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{DAYS_OF_WEEK[dowIdx]}</div>
          <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">{currentSlots.length} Aulas Totais</div>
        </div>
      </div>

      {/* Lista de Aulas (Checklist) */}
      <div className="space-y-4">
        {currentSlots.map(s => {
          const isC = confIds.includes(s.id);
          return (
            <div 
              key={s.id} 
              onClick={() => onToggle(selDate, s.id)} 
              className={`flex items-center justify-between p-6 rounded-[2.5rem] border-2 transition-all cursor-pointer active:scale-[0.98] group relative overflow-hidden ${
                isC 
                ? 'bg-indigo-600 border-indigo-600 shadow-2xl shadow-indigo-500/30' 
                : 'bg-white dark:bg-slate-900 border-slate-50 dark:border-slate-800 hover:border-indigo-100 dark:hover:border-indigo-900/40 hover:shadow-lg'
              }`}
            >
              <div className="flex items-center gap-5 z-10">
                <div className={`w-9 h-9 rounded-2xl flex items-center justify-center border-2 transition-all ${
                  isC ? 'bg-white text-indigo-600 border-white' : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-transparent'
                }`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="4"><path d="M5 13l4 4L19 7" /></svg>
                </div>
                <div>
                  <div className={`text-base font-black leading-none ${isC ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                    {s.time} — {s.studentName}
                  </div>
                  <div className={`text-[11px] font-black uppercase tracking-widest mt-2 ${isC ? 'text-indigo-200' : 'text-slate-400'}`}>
                    {s.instrument} {s.isExperimental && <span className="bg-orange-400/20 text-orange-500 px-2 py-0.5 rounded-lg ml-2 border border-orange-400/30">EXPERIMENTAL</span>}
                  </div>
                </div>
              </div>

              {!isC && (
                <button 
                  onClick={e => {
                    e.stopPropagation();
                    handleGenStudentMsg(s);
                  }} 
                  className="w-14 h-14 bg-emerald-500 text-white rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-emerald-500/20 active:scale-90 transition-all hover:bg-emerald-600 z-10"
                >
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>
                </button>
              )}
            </div>
          );
        })}
        {currentSlots.length === 0 && (
          <div className="py-24 text-center opacity-30">
            <div className="w-16 h-16 border-4 border-dashed border-indigo-200 dark:border-indigo-900/50 rounded-full mx-auto animate-spin mb-4"></div>
            <p className="text-[11px] font-black uppercase tracking-[0.5em] text-slate-500">Sem agendamentos</p>
          </div>
        )}
      </div>

      {/* Botão de Enviar Agenda (Fixo) */}
      {currentSlots.length > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-full max-w-sm z-40 px-6">
          <button 
            onClick={handleGenTeacherMsg} 
            className="w-full py-6 bg-indigo-600 text-white rounded-[2.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-indigo-500/40 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-4 group"
          >
            <span>Enviar Agenda de Professor</span>
            <span className="bg-white/20 px-4 py-1.5 rounded-full text-[10px] group-hover:scale-110 transition-transform">{confIds.length} Confirmados</span>
          </button>
        </div>
      )}

      {/* Modal de Exibição de Mensagem Premium */}
      {showModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 backdrop-blur-md p-6 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-[3.5rem] w-full max-w-sm overflow-hidden shadow-2xl animate-pop-in border border-white/10">
            <div className="bg-indigo-600 p-8 text-white flex justify-between items-center">
              <span className="font-black text-xs uppercase tracking-[0.3em]">{modalTitle}</span>
              <button onClick={() => setShowModal(false)} className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-full text-2xl font-bold leading-none hover:bg-white/20 transition-all">&times;</button>
            </div>
            <div className="p-10 space-y-8">
              <div className="relative group">
                <pre className="bg-slate-50 dark:bg-slate-800 p-7 rounded-[2.5rem] text-[11px] font-mono whitespace-pre-wrap dark:text-slate-200 border border-slate-100 dark:border-slate-700 max-h-72 overflow-y-auto no-scrollbar select-all leading-relaxed">
                  {modalMsg}
                </pre>
                <div className="absolute top-4 right-4 text-[9px] font-black text-slate-300 uppercase select-none opacity-0 group-hover:opacity-100 transition-opacity">Visualização</div>
              </div>
              <button 
                onClick={copyToClipboard} 
                className="w-full py-6 bg-emerald-500 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-emerald-500/30 active:scale-95 transition-all flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
                Copiar Mensagem
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyConfirmation;
