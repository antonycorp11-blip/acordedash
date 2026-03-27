import React, { useState, useEffect } from 'react';
import { dbService } from '../services/dbService';
import { notificationService } from '../services/notificationService';

interface Props {
  onClose: () => void;
}

const PushSettingsModal: React.FC<Props> = ({ onClose }) => {
  const [deviceAlias, setDeviceAlias] = useState('');
  const [loading, setLoading] = useState(false);
  const [alertMsg, setAlertMsg] = useState('');
  const [hours, setHours] = useState<string[]>([]);

  useEffect(() => {
    dbService.getPushSettings().then(h => {
      setHours(h || ["09:00", "11:00", "14:00", "16:00"]);
    }).catch(() => {
       setHours(["09:00", "11:00", "14:00", "16:00"]);
    });
  }, []);

  const handleSaveHours = async () => {
     setLoading(true);
     try {
       await dbService.savePushSettings(hours);
       setLoading(false);
       setAlertMsg("✅ Relógio Central de Horários atualizado na nuvem!");
     } catch (e) {
       setLoading(false);
       setAlertMsg("❌ Falha ao salvar novos horários do robô.");
     }
  };

  const toggleHour = (hr: string) => {
    setHours(prev => prev.includes(hr) ? prev.filter(x => x !== hr) : [...prev, hr].sort());
  };

  const handleSubscribe = async () => {
    if (!deviceAlias.trim()) return setAlertMsg("❌ Nomeie seu aparelho primeiro!");
    setLoading(true);
    const res = await notificationService.subscribeToWebPush(deviceAlias.trim());
    setLoading(false);
    if (res.error) setAlertMsg("❌ " + res.error);
    else setAlertMsg("✅ Celular ativado! Teste a notificação agora.");
  };

  const handleTest = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cron-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isTest: true })
      });
      const data = await res.json();
      setLoading(false);
      if (res.ok) setAlertMsg(`✅ Teste enviado para os celulares ativados!`);
      else setAlertMsg("❌ Erro na API: " + (data.error || 'Erro desconhecido'));
    } catch (e) {
      setLoading(false);
      setAlertMsg("❌ Falha ao conectar na API de teste.");
    }
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center bg-studio-black/90 backdrop-blur-md p-4">
      <div className="card-bg rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-studio-brown/10 animate-slide">
        <div className="p-5 border-b border-studio-brown/5 flex justify-between items-center bg-studio-orange text-white">
          <span className="text-xs font-black uppercase tracking-widest">Painel de Alertas Automáticos</span>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-all font-bold text-xl">&times;</button>
        </div>
        
        <div className="p-6 space-y-6">
          <p className="text-[11px] font-bold text-studio-brown/60 dark:text-studio-beige/60 uppercase tracking-widest leading-relaxed">
            Configure seu perfil de disparos e os relógios (se for plano ilimitado):
          </p>

          <div className="space-y-4">
             {/* Device Setup */}
             <div className="space-y-2 bg-studio-sand/20 dark:bg-studio-brown/10 p-4 rounded-2xl border border-studio-brown/5">
               <span className="text-[9px] font-black uppercase tracking-[0.2em] text-studio-orange">1. Este Aparelho</span>
               <input 
                  type="text" 
                  value={deviceAlias} 
                  onChange={(e) => setDeviceAlias(e.target.value)} 
                  placeholder="Seu Nome Ex: Aquilles (iPhone)" 
                  className="w-full bg-white dark:bg-studio-brown/20 border border-studio-brown/10 dark:border-studio-beige/10 rounded-xl px-4 py-3 text-sm font-bold text-studio-black dark:text-studio-beige focus:outline-none focus:border-studio-orange" 
               />
               <button disabled={loading} onClick={handleSubscribe} className="w-full py-3 bg-studio-black dark:bg-studio-beige text-white dark:text-studio-black rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">
                 {loading ? 'Processando...' : 'Ativar Celular'}
               </button>
             </div>

             {/* Hours Config */}
             <div className="space-y-3 bg-studio-sand/20 dark:bg-studio-brown/10 p-4 rounded-2xl border border-studio-brown/5">
                <div className="flex justify-between items-center">
                   <span className="text-[9px] font-black uppercase tracking-[0.2em] text-studio-orange">2. Horários de Disparo Global</span>
                   <button onClick={handleSaveHours} disabled={loading} className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded hover:bg-emerald-500/10 transition-all">
                      Salvar Regras
                   </button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {["09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00", "18:00"].map(hr => (
                    <button 
                      key={hr} 
                      onClick={() => toggleHour(hr)}
                      className={`py-2 text-[10px] font-black rounded-xl transition-all border ${hours.includes(hr) ? 'bg-studio-orange text-white border-studio-orange' : 'bg-white dark:bg-studio-brown/20 text-studio-brown/60 dark:text-studio-beige/30 border-studio-brown/10'}`}
                    >
                      {hr}
                    </button>
                  ))}
                </div>
             </div>

             <button disabled={loading} onClick={handleTest} className="w-full py-4 mt-2 bg-studio-orange/10 dark:bg-studio-orange/5 text-studio-orange border border-studio-orange/20 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-studio-orange hover:text-white active:scale-95 transition-all flex items-center justify-center gap-2">
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
               {loading ? 'Ligando p/ Servidor...' : 'Disparar Teste Geral Agora'}
             </button>
          </div>

          {alertMsg && (
            <div className="p-4 bg-studio-sand/50 dark:bg-studio-brown/30 rounded-xl text-xs font-bold text-center">
              {alertMsg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PushSettingsModal;
