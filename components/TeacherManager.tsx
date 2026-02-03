
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
    <div className="max-w-md mx-auto space-y-4">
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800">
        <h2 className="text-xs font-black text-gray-400 dark:text-slate-500 uppercase mb-3 text-center">Cadastrar Professor</h2>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome Completo"
            className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 dark:text-white focus:ring-1 focus:ring-indigo-500 outline-none font-bold"
          />
          <button
            type="submit"
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-black uppercase hover:bg-indigo-700 transition-colors shadow-sm"
          >
            OK
          </button>
        </form>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
        <h2 className="bg-slate-50 dark:bg-slate-800 px-4 py-2 text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest border-b border-gray-100 dark:border-slate-700 text-center">
          Lista de Professores ({teachers.length})
        </h2>
        {teachers.length === 0 ? (
          <p className="text-gray-400 dark:text-slate-700 text-[11px] font-bold text-center py-10 uppercase">Vazio</p>
        ) : (
          <ul className="divide-y divide-gray-50 dark:divide-slate-800">
            {teachers.map((t) => (
              <li key={t.id} className="px-4 py-3 flex items-center justify-between group hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <span className="text-gray-700 dark:text-slate-200 text-sm font-black">{t.name}</span>
                <button
                  onClick={() => window.confirm(`Remover ${t.name}?`) && onDelete(t.id)}
                  className="text-red-400 hover:text-red-600 p-1 rounded-lg transition-all"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default TeacherManager;
