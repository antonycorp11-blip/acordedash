
import React, { useState } from 'react';
import { Teacher } from '../types';

interface Props {
  teachers: Teacher[];
  onAdd: (name: string) => void;
  onDelete: (id: string) => void;
}

const TeacherManager: React.FC<Props> = ({ teachers, onAdd, onDelete }) => {
  const [newName, setNewName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim()) {
      onAdd(newName.trim());
      setNewName('');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-slide pb-20">
      <div className="card-bg p-8 rounded-[3rem] shadow-sm border border-studio-brown/5">
        <h2 className="text-[10px] font-black text-studio-orange uppercase tracking-[0.3em] mb-6 text-center">Novo Docente</h2>
        <form onSubmit={handleSubmit} className="flex gap-4">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome Completo do Professor"
            className="flex-1 px-6 py-4 rounded-2xl bg-studio-sand/20 dark:bg-studio-brown/20 dark:text-studio-beige border border-studio-sand dark:border-studio-brown/10 outline-none font-black text-sm transition-all focus:border-studio-orange"
          />
          <button
            type="submit"
            className="bg-studio-orange text-white px-10 py-4 rounded-2xl text-xs font-black uppercase shadow-xl shadow-studio-orange/20 hover:brightness-110 active:scale-95 transition-all"
          >
            Cadastrar
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {teachers.map((t) => (
          <div key={t.id} className="p-6 card-bg rounded-[2.5rem] border border-studio-brown/5 flex items-center justify-between group transition-all hover:border-studio-orange/20">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-studio-orange/10 dark:bg-studio-orange/20 rounded-xl flex items-center justify-center font-black text-studio-orange">
                {t.name.charAt(0)}
              </div>
              <span className="text-studio-black dark:text-studio-beige text-sm font-black uppercase truncate max-w-[150px]">{t.name}</span>
            </div>
            <button
              onClick={() => window.confirm(`Remover ${t.name}?`) && onDelete(t.id)}
              className="w-10 h-10 flex items-center justify-center text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        ))}
        {teachers.length === 0 && (
          <div className="col-span-full py-20 text-center opacity-20 text-[10px] font-black uppercase tracking-widest">Nenhum professor na base</div>
        )}
      </div>
    </div>
  );
};

export default TeacherManager;
