import { ScheduleSlot, Teacher, Confirmations } from '../types';

export const notificationService = {
  /**
   * Identifica quais aulas precisam de confirmação (Alunos) para amanhã
   */
  getPendingStudentReminders(slots: ScheduleSlot[], confirmations: Confirmations, dateToCheck: string) {
    // TODO: Analisar todos os slots do dDateToCheck e retornar os não confirmados
    return [];
  },

  /**
   * Identifica professores que esqueceram de confirmar agendas de dias passados
   */
  getPendingTeacherReminders(slots: ScheduleSlot[], confirmations: Confirmations, teachers: Teacher[]) {
    // TODO: Varredura retroativa
    return [];
  },

  /**
   * Ponto de entrada p/ futuro sistema de mensageria (WhatsApp API / Push / WebHook)
   */
  async dispatchNotification(target: string, message: string, type: 'whatsapp' | 'push' | 'email') {
    console.log(`[Notificação Pronta: ${type}] Para: ${target} Msg: ${message}`);
    // Futura integração com Backend/Supabase Edge Functions
    return { success: true, timestamp: Date.now() };
  },

  async subscribeToWebPush(aliasName: string) {
    if (!('serviceWorker' in navigator)) return { error: 'Service workers não suportados (Uso iOS desatualizado ou não PWA)' };
    if (!('PushManager' in window)) return { error: 'Push não nativo suportado neste browser' };
    
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return { error: 'Permissão negada pelo usuário' };
      
      const registration = await navigator.serviceWorker.ready;
      
      const VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!VAPID_KEY) return { error: 'VAPID PUBLIC KEY não encontrada no env' };

      const padding = '='.repeat((4 - VAPID_KEY.length % 4) % 4);
      const base64 = (VAPID_KEY + padding).replace(/\-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      const convertedVapidKey = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        convertedVapidKey[i] = rawData.charCodeAt(i);
      }
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });
      
      const { dbService } = await import('./dbService');
      await dbService.savePushSubscription(aliasName, JSON.stringify(subscription));

      return { success: true };
    } catch (e: any) {
      console.error(e);
      return { error: e.message };
    }
  }
};
