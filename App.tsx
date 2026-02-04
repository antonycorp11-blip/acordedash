import React, { useState, useEffect, useLayoutEffect } from 'react';
import { Teacher, ScheduleSlot, Confirmations, DateOverrides } from './types';
import { loadData, saveData } from './storage';
import Sidebar from './components/Sidebar';
import MonthlyCalendar from './components/MonthlyCalendar';
import DayDetailPanel from './components/DayDetailPanel';
import WeeklyView from './components/WeeklyView';
import Dashboard from './components/Dashboard';
import FinancialDashboard from './components/FinancialDashboard';
import * as XLSX from 'xlsx';
import { emusysService } from './services/emusysService';
import { dbService } from './services/dbService';

const DIAS_MAP: Record<string, number> = {
  "seg": 1, "ter": 2, "qua": 3, "qui": 4, "sex": 5, "sab": 6, "dom": 0,
  "mon": 1, "tue": 2, "wed": 3, "thu": 4, "fri": 5, "sat": 6, "sun": 0
};

const normalizeKey = (s: string) => {
  if (!s) return "";
  return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '').trim();
};


const formatExcelTime = (val: any): string => {
  if (typeof val === 'number') {
    const totalMinutes = Math.round(val * 24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }
  return String(val || "").trim();
};

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
  const [view, setView] = useState<'calendar' | 'teachers' | 'weekly' | 'dashboard' | 'financial'>('dashboard');
  const [expenses, setExpenses] = useState<any[]>([]);
  const [contactedStatuses, setContactedStatuses] = useState<Record<string, string[]>>({}); // { "YYYY-MM-DD": [slotId, ...] }

  const [isSyncing, setIsSyncing] = useState(true);

  const [globalError, setGlobalError] = useState<string | null>(null);

  useLayoutEffect(() => {
    const initLoad = async () => {
      try {
        setIsSyncing(true);
        // 1. Load Local first
        let local: any = {};
        try {
          local = loadData();
        } catch (e) {
          console.error("Local Storage corrupt", e);
        }

        const hasLocalData = local.teachers && local.teachers.length > 0;

        if (hasLocalData) {
          setTeachers(local.teachers.sort((a, b) => a.name.localeCompare(b.name)));
          setSlots(local.slots || []);
          setConfirmations(local.confirmations || {});
          setOverrides(local.overrides || {});
          setExpenses(local.expenses || []);
          const savedContacted = localStorage.getItem('contacted_statuses');
          if (savedContacted) setContactedStatuses(JSON.parse(savedContacted));
          setIsLoaded(true);
          // Don't set isSyncing false yet, wait for cloud
        }

        // 2. Fetch from Cloud
        try {
          const [cloudTeachers, cloudSlots, cloudConf, cloudExp] = await Promise.all([
            dbService.getTeachers(),
            dbService.getSlots(),
            dbService.getConfirmations(),
            dbService.getExpenses()
          ]);

          if (cloudTeachers.length > 0) setTeachers(cloudTeachers);
          if (cloudSlots.length > 0) setSlots(cloudSlots);
          if (Object.keys(cloudConf).length > 0) setConfirmations(cloudConf);
          if (cloudExp.length > 0) setExpenses(cloudExp);
        } catch (err: any) {
          console.warn('Cloud load failed', err);
          if (!hasLocalData) addToast("Modo Offline: Usando dados locais", "info");
        } finally {
          setIsLoaded(true);
          setIsSyncing(false);
        }
      } catch (fatalError: any) {
        setGlobalError(fatalError.message || "Erro crítico");
      }
    };
    initLoad();
  }, []);

  if (globalError) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-red-900 text-white p-8 text-center gap-6">
        <h1 className="text-3xl font-black uppercase">Erro Crítico</h1>
        <p className="font-mono bg-black/30 p-4 rounded text-sm">{globalError}</p>
        <button
          onClick={() => { localStorage.clear(); window.location.reload(); }}
          className="px-6 py-3 bg-white text-red-900 font-bold rounded-xl uppercase"
        >
          Limpar Dados e Tentar Novamente
        </button>
      </div>
    );
  }


  useEffect(() => {
    if (isLoaded) {
      saveData(teachers, slots, confirmations, overrides, expenses);
      localStorage.setItem('contacted_statuses', JSON.stringify(contactedStatuses));

      // Debounced background sync to Supabase
      const timer = setTimeout(async () => {
        try {
          await dbService.syncAll({
            teachers,
            slots,
            confirmations,
            expenses
          });
          console.log('Auto-sync to Supabase successful');
        } catch (err) {
          console.warn('Auto-sync failed:', err);
        }
      }, 2000); // 2 seconds debounce

      return () => clearTimeout(timer);
    }
  }, [teachers, slots, confirmations, overrides, contactedStatuses, expenses, isLoaded]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('dark', String(darkMode));
  }, [darkMode]);

  const addToast = (msg: string, type = 'info') => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const handleImportXlsx = async (file: File) => {
    try {
      addToast("Importando dados...", "info");
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" }) as any[];

      if (rows.length === 0) return addToast("Arquivo vazio", "error");

      const headers = Object.keys(rows[0]);
      const findHeader = (target: string) => headers.find(h => normalizeKey(h) === normalizeKey(target));

      const colDisciplina = findHeader('Disciplina');
      const colAluno = findHeader('Aluno');
      const colProf = findHeader('Prof');
      const colData = findHeader('Data');
      const colHorario = findHeader('Horário') || findHeader('Horario');
      const colTipo = findHeader('Tipo');

      if (!colDisciplina || !colAluno || !colProf || !colData || !colHorario) {
        return addToast("Colunas não encontradas.", "error");
      }

      const newSlots: ScheduleSlot[] = [];
      let currentTeachersList = [...teachers];
      let importedRows = 0;

      rows.forEach((row) => {
        const rawProf = String(row[colProf!] || "").trim();
        const rawAluno = String(row[colAluno!] || "").trim();
        const rawDisciplina = String(row[colDisciplina!] || "").trim();
        const rawDataVal = row[colData!];
        const rawHorarioVal = row[colHorario!];
        const rawTipo = String(row[colTipo!] || "").trim();

        if (!rawProf || !rawAluno || !rawDisciplina || !rawDataVal || !rawHorarioVal) return;

        let teacherId = "";
        const teacherNameUpper = rawProf.toUpperCase();
        const existing = currentTeachersList.find(t => t.name === teacherNameUpper);
        if (existing) {
          teacherId = existing.id;
        } else {
          const newT = { id: crypto.randomUUID(), name: teacherNameUpper };
          currentTeachersList.push(newT);
          teacherId = newT.id;
        }

        let dayIndex = -1;
        if (rawDataVal instanceof Date) {
          dayIndex = rawDataVal.getDay();
        } else {
          const normalized = normalizeKey(String(rawDataVal)).substring(0, 3);
          dayIndex = DIAS_MAP[normalized] !== undefined ? DIAS_MAP[normalized] : -1;
        }

        const timeFormatted = formatExcelTime(rawHorarioVal);
        if (dayIndex !== -1) {
          newSlots.push({
            id: crypto.randomUUID(),
            teacherId,
            dayOfWeek: dayIndex,
            time: timeFormatted,
            studentName: rawAluno,
            instrument: rawDisciplina,
            isExperimental: normalizeKey(rawTipo).includes('experimental'),
            createdAt: Date.now()
          });
          importedRows++;
        }
      });

      const sortedTeachers = currentTeachersList.sort((a, b) => a.name.localeCompare(b.name));
      setTeachers(sortedTeachers);
      setSlots(prev => [...prev, ...newSlots]);
      addToast(`${importedRows} aulas importadas!`, "success");
      setView('dashboard');
    } catch (err) {
      addToast("Erro na leitura.", "error");
    }
  };

  const [hasUpdates, setHasUpdates] = useState(false);
  const [syncSummary, setSyncSummary] = useState<{ new: number, updated: string[], deleted: number } | null>(null);

  // Checagem periódica de mudanças no Emusys
  const checkForUpdates = async () => {
    try {
      const d = new Date();
      const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0] + ' 00:00:00';
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0] + ' 23:59:59';

      const { slots: emSlots } = await emusysService.syncToAppData(firstDay, lastDay);

      // Cria um mapa da situação atual para comparação detalhada
      // Usamos uma chave composta: ID + Horário + Estudante para detectar mudanças de campo
      const currentMap = new Map();
      slots.filter(s => s.id.startsWith('em-')).forEach(s => {
        currentMap.set(s.id, `${s.dayOfWeek}-${s.time}-${s.studentName}`.toUpperCase());
      });

      // Verifica se há novos IDs OU se o conteúdo de um ID existente mudou (ex: mudou horário)
      const hasChanges = emSlots.some(s => {
        if (!currentMap.has(s.id)) return true; // Novo ID
        if (currentMap.get(s.id) !== `${s.dayOfWeek}-${s.time}-${s.studentName}`.toUpperCase()) return true; // Mudou conteúdo (horário/aluno)
        return false;
      });

      // Também verifica se houve deleções (menos slots no Emusys do que aqui)
      const wasDeleted = emSlots.length < currentMap.size;

      setHasUpdates(hasChanges || wasDeleted);
    } catch (err) {
      console.warn("Falha na checagem de background", err);
    }
  };

  useEffect(() => {
    if (isLoaded) {
      checkForUpdates();
      const interval = setInterval(checkForUpdates, 1000 * 30); // 30s
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

      // Detecção detalhada para o Modal
      const currentMap = new Map();
      slots.filter(s => s.id.startsWith('em-')).forEach(s => {
        currentMap.set(s.id, {
          sig: `${s.dayOfWeek}-${s.time}-${s.studentName}`.toUpperCase(),
          name: s.studentName
        });
      });

      const newLessons = emSlots.filter(s => !currentMap.has(s.id));
      const updatedLessons = emSlots.filter(s => {
        const old = currentMap.get(s.id);
        return old && old.sig !== `${s.dayOfWeek}-${s.time}-${s.studentName}`.toUpperCase();
      });

      const deletedCount = currentMap.size - emSlots.filter(s => currentMap.has(s.id)).length;

      setTeachers(prev => {
        const updated = [...prev];
        emTeachers.forEach(et => {
          const existingIdx = updated.findIndex(t => t.name.toUpperCase() === et.name.toUpperCase());
          if (existingIdx === -1) {
            updated.push(et);
          } else {
            // Atualiza o ID do professor existente para o ID estável vindo do Emusys
            updated[existingIdx].id = et.id;
          }
        });
        return updated.sort((a, b) => a.name.localeCompare(b.name));
      });

      setSlots(prev => {
        // Migramos os slots para usar os IDs estáveis baseados em nome
        // Isso resolve o problema de UUIDs aparecendo no Dashboard
        const migratedPrev = prev.map(s => {
          const teacher = teachers.find(t => t.id === s.teacherId);
          if (teacher && !s.teacherId.startsWith('t-')) {
            return { ...s, teacherId: `t-${teacher.name.toUpperCase().trim()}` };
          }
          return s;
        });

        const filtered = migratedPrev.filter(s => !s.id.startsWith('em-'));
        return [...filtered, ...emSlots];
      });

      setHasUpdates(false);

      // Coleta nomes únicos que tiveram alteração de horário/dia
      const updatedNames = Array.from(new Set(updatedLessons.map(s => s.studentName.trim())));

      setSyncSummary({
        new: newLessons.length,
        updated: updatedNames,
        deleted: deletedCount > 0 ? deletedCount : 0
      });

      addToast(`Sincronização concluída!`, "success");
      setView('dashboard');

      // AUTOMATIC CLOUD SYNC: Garantir que os dados do Emusys subam para o banco REPORTCELL
      setTimeout(async () => {
        try {
          // Buscamos o estado MAIS RECENTE para garantir persistência correta
          // Nota: Como o setState é assíncrono, usamos as variáveis locais que representam o novo estado
          const updatedTeachers = await new Promise<Teacher[]>(res => setTeachers(prev => { res(prev); return prev; }));
          const updatedSlots = await new Promise<ScheduleSlot[]>(res => setSlots(prev => { res(prev); return prev; }));

          await dbService.syncAll({
            teachers: updatedTeachers,
            slots: updatedSlots,
            confirmations,
            expenses
          });
          console.log('Background Sync to Supabase Complete');
        } catch (syncErr) {
          console.warn('Erro ao salvar no banco após Emusys:', syncErr);
        }
      }, 500);

    } catch (err) {
      console.error(err);
      addToast("Erro na sincronização.", "error");
    }
  };

  const handleCloudSync = async () => {
    addToast("Nuvem: Enviando backup...", "info");
    try {
      await dbService.syncAll({
        teachers,
        slots,
        confirmations,
        expenses
      });
      addToast("Backup na nuvem realizado com sucesso!", "success");
    } catch (err: any) {
      console.error(err);
      addToast(`Erro na nuvem: ${err.message || 'Falha desconhecida'}`, "error");
    }
  };

  const handleCloudRestore = async () => {
    addToast("Nuvem: Baixando dados...", "info");
    try {
      const [cloudTeachers, cloudSlots, cloudConf, cloudExp] = await Promise.all([
        dbService.getTeachers(),
        dbService.getSlots(),
        dbService.getConfirmations(),
        dbService.getExpenses()
      ]);

      if (cloudTeachers.length > 0) setTeachers(cloudTeachers);
      if (cloudSlots.length > 0) setSlots(cloudSlots);
      if (Object.keys(cloudConf).length > 0) setConfirmations(cloudConf);
      if (cloudExp.length > 0) setExpenses(cloudExp);

      addToast("Dados restaurados da nuvem!", "success");
      setTimeout(() => window.location.reload(), 1500); // Reload to ensure state consistency
    } catch (err: any) {
      console.error(err);
      addToast(`Erro ao baixar: ${err.message || 'Falha desconhecida'}`, "error");
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen w-full overflow-hidden main-container transition-all duration-300">
      {/* Modal de Resumo de Sincronização */}
      {syncSummary && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
          <div className="bg-white dark:bg-studio-black rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl border border-studio-orange/20 animate-slide">
            <div className="p-8 text-center space-y-6">
              <div className="w-16 h-16 bg-studio-orange/10 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-studio-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-black text-studio-black dark:text-studio-beige uppercase">Agenda Atualizada</h3>

                <div className="space-y-3 text-left">
                  {syncSummary.new > 0 && (
                    <div className="flex items-center gap-2 text-[10px] font-bold text-green-600 uppercase tracking-widest">
                      <span className="w-1.5 h-1.5 bg-green-600 rounded-full"></span>
                      {syncSummary.new} Novos Horários / Experimentais
                    </div>
                  )}

                  {syncSummary.updated.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[10px] font-bold text-studio-orange uppercase tracking-widest">
                        <span className="w-1.5 h-1.5 bg-studio-orange rounded-full"></span>
                        Alterações de Horário:
                      </div>
                      <div className="bg-studio-sand/30 dark:bg-studio-brown/20 p-3 rounded-xl max-h-32 overflow-y-auto no-scrollbar border border-studio-brown/5">
                        {syncSummary.updated.map(name => (
                          <div key={name} className="text-[10px] font-black text-studio-black dark:text-studio-beige uppercase py-1 border-b border-studio-brown/5 last:border-0">• {name}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {syncSummary.deleted > 0 && (
                    <div className="flex items-center gap-2 text-[10px] font-bold text-red-500 uppercase tracking-widest">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                      {syncSummary.deleted} Aulas Removidas / Canceladas
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => setSyncSummary(null)}
                className="w-full py-4 bg-studio-orange text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-studio-orange/30 active:scale-95 transition-all"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 py-3 rounded-xl shadow-2xl text-[10px] font-black uppercase tracking-widest text-white animate-slide pointer-events-auto border border-white/20 ${t.type === 'success' ? 'bg-studio-orange' : (t.type === 'error' ? 'bg-red-600' : 'bg-studio-brown')}`}>
            {t.msg}
          </div>
        ))}
      </div>

      <Sidebar
        currentView={view}
        setView={setView}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        onImport={handleImportXlsx}
        onSync={handleEmusysSync}
        onCloudSync={handleCloudSync}
        onCloudRestore={handleCloudRestore}
        onReset={() => confirm("Apagar todos os dados definitivamente?") && (setTeachers([]), setSlots([]), setConfirmations({}), setOverrides({}), setExpenses([]), addToast("Sistema reiniciado", "success"))}
        hasUpdates={hasUpdates}
      />

      <main className={`flex-1 flex overflow-hidden glass-panel md:rounded-l-[3rem] md:my-2 md:mr-0 border-y border-l border-studio-brown/10 relative pb-20 md:pb-0 ${view === 'calendar' ? 'flex-row' : 'flex-col md:flex-row'}`}>
        <div className={`flex-1 flex flex-col min-w-0 ${view === 'calendar' ? 'hidden md:flex' : 'flex'}`}>
          <header className="py-6 px-6 md:px-10 flex flex-col gap-5 border-b border-studio-brown/5 bg-white/50 dark:bg-studio-black/50 backdrop-blur-md sticky top-0 z-40">
            <div className="flex items-center justify-between w-full">
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-studio-orange uppercase tracking-[0.3em] mb-1">Studio Connect v4.5</span>
                <h2 className="text-2xl md:text-3xl font-black text-studio-black dark:text-studio-beige tracking-tight uppercase">
                  {view === 'calendar' ? 'Calendário' : (view === 'weekly' ? 'Visão Semanal' : (view === 'dashboard' ? 'Dashboard' : (view === 'financial' ? 'Financeiro' : 'Equipe')))}
                </h2>
              </div>
              <div className="hidden md:flex flex-col items-end">
                <div className="text-[10px] font-bold text-studio-brown/40 uppercase">Aulas Hoje</div>
                <div className="text-lg font-black text-studio-orange">{slots.filter(s => s.dayOfWeek === new Date().getDay()).length}</div>
              </div>
            </div>

            {(view !== 'teachers' && view !== 'dashboard' && view !== 'financial') && (
              <div className="flex items-center gap-3">
                <div className="text-[9px] font-black text-studio-brown/30 uppercase tracking-widest rotate-180 [writing-mode:vertical-lr] hidden md:block">Filtros</div>
                <div className="flex-1 flex gap-2 overflow-x-auto no-scrollbar pb-1 mask-linear-right">
                  <button
                    onClick={() => setSelectedTeacherId('')}
                    className={`shrink-0 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${selectedTeacherId === ''
                      ? 'bg-studio-orange text-white border-studio-orange shadow-lg shadow-studio-orange/20'
                      : 'card-bg border-studio-sand dark:border-studio-brown/30 hover:border-studio-orange/30 text-studio-brown/60 dark:text-studio-beige/40'
                      }`}
                  >
                    Equipe Toda
                  </button>
                  {teachers.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTeacherId(t.id)}
                      className={`shrink-0 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${selectedTeacherId === t.id
                        ? 'bg-studio-orange text-white border-studio-orange shadow-lg shadow-studio-orange/20'
                        : 'card-bg border-studio-sand dark:border-studio-brown/30 hover:border-studio-orange/30 text-studio-brown/60 dark:text-studio-beige/40'
                        }`}
                    >
                      {t.name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </header>

          <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
            {view === 'dashboard' && (
              <Dashboard
                slots={slots}
                teachers={teachers}
                onContact={(d, id) => {
                  const cur = contactedStatuses[d] || [];
                  if (!cur.includes(id)) {
                    setContactedStatuses({ ...contactedStatuses, [d]: [...cur, id] });
                  }
                }}
                onRestore={handleCloudRestore}
                isSyncing={isSyncing}
              />
            )}
            {view === 'financial' && (
              <FinancialDashboard
                expenses={expenses}
                onUpdateExpenses={setExpenses}
                teachers={teachers}
              />
            )}
            {view === 'calendar' && (
              <MonthlyCalendar
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                slots={slots}
                teacherId={selectedTeacherId}
              />
            )}
            {view === 'weekly' && (
              <WeeklyView
                slots={slots}
                teachers={teachers}
                teacherId={selectedTeacherId}
              />
            )}
            {view === 'teachers' && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-slide">
                {teachers.map(t => {
                  const teacherSlots = slots.filter(s => s.teacherId === t.id);
                  const uniqueStudents = new Set(teacherSlots.map(s => s.studentName.toUpperCase().trim())).size;

                  return (
                    <div key={t.id} className="p-6 card-bg rounded-3xl flex flex-col items-center text-center gap-4 group transition-all hover:border-studio-orange/20 shadow-sm">
                      <div className="w-12 h-12 card-bg rounded-2xl flex items-center justify-center font-black text-xl text-studio-orange">
                        {t.name.charAt(0)}
                      </div>
                      <div className="w-full">
                        <div className="font-black text-sm text-studio-black dark:text-studio-beige uppercase truncate">{t.name}</div>
                        <div className="flex flex-col gap-1 mt-2">
                          <div className="text-[10px] font-bold text-studio-orange uppercase tracking-widest">
                            {uniqueStudents} Alunos Únicos
                          </div>
                          <div className="text-[9px] font-bold text-studio-brown/40 dark:text-studio-beige/20 uppercase tracking-widest">
                            {teacherSlots.length} Aulas no Mês
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => confirm(`Remover ${t.name}?`) && (setTeachers(prev => prev.filter(x => x.id !== t.id)), setSlots(prev => prev.filter(x => x.teacherId !== t.id)))}
                        className="text-[9px] font-black text-red-500 uppercase opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50 px-3 py-1.5 rounded-lg"
                      >
                        Excluir
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Calendar Strip on mobile is rendered inside MonthlyCalendar (fixed), 
            but we need DayDetailPanel to be visible on mobile in calendar view */}
        {(view === 'calendar') && (
          <div className="md:hidden">
            <MonthlyCalendar
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              slots={slots}
              teacherId={selectedTeacherId}
            />
          </div>
        )}

        {(view !== 'weekly' && view !== 'dashboard' && view !== 'financial') && (
          <DayDetailPanel
            date={selectedDate}
            teacherId={selectedTeacherId}
            teachers={teachers}
            slots={slots}
            confirmations={confirmations}
            contactedStatuses={contactedStatuses}
            onToggle={(d, id) => {
              const cur = confirmations[d] || [];
              setConfirmations({ ...confirmations, [d]: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id] });
            }}
            onContact={(d, id) => {
              const cur = contactedStatuses[d] || [];
              if (!cur.includes(id)) {
                setContactedStatuses({ ...contactedStatuses, [d]: [...cur, id] });
              }
            }}
            onToast={addToast}
          />
        )}
      </main>

      {/* Persistence Loading Overlay */}
      {isSyncing && teachers.length === 0 && (
        <div className="fixed inset-0 z-[1000] bg-studio-beige dark:bg-studio-black flex flex-col items-center justify-center p-10 text-center gap-6">
          <div className="w-20 h-20 border-4 border-studio-orange/20 border-t-studio-orange rounded-full animate-spin"></div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black text-studio-black dark:text-studio-beige uppercase">Conectando ao Studio</h1>
            <p className="text-xs font-bold text-studio-brown/40 uppercase tracking-widest">Sincronizando dados com a nuvem...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;