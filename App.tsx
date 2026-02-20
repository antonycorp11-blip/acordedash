
import React, { useState, useEffect, useLayoutEffect, useMemo } from 'react';
import { Teacher, ScheduleSlot, Confirmations, DateOverrides } from './types';
import { loadData, saveData } from './storage';
import Sidebar from './components/Sidebar';
import MonthlyCalendar from './components/MonthlyCalendar';
import DayDetailPanel from './components/DayDetailPanel';
import WeeklyView from './components/WeeklyView';
import Dashboard from './components/Dashboard';
import FinancialDashboard from './components/FinancialDashboard';
import TeacherManager from './components/TeacherManager';
import ScheduleManager from './components/ScheduleManager';
import { emusysService } from './services/emusysService';
import { dbService } from './services/dbService';

/** 
 * ============================================================================
 * CORE DATA LOGIC - DO NOT MODIFY WITHOUT EXTREME CARE
 * These functions ensure teacher deduplication and ID consistency. 
 * Essential for the "ConfirmAula Studio" stability.
 * ============================================================================
 */
const normalizeKey = (s: string) => {
  if (!s) return "";
  return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
};

const isSimilar = (n1: string, n2: string) => {
  const s1 = normalizeKey(n1).replace(/\s+/g, '');
  const s2 = normalizeKey(n2).replace(/\s+/g, '');
  if (!s1 || !s2) return false;
  // Match exact or one contains the other (e.g., "AQUILLES SANTOS" vs "AQUILLES ANTONY...")
  return s1 === s2 || s1.includes(s2) || s2.includes(s1);
};
/** ======================================================================= **/

const App: React.FC = () => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [confirmations, setConfirmations] = useState<Confirmations>({});
  const [overrides, setOverrides] = useState<DateOverrides>({});
  const [toasts, setToasts] = useState<{ id: string, msg: string, type: string }[]>([]);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('dark') === 'true');
  const [isLoaded, setIsLoaded] = useState(false);

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [view, setView] = useState<'calendar' | 'teachers' | 'weekly' | 'dashboard' | 'financial'>('calendar');
  const [expenses, setExpenses] = useState<any[]>([]);
  const [contactedStatuses, setContactedStatuses] = useState<Record<string, string[]>>({});

  const [isSyncing, setIsSyncing] = useState(true);

  useLayoutEffect(() => {
    const initLoad = async () => {
      try {
        setIsSyncing(true);
        let local: any = {};
        try { local = loadData(); } catch (e) { console.error("Local Storage corrupt", e); }

        const hasLocalData = local.teachers && local.teachers.length > 0;

        let cloudT: Teacher[] = [];
        let cloudS: ScheduleSlot[] = [];
        let cloudC: Confirmations = {};
        let cloudE: any[] = [];

        try {
          const [t, s, c, e] = await Promise.all([
            dbService.getTeachers(),
            dbService.getSlots(),
            dbService.getConfirmations(),
            dbService.getExpenses()
          ]);
          cloudT = t; cloudS = s; cloudC = c; cloudE = e;
        } catch (err: any) {
          console.warn('Cloud load failed', err);
        }

        // DEDUPLICAÇÃO E MERGE NA CARGA
        const mergedT: Teacher[] = [];
        const seenN = new Set<string>();
        const allT = [...cloudT, ...(local.teachers || [])];

        allT.sort((a, b) => b.name.length - a.name.length).forEach(t => {
          const norm = normalizeKey(t.name).replace(/\s+/g, '');
          if (!seenN.has(norm)) {
            mergedT.push(t);
            seenN.add(norm);
          }
        });

        const finalT = mergedT.sort((a, b) => a.name.localeCompare(b.name));

        const rawSlots = cloudT.length > 0 ? cloudS : (local.slots || []);
        const finalS = rawSlots.map(s => {
          const origT = allT.find(xt => xt.id === s.teacherId);
          const targetT = finalT.find(ft => isSimilar(ft.name, origT?.name || ""));
          return targetT ? { ...s, teacherId: targetT.id } : s;
        });

        setTeachers(finalT);
        setSlots(finalS);
        setConfirmations(cloudT.length > 0 ? cloudC : (local.confirmations || {}));
        setOverrides(local.overrides || {});
        setExpenses(cloudT.length > 0 ? cloudE : (local.expenses || []));

        const savedContacted = localStorage.getItem('contacted_statuses');
        if (savedContacted) setContactedStatuses(JSON.parse(savedContacted));

        setIsLoaded(true);
        setIsSyncing(false);
      } catch (err) {
        console.error("Init Error", err);
        setIsLoaded(true);
        setIsSyncing(false);
      }
    };
    initLoad();
  }, []);

  useEffect(() => {
    if (isLoaded) {
      saveData(teachers, slots, confirmations, overrides, expenses);

      // Debounced Cloud Sync
      const timer = setTimeout(async () => {
        try {
          await dbService.syncAll({
            teachers,
            slots,
            confirmations,
            expenses
          });
        } catch (err) {
          console.error("Auto cloud sync failed", err);
        }
      }, 3000); // 3 second debounce to avoid slamming DB
      return () => clearTimeout(timer);
    }
  }, [teachers, slots, confirmations, overrides, expenses, isLoaded]);

  // Polling for updates (essential for multi-device sync)
  useEffect(() => {
    if (!isLoaded) return;

    const poll = async () => {
      try {
        const [cloudC, cloudE] = await Promise.all([
          dbService.getConfirmations(),
          dbService.getExpenses()
        ]);

        // Only update if there's a difference to avoid flash/re-render
        if (JSON.stringify(cloudC) !== JSON.stringify(confirmations)) {
          setConfirmations(cloudC);
        }
        if (JSON.stringify(cloudE) !== JSON.stringify(expenses)) {
          setExpenses(cloudE);
        }
      } catch (err) {
        console.error("Polling failed", err);
      }
    };

    const interval = setInterval(poll, 20000); // Poll every 20 seconds
    return () => clearInterval(interval);
  }, [isLoaded, confirmations, expenses]);

  useEffect(() => {
    localStorage.setItem('dark', String(darkMode));
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('contacted_statuses', JSON.stringify(contactedStatuses));
  }, [contactedStatuses]);

  const addToast = (msg: string, type: string = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const [hasUpdates, setHasUpdates] = useState(false);
  const [syncSummary, setSyncSummary] = useState<{ new: number, updated: string[], deleted: number } | null>(null);

  const checkForUpdates = async () => {
    if (!isLoaded || teachers.length === 0) return;
    try {
      const d = new Date();
      const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0] + ' 00:00:00';
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0] + ' 23:59:59';

      const { slots: emSlots } = await emusysService.syncToAppData(firstDay, lastDay);
      if (emSlots.length === 0) return;

      const currentEmSlots = slots.filter(s => s.id.startsWith('em-'));
      const currentMap = new Map(currentEmSlots.map(s => [s.id, `${s.dayOfWeek}-${s.time}-${s.studentName}`.toUpperCase()]));

      const hasChanges = emSlots.some(s => {
        const sig = `${s.dayOfWeek}-${s.time}-${s.studentName}`.toUpperCase();
        return !currentMap.has(s.id) || currentMap.get(s.id) !== sig;
      });

      const wasDeleted = emSlots.length < currentMap.size;
      setHasUpdates(hasChanges || wasDeleted);
    } catch (err) {
      console.warn("Falha na checagem de background", err);
    }
  };

  useEffect(() => {
    if (isLoaded) {
      checkForUpdates();
      const interval = setInterval(checkForUpdates, 1000 * 60 * 5); // 5min
      return () => clearInterval(interval);
    }
  }, [isLoaded, slots]);

  const handleEmusysSync = async () => {
    try {
      addToast("Sincronizando com Emusys...", "info");

      const d = new Date();
      const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0] + ' 00:00:00';
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0] + ' 23:59:59';

      const { teachers: emTeachers, slots: emSlots } = await emusysService.syncToAppData(firstDay, lastDay);

      if (emSlots.length === 0) {
        return addToast("Nenhuma aula encontrada no período.", "error");
      }

      let currentTeachers = [...teachers];
      const teacherMap = new Map<string, string>();

      emTeachers.forEach(et => {
        const existing = currentTeachers.find(t => isSimilar(t.name, et.name));
        if (existing) {
          if (et.name.length > existing.name.length) {
            const updated = currentTeachers.map(tx => tx.id === existing.id ? { ...tx, name: et.name } : tx);
            currentTeachers = updated;
          }
          teacherMap.set(et.name.toUpperCase(), existing.id);
        } else {
          currentTeachers.push(et);
          teacherMap.set(et.name.toUpperCase(), et.id);
        }
      });

      const finalUniqueTeachers: Teacher[] = [];
      const idRedirectMap = new Map<string, string>();

      currentTeachers.sort((a, b) => b.name.length - a.name.length).forEach(t => {
        const duplicate = finalUniqueTeachers.find(uq => isSimilar(uq.name, t.name));
        if (duplicate) {
          idRedirectMap.set(t.id, duplicate.id);
        } else {
          finalUniqueTeachers.push(t);
        }
      });

      const adjustedEmSlots = emSlots.map(s => {
        const emTeacher = emTeachers.find(t => t.id === s.teacherId);
        let finalId = emTeacher ? teacherMap.get(emTeacher.name.toUpperCase()) : s.teacherId;
        if (finalId && idRedirectMap.has(finalId)) finalId = idRedirectMap.get(finalId);
        return { ...s, teacherId: finalId || s.teacherId };
      });

      const nonEmSlots = slots.filter(s => !s.id.startsWith('em-')).map(s => {
        if (idRedirectMap.has(s.teacherId)) {
          return { ...s, teacherId: idRedirectMap.get(s.teacherId)! };
        }
        return s;
      });

      const currentEmSlots = slots.filter(s => s.id.startsWith('em-'));
      const currentMap = new Map(currentEmSlots.map(s => [s.id, `${s.dayOfWeek}-${s.time}-${s.studentName}`.toUpperCase()]));

      const newLessons = adjustedEmSlots.filter(s => !currentMap.has(s.id));
      const updatedLessons = adjustedEmSlots.filter(s => {
        const sig = `${s.dayOfWeek}-${s.time}-${s.studentName}`.toUpperCase();
        return currentMap.has(s.id) && currentMap.get(s.id) !== sig;
      });
      const deletedCount = currentEmSlots.length - adjustedEmSlots.filter(s => currentMap.has(s.id)).length;

      const finalSlots = [...nonEmSlots, ...adjustedEmSlots];

      setTeachers(finalUniqueTeachers.sort((a, b) => a.name.localeCompare(b.name)));
      setSlots(finalSlots);
      setHasUpdates(false);

      const updatedNames = Array.from(new Set(updatedLessons.map(s => s.studentName.trim())));
      setSyncSummary({
        new: newLessons.length,
        updated: updatedNames,
        deleted: Math.max(0, deletedCount)
      });

      addToast(`Sincronização concluída!`, "success");

      setTimeout(async () => {
        try {
          await dbService.syncAll({
            teachers: finalUniqueTeachers,
            slots: finalSlots,
            confirmations,
            expenses
          });
        } catch (syncErr) {
          console.warn('Erro ao salvar no banco após Emusys:', syncErr);
        }
      }, 1000);

    } catch (err) {
      console.error(err);
      addToast("Erro na sincronização.", "error");
    }
  };

  const handleContact = (date: string, slotId: string) => {
    setContactedStatuses(prev => {
      const day = prev[date] || [];
      if (day.includes(slotId)) return prev;
      return { ...prev, [date]: [...day, slotId] };
    });
  };

  const toggleConfirm = (date: string, slotId: string) => {
    setConfirmations(prev => {
      const day = prev[date] || [];
      const next = day.includes(slotId) ? day.filter(id => id !== slotId) : [...day, slotId];
      return { ...prev, [date]: next };
    });
  };

  const todayCount = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const dow = new Date().getDay();
    return slots.filter(s => {
      const matchesTeacher = selectedTeacherId ? s.teacherId === selectedTeacherId : true;
      if (!matchesTeacher) return false;
      if (s.date) return s.date === todayStr;
      return s.dayOfWeek === dow;
    }).length;
  }, [slots, selectedTeacherId]);

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] w-full overflow-hidden bg-studio-black">
      <Sidebar
        currentView={view}
        setView={setView}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        onImport={(f) => { }}
        onSync={handleEmusysSync}
        onReset={() => { if (confirm("Resetar tudo?")) { localStorage.clear(); window.location.reload(); } }}
        hasUpdates={hasUpdates}
      />

      <main className="flex-1 overflow-y-auto no-scrollbar bg-studio-beige/95 dark:bg-studio-black p-4 md:p-10">
        <div className="max-w-[1700px] mx-auto space-y-10">

          {/* Header & Filter Bar */}
          <header className="px-4 md:px-0">
            <div className="flex flex-col xl:flex-row justify-between xl:items-center border-b border-studio-brown/5 pb-4 md:pb-8 mb-4 md:mb-6 gap-4 md:gap-8">
              <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-12">
                <div className="space-y-0.5 md:space-y-1">
                  <span className="text-[9px] md:text-[11px] font-black text-studio-orange uppercase tracking-[0.4em] md:tracking-[0.5em] block">Studio Connect v4.5</span>
                  <h1 className="text-3xl md:text-5xl font-black text-studio-black dark:text-studio-beige uppercase tracking-tighter">
                    {view === 'calendar' ? 'Calendário' : view === 'dashboard' ? 'Dashboard' : view === 'teachers' ? 'Equipe' : view === 'financial' ? 'Financeiro' : 'Grade'}
                  </h1>
                </div>

                {/* Teacher Selector Pills - Scrollable on mobile */}
                <div className="flex overflow-x-auto no-scrollbar gap-2 md:gap-3 items-center border-l-0 lg:border-l border-studio-brown/10 lg:pl-10 pb-2 md:pb-0">
                  <button
                    onClick={() => setSelectedTeacherId('')}
                    className={`shrink-0 px-4 md:px-6 py-2 md:py-2.5 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-[0.12em] transition-all border-2 ${!selectedTeacherId ? 'bg-studio-orange border-studio-orange text-white shadow-xl shadow-studio-orange/30 scale-105' : 'bg-studio-sand/30 dark:bg-studio-brown/10 border-studio-brown/5 text-studio-black/60 dark:text-studio-beige/40 hover:border-studio-orange/20'}`}
                  >
                    Todos
                  </button>
                  {teachers.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTeacherId(t.id)}
                      className={`shrink-0 px-4 md:px-6 py-2 md:py-2.5 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-[0.12em] transition-all border-2 ${selectedTeacherId === t.id ? 'bg-studio-orange border-studio-orange text-white shadow-xl shadow-studio-orange/30 scale-105' : 'bg-studio-sand/30 dark:bg-studio-brown/10 border-studio-brown/5 text-studio-black/60 dark:text-studio-beige/40 hover:border-studio-orange/20'}`}
                    >
                      {t.name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-right hidden md:block bg-studio-sand/10 dark:bg-studio-brown/10 px-8 py-5 rounded-[2.5rem] border border-studio-brown/5">
                <span className="text-[10px] font-black text-studio-brown/40 dark:text-studio-beige/40 uppercase tracking-widest block mb-1">Total de Aulas Hoje</span>
                <span className="text-4xl font-black text-studio-orange">{todayCount}</span>
              </div>
            </div>
          </header>

          <div className="min-h-[calc(100vh-300px)]">
            {view === 'dashboard' && (
              <Dashboard
                teachers={teachers}
                slots={slots}
                onContact={handleContact}
              />
            )}

            {view === 'calendar' && (
              <div className="flex flex-col xl:flex-row gap-6 md:gap-10 items-start">
                <div className="flex-1 w-full bg-none md:bg-white/40 dark:md:bg-studio-brown/5 p-0 md:p-8 rounded-none md:rounded-[3.5rem] border-none md:border md:border-studio-brown/5 shadow-none md:shadow-xl">
                  <MonthlyCalendar
                    selectedDate={selectedDate}
                    onSelectDate={setSelectedDate}
                    slots={slots}
                    teacherId={selectedTeacherId}
                    confirmations={confirmations}
                    overrides={overrides}
                    onToggle={toggleConfirm}
                    onClearDay={(d) => setConfirmations(prev => { const n = { ...prev }; delete n[d]; return n; })}
                    onToast={addToast}
                  />
                </div>
                <div className="w-full xl:w-[420px] shrink-0 mt-2 md:mt-0">
                  <DayDetailPanel
                    date={selectedDate}
                    teacherId={selectedTeacherId}
                    teachers={teachers}
                    slots={slots}
                    confirmations={confirmations}
                    contactedStatuses={contactedStatuses}
                    onToggle={toggleConfirm}
                    onContact={handleContact}
                    onToast={addToast}
                    hideSidebarStyles={true}
                  />
                </div>
              </div>
            )}

            {view === 'weekly' && (
              <WeeklyView
                teachers={teachers}
                slots={slots}
              />
            )}

            {view === 'teachers' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <section className="space-y-6">
                  <h3 className="text-xl font-black text-studio-black dark:text-studio-beige uppercase">Corpo Docente</h3>
                  <TeacherManager
                    teachers={teachers}
                    onAdd={(name) => {
                      const id = `t-${normalizeKey(name).replace(/\s+/g, '')}`;
                      if (teachers.find(t => t.id === id)) return addToast("Docente já cadastrado", "error");
                      setTeachers(prev => [{ id, name: name.toUpperCase() }, ...prev]);
                      addToast("Cadastro realizado!");
                    }}
                    onDelete={(id) => {
                      setTeachers(prev => prev.filter(t => t.id !== id));
                      setSlots(prev => prev.filter(s => s.teacherId !== id));
                      addToast("Removido com sucesso");
                    }}
                  />
                </section>
                <section className="space-y-6">
                  <h3 className="text-xl font-black text-studio-black dark:text-studio-beige uppercase">Grade Manual</h3>
                  <ScheduleManager
                    teachers={teachers}
                    slots={slots.filter(s => !s.id.startsWith('em-'))}
                    onAddSlot={(s) => {
                      const newSlot: ScheduleSlot = { ...s, id: crypto.randomUUID(), createdAt: Date.now() };
                      setSlots(prev => [...prev, newSlot]);
                    }}
                    onDeleteSlot={(id) => setSlots(prev => prev.filter(s => s.id !== id))}
                    onClearAll={() => {
                      if (confirm("Limpar toda a grade manual?")) {
                        setSlots(prev => prev.filter(s => s.id.startsWith('em-')));
                      }
                    }}
                  />
                </section>
              </div>
            )}

            {view === 'financial' && (
              <FinancialDashboard
                expenses={expenses}
                teachers={teachers}
                onUpdateExpenses={setExpenses}
              />
            )}
          </div>
        </div>
      </main>

      {/* Sync Summary Modal */}
      {syncSummary && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-studio-black/90 backdrop-blur-xl p-4">
          <div className="card-bg rounded-[3.5rem] w-full max-w-lg p-10 space-y-8 animate-pop-in border border-studio-brown/10 shadow-2xl">
            <div className="text-center space-y-2">
              <div className="w-20 h-20 bg-studio-orange/10 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-studio-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>
              </div>
              <h3 className="text-3xl font-black text-studio-black dark:text-studio-beige uppercase">Sincronização Finalizada</h3>
              <p className="text-[10px] font-bold text-studio-brown/40 uppercase tracking-widest">Relatório Completo do Emusys</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-6 bg-emerald-500/5 border border-emerald-500/10 rounded-3xl">
                <span className="text-2xl font-black text-emerald-500 block">{syncSummary.new}</span>
                <span className="text-[9px] font-bold text-emerald-500/40 uppercase tracking-widest">Aulas Novas</span>
              </div>
              <div className="p-6 bg-red-500/5 border border-red-500/10 rounded-3xl">
                <span className="text-2xl font-black text-red-500 block">{syncSummary.deleted}</span>
                <span className="text-[9px] font-bold text-red-500/40 uppercase tracking-widest">Removidas</span>
              </div>
            </div>

            {syncSummary.updated.length > 0 && (
              <div className="space-y-4">
                <p className="text-[10px] font-black text-studio-orange uppercase tracking-widest ml-2">Horários Alterados ({syncSummary.updated.length})</p>
                <div className="max-h-40 overflow-y-auto no-scrollbar space-y-1.5 p-2 bg-studio-sand/10 dark:bg-studio-brown/20 rounded-2xl">
                  {syncSummary.updated.map((name, i) => (
                    <div key={i} className="text-[11px] font-black text-studio-black dark:text-studio-beige uppercase px-4 py-2 bg-white/50 dark:bg-studio-brown/20 rounded-xl">{name}</div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setSyncSummary(null)}
              className="w-full py-6 bg-studio-orange text-white rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-2xl shadow-studio-orange/30 active:scale-95 transition-all"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Toasts */}
      <div className="fixed top-6 right-6 z-[1000] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`px-8 py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest text-white shadow-2xl animate-slide pointer-events-auto ${t.type === 'error' ? 'bg-red-500' : 'bg-studio-orange'}`}>
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;