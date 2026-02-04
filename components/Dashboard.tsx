import React, { useMemo, useState } from 'react';
import { ScheduleSlot, Teacher, DAYS_OF_WEEK } from '../types';

interface Props {
  slots: ScheduleSlot[];
  teachers: Teacher[];
  onContact: (date: string, id: string) => void;
  isSyncing?: boolean;
}

const Dashboard: React.FC<Props> = ({ slots, teachers, onContact, isSyncing }) => {
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState({ title: '', body: '', slotId: '', date: '' });

  const analytics = useMemo(() => {
    // defaults if empty
    if (slots.length === 0 && teachers.length === 0) {
      return {
        totalSlots: 0,
        totalAlunosUnicos: 0,
        totalTeachers: 0,
        occupationRate: 0,
        experimentalWeekly: [],
        busiestDay: '-',
        topTeachers: [],
        instruments: [],
        peakTimes: [],
        freeReport: []
      };
    }

    // 1. Contagem de Alunos Únicos (Não repetidos)
    const uniqueStudentsSet = new Set(slots.map(s => s.studentName.trim().toUpperCase()));
    const totalAlunosUnicos = uniqueStudentsSet.size;

    // 1.1 Taxa de Ocupação Real (Calculada pela Grade Semanal Média)
    const salasTotais = 4;
    const hoursPerDay = 14; // 08:00 às 22:00
    const weekDaysCount = 6; // Seg a Sáb
    const baseWeeklyCapacity = salasTotais * hoursPerDay * weekDaysCount; // 336 slots

    // Agrupa por "Slot de Grade" para ver a ocupação da grade base
    const weeklyGradeSlots = slots.reduce((acc, s) => {
      const key = `${s.dayOfWeek}-${s.time}`;
      if (!acc[key]) acc[key] = new Set();
      // Em uma mesma hora/dia, podemos ter até 4 salas. 
      // Usamos o nome do aluno/professor para identificar ocupações distintas no mesmo horário
      acc[key].add(`${s.teacherId}-${s.studentName}`);
      return acc;
    }, {} as Record<string, Set<string>>);

    let totalWeeklyOccupied = 0;
    const keys = Object.keys(weeklyGradeSlots);
    for (const key of keys) {
      const pupils = weeklyGradeSlots[key];
      totalWeeklyOccupied += Math.min(salasTotais, pupils.size);
    }

    const occupationRate = baseWeeklyCapacity > 0 ? Math.round((totalWeeklyOccupied / baseWeeklyCapacity) * 100) : 0;

    // 1.2 Aulas Experimentais (DESTAQUE DA SEMANA)
    // Calcula o início e fim da semana atual
    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    const endOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 6));
    const startStr = startOfWeek.toISOString().split('T')[0];
    const endStr = endOfWeek.toISOString().split('T')[0];

    const experimentalWeekly = slots.filter(s =>
      s.isExperimental &&
      s.date && s.date >= startStr && s.date <= endStr
    ).sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    // 2. Dias mais cheios
    const dayCounts = slots.reduce((acc: Record<number, number>, s) => {
      acc[s.dayOfWeek] = (acc[s.dayOfWeek] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const dayEntries = Object.entries(dayCounts);
    const busiestDayIdx = dayEntries.length > 0
      ? Number(dayEntries.sort((a, b) => (b[1] as number) - (a[1] as number))[0][0])
      : 1;

    // 3. Professores com mais aulas (Carga de trabalho)
    const teacherCounts = slots.reduce((acc: Record<string, number>, s) => {
      acc[s.teacherId] = (acc[s.teacherId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topTeachers = (Object.entries(teacherCounts) as [string, number][])
      .sort((a, b) => b[1] - a[1])
      .map(([id, count]) => {
        // Busca profunda: Tenta encontrar o professor pelo ID
        const t = teachers.find(t => t.id === id);
        let displayName = t?.name || id;

        // Se o nome ainda for um UUID (comuns em dados legados), tenta limpar
        if (displayName.match(/^[0-9a-f-]{36}$/i)) {
          displayName = "Prof. em Transição";
        } else {
          displayName = displayName.replace('t-', '');
        }

        return {
          name: displayName,
          count,
          percent: Math.min(100, Math.round((count / 40) * 100))
        };
      });

    // 4. Distribuição por instrumento
    const instrumentData = slots.reduce((acc: Record<string, Set<string>>, s) => {
      const suffixToRemove = ['LARANJA', 'WHITE', 'BLACK', 'INDIVIDUAL', 'KIDS', 'EXPERIENCE', 'EXPERIENCIA', 'GRUPAL', 'GRUPO'];
      let cleanName = s.instrument.toUpperCase().trim();
      suffixToRemove.forEach(suffix => { cleanName = cleanName.replace(new RegExp(`\\s+${suffix}\\b`, 'g'), '').trim(); });
      cleanName = cleanName.split(/[-()]/)[0].trim();
      if (!acc[cleanName]) acc[cleanName] = new Set<string>();
      acc[cleanName].add(s.studentName.trim().toUpperCase());
      return acc;
    }, {} as Record<string, Set<string>>);

    const instruments = (Object.entries(instrumentData) as [string, Set<string>][])
      .map(([name, pupils]) => [name, pupils.size] as [string, number])
      .sort((a, b) => b[1] - a[1]);

    // 5. Horários Livres
    const generateFreeReport = () => {
      const days = [1, 2, 3, 4, 5, 6];
      return days.map(dow => {
        const endHour = dow === 6 ? 16 : 22;
        const daySlots = slots.filter(s => s.dayOfWeek === dow);
        const periods = { manha: [] as any[], tarde: [] as any[], noite: [] as any[] };

        for (let h = 8; h < endHour; h++) {
          const hourPrefix = String(h).padStart(2, '0');
          const occupiedInHour = new Set(daySlots.filter(s => s.time.startsWith(hourPrefix)).map(s => `${s.teacherId}-${s.studentName}`)).size;
          const free = Math.max(0, 4 - occupiedInHour);
          if (free > 0) {
            const timeStr = `${hourPrefix}:00`;
            const info = { time: timeStr, freeRooms: free };
            if (h < 12) periods.manha.push(info);
            else if (h < 18) periods.tarde.push(info);
            else periods.noite.push(info);
          }
        }
        return { dow, periods };
      });
    };

    const timeCounts = slots.reduce((acc: Record<string, number>, s) => {
      const h = s.time.split(':')[0] + ':00';
      acc[h] = (acc[h] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalSlots: slots.length,
      totalAlunosUnicos,
      totalTeachers: teachers.length,
      occupationRate,
      experimentalWeekly,
      busiestDay: DAYS_OF_WEEK[busiestDayIdx],
      topTeachers,
      instruments,
      peakTimes: (Object.entries(timeCounts) as [string, number][]).sort((a, b) => b[1] - a[1]).slice(0, 8),
      freeReport: generateFreeReport()
    };
  }, [slots, teachers]);


  return (
    <div className="space-y-6 md:space-y-10 animate-slide pb-24 max-w-[1400px] mx-auto p-4 md:p-0">
      {/* 4 Cards Principais */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <div className="card-bg p-4 md:p-8 rounded-[2rem] md:rounded-[2.5rem] shadow-sm">
          <span className="text-[8px] md:text-[10px] font-black text-studio-orange uppercase tracking-widest block mb-2">Alunos</span>
          <div className="flex items-baseline gap-1 md:gap-2">
            <span className="text-2xl md:text-4xl font-black text-studio-black dark:text-studio-beige">{analytics.totalAlunosUnicos}</span>
            <span className="text-[8px] font-bold text-studio-brown/40 uppercase tracking-tighter">Matrículas</span>
          </div>
        </div>
        <div className="card-bg p-4 md:p-8 rounded-[2rem] md:rounded-[2.5rem] shadow-sm border-l-4 border-studio-orange">
          <span className="text-[8px] md:text-[10px] font-black text-studio-orange uppercase tracking-widest block mb-2">Experimentais</span>
          <div className="flex items-baseline gap-1 md:gap-2">
            <span className="text-2xl md:text-4xl font-black text-studio-black dark:text-studio-beige">{analytics.experimentalWeekly.length}</span>
            <span className="text-[8px] font-bold text-studio-brown/40 uppercase tracking-tighter">Essa Sem.</span>
          </div>
        </div>
        <div className="bg-studio-orange p-4 md:p-8 rounded-[2rem] md:rounded-[2.5rem] shadow-xl shadow-studio-orange/20 text-white">
          <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest block mb-2 opacity-80">Ocupação</span>
          <div className="flex items-baseline gap-0.5 md:gap-1">
            <span className="text-2xl md:text-4xl font-black">{analytics.occupationRate}</span>
            <span className="text-sm md:text-xl font-bold">%</span>
          </div>
        </div>
        <div className="card-bg p-4 md:p-8 rounded-[2rem] md:rounded-[2.5rem] shadow-sm">
          <span className="text-[8px] md:text-[10px] font-black text-studio-orange uppercase tracking-widest block mb-2 opacity-40">Pico</span>
          <span className="text-sm md:text-xl font-black uppercase leading-none block mt-1 text-studio-black dark:text-studio-beige truncate">{analytics.busiestDay}</span>
        </div>
      </div>

      {/* Seção de Experimentais Destacada (Semana + Data) */}
      {analytics.experimentalWeekly.length > 0 && (
        <div className="bg-gradient-to-r from-studio-orange to-orange-400 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
          <div className="relative z-10 space-y-6">
            <div className="flex justify-between items-end">
              <div className="space-y-2">
                <h4 className="text-2xl font-black uppercase tracking-tight">Experimentais da Semana</h4>
                <p className="text-xs font-bold opacity-80 uppercase tracking-widest">Atenção total para fechamento de matrícula</p>
              </div>
              <div className="text-[10px] font-black bg-white/20 px-4 py-2 rounded-full uppercase tracking-widest backdrop-blur-sm">
                {analytics.experimentalWeekly.length} Alunos Aguardando
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {analytics.experimentalWeekly.map((s, i) => {
                const dateObj = s.date ? new Date(s.date + 'T12:00:00') : null;
                const dateFormatted = dateObj ? dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';
                const dowName = DAYS_OF_WEEK[s.dayOfWeek].split('-')[0];

                const handleExperimentalMsg = () => {
                  const text = `Olá, *${s.studentName.split(' ')[0]}*! 👋\n\nEstamos muito felizes em receber você para sua *Aula Experimental* de *${s.instrument}* aqui na *ConfirmAula Studio*! 🎸\n\n📍 Sua aula será no dia: *${dateFormatted}* (${dowName})\n⏰ Horário: *${s.time}*\n\nPodemos confirmar sua presença? Qualquer dúvida, estamos à disposição! 🚀`;
                  setModalData({ title: "BOAS-VINDAS (EXP)", body: text, slotId: s.id, date: s.date || '' });
                  setShowModal(true);
                };

                return (
                  <div key={i} className="bg-white/10 backdrop-blur-md rounded-[2rem] p-5 border border-white/10 flex flex-col gap-4 group hover:bg-white/20 transition-all">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="text-xs font-black uppercase tracking-tight truncate max-w-[120px]">{s.studentName}</div>
                        <div className="text-[9px] font-bold opacity-60 uppercase">{s.instrument}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-black uppercase text-white bg-studio-black/20 px-3 py-1 rounded-lg mb-1">{dowName}</div>
                        <div className="text-[11px] font-black">{dateFormatted}</div>
                      </div>
                    </div>

                    <button
                      onClick={handleExperimentalMsg}
                      className="w-full py-2.5 bg-white text-studio-orange rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-lg"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766 0-3.18-2.587-5.771-5.764-5.771z" /></svg>
                      Confirmar Experimental
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Decorativo */}
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 hidden md:grid">
        {/* Esquerda: Ranking e Instrumentos */}
        <div className="xl:col-span-4 space-y-8">
          {/* Ranking Professores */}
          <div className="card-bg p-8 rounded-[3rem] shadow-sm">
            <h4 className="text-xs font-black text-studio-black dark:text-studio-beige uppercase tracking-[0.2em] mb-8 flex justify-between">
              <span>Carga Horária / Docente</span>
              <span className="text-studio-orange">Aulas</span>
            </h4>
            <div className="space-y-6">
              {analytics.topTeachers.slice(0, 6).map((t, i) => (
                <div key={i} className="space-y-2 group">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-studio-black dark:text-studio-beige uppercase truncate max-w-[150px]">{t.name}</span>
                    <span className="text-xs font-black text-studio-orange">{t.count}</span>
                  </div>
                  <div className="h-1.5 bg-studio-sand dark:bg-studio-brown/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-studio-orange rounded-full transition-all duration-1000 group-hover:brightness-110"
                      style={{ width: `${t.percent}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Instrumentos */}
          <div className="card-bg p-8 rounded-[3rem] shadow-sm">
            <h4 className="text-xs font-black text-studio-black dark:text-studio-beige uppercase tracking-[0.2em] mb-8">Especialidades</h4>
            <div className="flex flex-wrap gap-2">
              {analytics.instruments.map(([name, count], i) => (
                <div key={i} className="px-4 py-2 bg-white dark:bg-studio-brown/20 rounded-xl border border-studio-sand dark:border-studio-brown/10 flex items-center gap-3">
                  <span className="text-[10px] font-bold text-studio-brown dark:text-studio-beige/60 uppercase">{name}</span>
                  <span className="text-[11px] font-black text-studio-orange">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Direita: Horários Livres (Mapa de Salas) */}
        <div className="xl:col-span-8 card-bg p-10 rounded-[3rem] shadow-sm">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
            <div>
              <h4 className="text-sm font-black text-studio-black dark:text-studio-beige uppercase tracking-[0.2em]">Salas Físicas Disponíveis</h4>
              <p className="text-[10px] font-bold text-studio-brown/40 mt-1 uppercase tracking-widest italic">Considerando infraestrutura de 4 salas no total</p>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-amber-100 dark:bg-amber-900/30"></div><span className="text-[9px] font-bold uppercase text-studio-brown/40">Manhã</span></div>
              <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-orange-100 dark:bg-orange-900/30"></div><span className="text-[9px] font-bold uppercase text-studio-brown/40">Tarde</span></div>
              <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-studio-brown/10 dark:bg-studio-brown/40"></div><span className="text-[9px] font-bold uppercase text-studio-brown/40">Noite</span></div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {analytics.freeReport.map((day, i) => (
              <div key={i} className="bg-studio-beige/30 dark:bg-studio-brown/5 rounded-[2rem] p-6 border border-studio-sand dark:border-studio-brown/10 flex flex-col gap-5">
                <div className="flex justify-between items-center border-b border-studio-sand dark:border-studio-brown/10 pb-3">
                  <span className="text-[11px] font-black text-studio-orange uppercase tracking-[0.2em]">{DAYS_OF_WEEK[day.dow].split('-')[0]}</span>
                  <div className="text-[9px] font-bold text-studio-brown/30 uppercase">Salas Livres</div>
                </div>

                <div className="space-y-5">
                  {/* Manhã */}
                  {day.periods.manha.length > 0 && (
                    <div>
                      <span className="text-[8px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest mb-2.5 block">Manhã</span>
                      <div className="flex flex-wrap gap-1.5">
                        {day.periods.manha.map((item, idx) => (
                          <div key={idx} className="px-2.5 py-1.5 bg-amber-50 dark:bg-amber-950/20 rounded-lg text-[10px] font-black text-amber-700 flex items-center gap-2">
                            <span>{item.time}</span>
                            <span className="text-[9px] opacity-40 bg-amber-200/40 px-1.5 rounded">{item.freeRooms}s</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Tarde */}
                  {day.periods.tarde.length > 0 && (
                    <div>
                      <span className="text-[8px] font-black text-orange-600 dark:text-orange-500 uppercase tracking-widest mb-2.5 block">Tarde</span>
                      <div className="flex flex-wrap gap-1.5">
                        {day.periods.tarde.map((item, idx) => (
                          <div key={idx} className="px-2.5 py-1.5 bg-orange-50 dark:bg-orange-950/20 rounded-lg text-[10px] font-black text-orange-700 flex items-center gap-2">
                            <span>{item.time}</span>
                            <span className="text-[9px] opacity-40 bg-orange-200/40 px-1.5 rounded">{item.freeRooms}s</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Noite */}
                  {day.periods.noite.length > 0 && (
                    <div>
                      <span className="text-[8px] font-black text-studio-brown dark:text-studio-beige/40 uppercase tracking-widest mb-2.5 block">Noite</span>
                      <div className="flex flex-wrap gap-1.5">
                        {day.periods.noite.map((item, idx) => (
                          <div key={idx} className="px-2.5 py-1.5 bg-studio-brown/5 dark:bg-studio-brown/40 rounded-lg text-[10px] font-black text-studio-brown dark:text-studio-beige/60 flex items-center gap-2">
                            <span>{item.time}</span>
                            <span className="text-[9px] opacity-40 bg-studio-brown/20 dark:bg-white/10 px-1.5 rounded">{item.freeRooms}s</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {day.periods.manha.length === 0 && day.periods.tarde.length === 0 && day.periods.noite.length === 0 && (
                    <div className="py-6 text-center opacity-20 text-[9px] font-black uppercase tracking-widest italic leading-relaxed">Capacidade Máxima Atingida</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Heatmap Vertical de Horários de Pico */}
      <div className="bg-studio-black text-white p-6 md:p-12 rounded-[2.5rem] md:rounded-[4rem] shadow-2xl overflow-hidden relative">
        <div className="relative z-10">
          <h4 className="text-sm font-black uppercase tracking-[0.4em] mb-12 text-center text-studio-orange">Pico de Ocupação por Faixa</h4>
          <div className="grid grid-cols-4 md:grid-cols-4 lg:grid-cols-8 gap-4 md:gap-8">
            {analytics.peakTimes.map(([time, count], i) => (
              <div key={i} className="flex flex-col items-center gap-5 group">
                <div className="w-1.5 flex-1 bg-white/5 rounded-full relative h-32">
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-studio-orange rounded-full shadow-[0_0_20px_rgba(249,115,22,0.4)] transition-all duration-1000"
                    style={{ height: `${(Number(count) / 4) * 100}%` }}
                  ></div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-black">{count}</div>
                  <div className="text-[9px] font-black text-white/30 uppercase tracking-widest">{time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Background Decorative */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-studio-orange/5 rounded-full -mr-48 -mt-48 blur-3xl"></div>
      </div>
      {/* Modal de Mensagem (Dashboard) */}
      {showModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-studio-black/80 backdrop-blur-md p-6">
          <div className="card-bg rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-studio-brown/10 animate-slide">
            <div className="p-5 border-b border-studio-brown/5 flex justify-between items-center bg-studio-orange text-white">
              <span className="text-xs font-black uppercase tracking-widest">{modalData.title}</span>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-all font-bold text-xl">&times;</button>
            </div>
            <div className="p-6 space-y-6 text-studio-black dark:text-studio-beige">
              <pre className="bg-studio-sand dark:bg-studio-brown/20 p-5 rounded-2xl text-[11px] font-bold text-studio-brown dark:text-studio-beige border border-studio-brown/10 max-h-56 overflow-y-auto no-scrollbar leading-relaxed whitespace-pre-wrap">
                {modalData.body}
              </pre>
              <div className="flex gap-3">
                <button onClick={() => {
                  navigator.clipboard.writeText(modalData.body);
                  if (modalData.date && modalData.slotId) onContact(modalData.date, modalData.slotId);
                  setShowModal(false);
                }} className="flex-1 py-4 bg-studio-sand dark:bg-studio-brown text-studio-brown dark:text-studio-beige rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-studio-brown/5 transition-all">Copiar</button>
                <button onClick={() => {
                  window.open(`https://wa.me/?text=${encodeURIComponent(modalData.body)}`, '_blank');
                  if (modalData.date && modalData.slotId) onContact(modalData.date, modalData.slotId);
                  setShowModal(false);
                }} className="flex-1 py-4 bg-studio-orange text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-studio-orange/30 hover:brightness-110 active:scale-95 transition-all">WhatsApp</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;