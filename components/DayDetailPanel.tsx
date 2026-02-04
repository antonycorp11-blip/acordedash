
import React, { useMemo, useState } from 'react';
import { Teacher, ScheduleSlot, Confirmations, DAYS_OF_WEEK } from '../types';

interface Props {
  date: string;
  teacherId: string;
  teachers: Teacher[];
  slots: ScheduleSlot[];
  confirmations: Confirmations;
  contactedStatuses: Record<string, string[]>;
  onToggle: (date: string, id: string) => void;
  onContact: (date: string, id: string) => void;
  onToast: (msg: string, type?: string) => void;
}

const DayDetailPanel: React.FC<Props> = ({ date, teacherId, teachers, slots, confirmations, contactedStatuses, onToggle, onContact, onToast }) => {
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState({ title: '', body: '', slotId: '' });

  const { daySlots, dowName, teacherName } = useMemo(() => {
    const [y, m, d] = date.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dow = dateObj.getDay();
    const t = teachers.find(x => x.id === teacherId);

    const filtered = slots
      .filter(s => {
        const matchesTeacher = teacherId ? s.teacherId === teacherId : true;
        if (!matchesTeacher) return false;

        // Se a aula tem uma data específica, usa ela. Caso contrário, usa o dia da semana.
        if (s.date) return s.date === date;
        return s.dayOfWeek === dow;
      })
      .sort((a, b) => a.time.localeCompare(b.time));

    return {
      daySlots: filtered,
      dowName: DAYS_OF_WEEK[dow],
      teacherName: t?.name || 'Todos os Docentes'
    };
  }, [date, teacherId, slots, teachers]);

  const confirmedIds = confirmations[date] || [];
  const contactedIds = contactedStatuses[date] || [];

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    onToast("Copiado com sucesso!", "success");
    if (modalData.slotId) onContact(date, modalData.slotId);
    setShowModal(false);
  };

  const handleWhatsApp = (text: string) => {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    if (modalData.slotId) onContact(date, modalData.slotId);
    setShowModal(false);
  };

  const handleTeacherMsg = () => {
    const confirmed = daySlots.filter(s => confirmedIds.includes(s.id));
    if (!confirmed.length) return onToast("Marque as aulas que foram dadas", "error");

    let text = `Olá, *${teacherName}*! 👋\nSua agenda de *${dowName}* (${date.split('-').reverse().join('/')}):\n\n`;
    confirmed.forEach(s => text += `✅ *${s.time}* - ${s.studentName} [${s.instrument}${s.isExperimental ? ' - EXP' : ''}]\n`);
    text += `\n*Confirmado?*`;

    setModalData({ title: "RELATÓRIO DE AULAS", body: text, slotId: '' });
    setShowModal(true);
  };

  const handleStudentMsg = (s: ScheduleSlot) => {
    const h = parseInt(s.time.split(':')[0]);
    const [y, m, d] = date.split('-').map(Number);
    const lessonDateObj = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    lessonDateObj.setHours(0, 0, 0, 0);

    const diffTime = lessonDateObj.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const formattedDate = date.split('-').reverse().slice(0, 2).join('/');

    let dateReference = `no dia *${formattedDate}*`;
    if (diffDays === 0) {
      dateReference = "hoje";
    } else if (diffDays === 1) {
      dateReference = `amanhã dia *${formattedDate}*`;
    }

    let text = "";
    let title = "CONFIRMAÇÃO DO ALUNO";

    if (s.isExperimental) {
      title = "BOAS-VINDAS (EXP)";
      text = `Olá, *${s.studentName.split(' ')[0]}*! 👋\n\nEstamos muito felizes em receber você para sua *Aula Experimental* de *${s.instrument}* aqui na *ConfirmAula Studio*! 🎸\n\n📍 Sua aula será no dia: *${formattedDate}* (${dowName.split('-')[0]})\n⏰ Horário: *${s.time}*\n\nPodemos confirmar sua presença? Qualquer dúvida, estamos à disposição! 🚀`;
    } else {
      const limit = h < 12 ? "as *18:00 de HOJE*" : `as *${String(h - 3).padStart(2, '0')}:${s.time.split(':')[1]}* (3h antes)`;
      text = `Olá, *${s.studentName}*! 👋\nPodemos confirmar sua aula de *${s.instrument}* ${dateReference} às *${s.time}*?\n\nFavor confirmar até ${limit}. Obrigado!`;
    }

    setModalData({ title, body: text, slotId: s.id });
    setShowModal(true);
  };

  return (
    <aside className="w-full md:w-[340px] h-full flex flex-col border-l border-studio-brown/10 main-container overflow-hidden animate-slide">
      <div className="p-5 pb-3 space-y-1">
        <span className="text-[10px] font-black uppercase text-studio-orange tracking-[0.3em]">AGENDA DIÁRIA</span>
        <h4 className="text-xl font-black text-studio-black dark:text-studio-beige uppercase tracking-tight leading-none">{dowName}</h4>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs font-bold text-studio-brown/60 dark:text-studio-beige/40 uppercase tracking-widest">{date.split('-').reverse().join('/')}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2.5 no-scrollbar">
        {daySlots.map(s => {
          const isConfirmed = confirmedIds.includes(s.id);
          const isContacted = contactedIds.includes(s.id);

          let statusClass = 'card-bg hover:border-studio-orange/30';
          let timeIconClass = 'bg-studio-sand dark:bg-studio-brown/50 text-studio-brown dark:text-studio-beige/50';

          if (isConfirmed) {
            statusClass = 'bg-emerald-100/50 border-emerald-400 dark:bg-emerald-900/10 dark:border-emerald-700 shadow-inner';
            timeIconClass = 'bg-emerald-500 text-white';
          } else if (isContacted) {
            statusClass = 'bg-amber-100/50 border-amber-400 dark:bg-amber-900/10 dark:border-amber-700 shadow-inner';
            timeIconClass = 'bg-amber-400 text-white';
          }

          return (
            <div
              key={s.id}
              onClick={() => onToggle(date, s.id)}
              className={`group flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${statusClass}`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`w-9 h-9 min-w-[36px] rounded-xl flex items-center justify-center font-black text-[11px] ${timeIconClass}`}>
                  {s.time}
                </div>
                <div className="flex-1 min-w-0 pr-2">
                  <div className="font-bold text-[13px] text-studio-black dark:text-studio-beige uppercase truncate leading-tight w-full">
                    {s.studentName}
                  </div>
                  <div className="text-[9px] font-black uppercase text-studio-brown/40 dark:text-studio-beige/20 tracking-wider truncate mt-0.5">
                    {s.instrument} {s.isExperimental && <span className="text-studio-orange">• EXP</span>}
                  </div>
                </div>
              </div>

              {!isConfirmed && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleStudentMsg(s); }}
                  className={`p-2 rounded-xl transition-all shadow-sm flex-shrink-0 flex items-center justify-center ${isContacted ? 'bg-amber-400 text-white' : 'bg-studio-sand dark:bg-studio-brown/20 text-studio-orange hover:bg-studio-orange hover:text-white'}`}
                  title="Notificar Aluno"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766 0-3.18-2.587-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.747-2.874-2.512-2.96-2.626-.087-.115-.708-.941-.708-1.795 0-.853.448-1.274.607-1.446.159-.172.346-.215.46-.215.115 0 .231.002.331.006.106.004.248-.04.388.297.144.346.491 1.197.534 1.284.043.087.072.188.014.303-.058.115-.087.188-.173.289l-.26.303c-.087.101-.177.211-.077.383.101.173.447.738.961 1.195.662.59 1.221.774 1.394.86.173.088.274.072.376-.043.101-.115.432-.504.547-.677.115-.172.231-.144.389-.086.158.058 1.008.476 1.181.563.173.087.288.13.331.202.043.072.043.418-.101.823z" />
                  </svg>
                </button>
              )}
            </div>
          );
        })}
        {daySlots.length === 0 && (
          <div className="py-16 text-center opacity-20 flex flex-col items-center gap-3">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            <p className="text-[10px] font-black uppercase tracking-[0.4em]">Agenda Livre</p>
          </div>
        )}
      </div>

      {daySlots.length > 0 && (
        <div className="p-5 border-t border-studio-brown/5 card-bg">
          <button
            onClick={handleTeacherMsg}
            className="w-full py-4 bg-studio-orange text-white rounded-2xl font-black text-xs uppercase tracking-[0.15em] shadow-xl shadow-studio-orange/20 active:scale-95 transition-all flex items-center justify-center gap-3"
          >
            ENVIAR RELATÓRIO
            <span className="bg-white/20 px-2 py-1 rounded-lg text-[10px]">{confirmedIds.length}</span>
          </button>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-studio-black/80 backdrop-blur-md p-6">
          <div className="card-bg rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-studio-brown/10 animate-slide">
            <div className="p-5 border-b border-studio-brown/5 flex justify-between items-center bg-studio-orange text-white">
              <span className="text-xs font-black uppercase tracking-widest">{modalData.title}</span>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-all font-bold text-xl">&times;</button>
            </div>
            <div className="p-6 space-y-6">
              <pre className="bg-studio-sand dark:bg-studio-brown/20 p-5 rounded-2xl text-[11px] font-bold text-studio-brown dark:text-studio-beige border border-studio-brown/10 max-h-56 overflow-y-auto no-scrollbar leading-relaxed whitespace-pre-wrap">
                {modalData.body}
              </pre>
              <div className="flex gap-3">
                <button onClick={() => handleCopy(modalData.body)} className="flex-1 py-4 bg-studio-sand dark:bg-studio-brown text-studio-brown dark:text-studio-beige rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-studio-brown/5 transition-all">Copiar</button>
                <button onClick={() => handleWhatsApp(modalData.body)} className="flex-1 py-4 bg-studio-orange text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-studio-orange/30 hover:brightness-110 active:scale-95 transition-all">WhatsApp</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

export default DayDetailPanel;
