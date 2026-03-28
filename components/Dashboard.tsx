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

    // Helper atômico apenas para remover pontuação, caixa e acento
    const normalizeName = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();

    // 1. Contagem de Alunos Únicos Ativos (Não repetidos, Ignorando Aulas Experimentais)
    const validStudentNames = slots
      .filter(s => !s.isExperimental) // Uma métrica forte de Alunos matriculados exclui lides de experimentais
      .map(s => normalizeName(s.studentName))
      .filter(n => n && n !== 'SEM ALUNO' && n !== 'LIVRE' && !n.includes('VAGA') && !n.includes('VAGO') && n !== 'NENHUM');
    
    const uniqueStudentsSet = new Set(validStudentNames);
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
        const t = teachers.find(teacher => teacher.id === id);
        let displayName = t?.name || id;

        // Clean up display name
        if (displayName.startsWith('t-')) {
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

    // 5. Horários Livres Simplificado (Tabela Limpa)
    const generateFreeReport = () => {
      const days = [1, 2, 3, 4, 5, 6];
      return days.map(dow => {
        const endHour = dow === 6 ? 16 : 21; // Sábado até as 16h, resto até as 21h (última aula 21-22)
        const daySlots = slots.filter(s => s.dayOfWeek === dow);
        const freeTimes: { time: string, free: number, isHighDemand: boolean }[] = [];

        for (let h = 8; h <= endHour; h++) {
          const hourPrefix = String(h).padStart(2, '0');
          const occupiedInHour = new Set(daySlots.filter(s => s.time.startsWith(hourPrefix)).map(s => `${s.teacherId}-${normalizeName(s.studentName)}`)).size;
          const free = Math.max(0, 4 - occupiedInHour); // 4 salas 
          
          if (free > 0) {
            freeTimes.push({ 
              time: `${hourPrefix}:00`, 
              free,
              isHighDemand: free === 1 // Se só tem 1 sala restante, é alta demanda
            });
          }
        }
        return { dow, freeTimes };
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
    <div className="space-y-10 md:space-y-16 animate-slide pb-24 max-w-[1700px] mx-auto p-4 md:p-0">
      {/* 4 Cards Principais */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-10">
        <div className="card-bg p-5 md:p-12 rounded-[2.5rem] md:rounded-[3.5rem] shadow-sm flex flex-col justify-between">
          <span className="text-[8px] md:text-[11px] font-black text-studio-orange uppercase tracking-[0.4em] block mb-2 md:mb-4">Métricas Ativas</span>
          <div className="flex items-baseline gap-1 md:gap-4">
            <span className="text-3xl md:text-6xl font-black text-studio-black dark:text-studio-beige">{analytics.totalAlunosUnicos}</span>
            <span className="text-[8px] md:text-[10px] font-black text-studio-brown/40 uppercase tracking-widest">Alunos</span>
          </div>
        </div>
        <div className="card-bg p-5 md:p-12 rounded-[2.5rem] md:rounded-[3.5rem] shadow-sm border-l-4 md:border-l-8 border-studio-orange flex flex-col justify-between">
          <span className="text-[8px] md:text-[11px] font-black text-studio-orange uppercase tracking-[0.4em] block mb-2 md:mb-4">Oportunidades</span>
          <div className="flex items-baseline gap-1 md:gap-4">
            <span className="text-3xl md:text-6xl font-black text-studio-black dark:text-studio-beige">{analytics.experimentalWeekly.length}</span>
            <span className="text-[8px] md:text-[10px] font-black text-studio-brown/40 uppercase tracking-widest">Exp.</span>
          </div>
        </div>
        <div className="bg-gradient-to-br from-studio-orange to-orange-500 p-5 md:p-12 rounded-[2.5rem] md:rounded-[3.5rem] shadow-2xl shadow-studio-orange/30 text-white flex flex-col justify-between">
          <span className="text-[8px] md:text-[11px] font-black uppercase tracking-[0.4em] block mb-2 md:mb-4 opacity-70">Ocupação Real</span>
          <div className="flex items-baseline gap-0.5 md:gap-2">
            <span className="text-3xl md:text-6xl font-black">{analytics.occupationRate}</span>
            <span className="text-lg md:text-3xl font-black">%</span>
          </div>
        </div>
        <div className="card-bg p-5 md:p-12 rounded-[2.5rem] md:rounded-[3.5rem] shadow-sm flex flex-col justify-between">
          <span className="text-[8px] md:text-[11px] font-black text-studio-orange uppercase tracking-[0.4em] block mb-2 md:mb-4 opacity-30">Pico Semanal</span>
          <span className="text-lg md:text-3xl font-black uppercase leading-none block text-studio-black dark:text-studio-beige truncate">{analytics.busiestDay}</span>
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
                  const text = `Olá, *${s.studentName.split(' ')[0]}*! 👋\n\nEstamos muito felizes em receber você para sua *Aula Experimental* de *${s.instrument}* aqui no *Studio Acorde*! 🎸\n\n📍 Sua aula será no dia: *${dateFormatted}* (${dowName})\n⏰ Horário: *${s.time}*\n\nPodemos confirmar sua presença? Qualquer dúvida, estamos à disposição! 🚀`;
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

        {/* Direita: Horários Livres (Mapa de Vagas) */}
        <div className="xl:col-span-8 card-bg p-8 lg:p-10 rounded-[3rem] shadow-sm flex flex-col h-full max-h-[800px]">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 shrink-0">
            <div>
              <h4 className="text-sm font-black text-studio-black dark:text-studio-beige uppercase tracking-[0.2em]">Mapa de Horários Disponíveis</h4>
              <p className="text-[10px] font-bold text-studio-brown/40 mt-1 uppercase tracking-widest">Baseado em 4 salas de aulas simultâneas</p>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div><span className="text-[9px] font-bold uppercase text-studio-brown/40">Muitas Vagas</span></div>
              <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div><span className="text-[9px] font-bold uppercase text-studio-brown/40">Alta Demanda</span></div>
            </div>
          </div>

          {/* Container Scrollável das Colunas da Semana */}
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-6 flex-1 items-start snap-x h-full">
            {analytics.freeReport.map((day, i) => (
              <div key={i} className="min-w-[160px] md:min-w-[180px] w-full snap-center bg-studio-sand/10 dark:bg-studio-brown/5 rounded-[2rem] p-5 border border-studio-sand dark:border-studio-brown/10 h-full max-h-full flex flex-col">
                <div className="text-center pb-4 border-b border-studio-sand dark:border-studio-brown/10 mb-4 shrink-0">
                  <span className="text-[11px] font-black text-studio-orange uppercase tracking-[0.3em]">{DAYS_OF_WEEK[day.dow].split('-')[0]}</span>
                  <div className="text-[9px] font-bold text-studio-brown/40 uppercase mt-1">Hoje</div>
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 relative pb-4">
                  {day.freeTimes.length === 0 ? (
                    <div className="py-10 text-center flex flex-col items-center justify-center opacity-40">
                      <svg className="w-6 h-6 mb-2 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      <span className="text-[9px] font-black uppercase tracking-widest text-red-500">Lotado</span>
                    </div>
                  ) : (
                    day.freeTimes.map((t, idx) => (
                      <div key={idx} className="flex justify-between items-center px-4 py-3 bg-white dark:bg-studio-brown/20 rounded-xl hover:scale-105 transition-all shadow-sm border border-transparent hover:border-studio-orange/20 cursor-default">
                        <span className="text-xs font-black text-studio-black dark:text-studio-beige">{t.time}</span>
                        <div className="flex items-center gap-2">
                           {t.isHighDemand ? (
                             <span className="text-[10px] font-black text-amber-500">{t.free}</span>
                           ) : (
                             <span className="text-[10px] font-black text-emerald-500">{t.free}</span>
                           )}
                           <div className={`w-2 h-2 rounded-full ${t.isHighDemand ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                        </div>
                      </div>
                    ))
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