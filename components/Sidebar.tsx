
import React from 'react';

interface Props {
  currentView: string;
  setView: (v: 'calendar' | 'teachers' | 'weekly' | 'dashboard' | 'financial') => void;
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
  onImport: (file: File) => void;
  onSync: () => void;
  onReset: () => void;
  hasUpdates?: boolean;
}

const Sidebar: React.FC<Props> = ({ currentView, setView, darkMode, setDarkMode, onImport, onSync, onReset, hasUpdates }) => {
  // Always light for the dark sidebar on mobile
  const iconColor = 'text-white/60';
  const inactiveClass = `${iconColor} hover:text-studio-orange hover:bg-white/10`;
  const activeClass = 'bg-studio-orange text-white shadow-xl scale-110 opacity-100';

  return (
    <aside className="w-full h-20 md:w-24 md:h-screen fixed bottom-0 md:relative flex md:flex-col items-center justify-center md:justify-start md:py-8 md:gap-10 bg-[#121212] z-[200] shadow-2xl shrink-0 px-2 md:px-0">
      {/* Desktop Logo */}
      <button
        onClick={() => setView('dashboard')}
        className={`hidden md:flex w-12 h-12 bg-studio-orange rounded-2xl items-center justify-center text-white font-black text-2xl shadow-lg transition-all hover:scale-110 active:scale-95 ${currentView === 'dashboard' ? 'ring-4 ring-orange-500/40' : 'shadow-orange-500/20'}`}
      >
        C
      </button>

      <nav className="flex md:flex-col gap-4 md:gap-6 items-center flex-1 w-full justify-start md:justify-start overflow-x-auto no-scrollbar py-2 px-4 shadow-inner">
        <button
          onClick={() => setView('dashboard')}
          className={`shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center transition-all ${currentView === 'dashboard' ? activeClass : inactiveClass}`}
          title="Início"
        >
          <svg className="w-6 h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
        </button>

        <button
          onClick={() => setView('calendar')}
          className={`shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center transition-all ${currentView === 'calendar' ? activeClass : inactiveClass}`}
          title="Calendário"
        >
          <svg className="w-6 h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        </button>

        <button
          onClick={() => setView('financial')}
          className={`shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center transition-all ${currentView === 'financial' ? activeClass : inactiveClass}`}
          title="Financeiro"
        >
          <svg className="w-6 h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1V8m0 8v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </button>

        <button
          className={`shrink-0 hidden md:flex w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl items-center justify-center transition-all ${currentView === 'weekly' ? activeClass : inactiveClass}`}
          onClick={() => setView('weekly')}
          title="Semana"
        >
          <svg className="w-6 h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>
        </button>

        <button
          className={`shrink-0 hidden md:flex w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl items-center justify-center transition-all ${currentView === 'teachers' ? activeClass : inactiveClass}`}
          onClick={() => setView('teachers')}
          title="Equipe"
        >
          <svg className="w-6 h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
        </button>

        {/* Sync Button on Mobile - Integrated and clean */}
        <div className="flex md:hidden items-center gap-4 pl-4 border-l border-white/10 ml-2">
          <button
            onClick={onSync}
            className="shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center bg-studio-orange text-white transition-all relative shadow-lg shadow-studio-orange/20 active:scale-95"
            title={hasUpdates ? "Atualizar do Emusys" : "Sincronizar Emusys"}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" /></svg>
            {hasUpdates && <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 border-2 border-[#121212] animate-pulse"></div>}
          </button>
        </div>
      </nav>

      {/* Desktop Actions */}
      <div className="hidden md:flex flex-col gap-4 pb-8">
        <button
          onClick={onSync}
          className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all bg-white/5 border border-white/10 hover:bg-studio-orange hover:text-white group relative ${hasUpdates ? 'text-studio-orange' : 'text-white/40'}`}
          title="Sincronizar Emusys"
        >
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" /></svg>
          {hasUpdates && <div className="absolute top-3 right-3 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#121212] animate-pulse"></div>}
        </button>

        <button
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.xlsx';
            input.onchange = (e) => onImport((e.target as HTMLInputElement).files![0]);
            input.click();
          }}
          className="w-14 h-14 rounded-2xl flex items-center justify-center bg-white/5 border border-white/10 text-white/40 hover:bg-white/10 transition-all"
          title="Importar Excel"
        >
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0l-4 4m4-4v12" /></svg>
        </button>
      </div>

      <div className="flex flex-col gap-2 items-center mt-auto pb-4">
        <button onClick={() => setDarkMode(!darkMode)} className="text-2xl hover:scale-110 transition-transform p-2 bg-white/5 rounded-xl">
          {darkMode ? '☀️' : '🌙'}
        </button>

        <button onClick={onReset} className="w-10 h-10 flex items-center justify-center text-white/20 hover:text-red-500 transition-all">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;