import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wayigtlilhvutbfvxgae.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY; 

const VAPID_PUBLIC_KEY = process.env.VITE_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

webpush.setVapidDetails(
  'mailto:suporte@confirmaulastudio.com.br',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const isTest = req.body?.isTest === true;
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Ler as configuraçoes de horario se não for teste
    if (!isTest) {
      const { data: settings } = await supabase.from('studio_settings').select('setting_value').eq('setting_key', 'push_hours').single();
      const pushHours = settings?.setting_value || ["09:00","11:00","14:00","16:00"];
      
      // Checar se a hora atual (Em Cuiabá, UTC-4) bate com as regras
      const nowMT = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Cuiaba" }));
      const currentHourStr = nowMT.getHours().toString().padStart(2, '0') + ":00";
      
      if (!pushHours.includes(currentHourStr)) {
         return res.status(200).json({ success: true, msg: `Ignorado. Hora atual MT (${currentHourStr}) não está configurada nos horários de disparo.` });
      }
    }
    
    // Se passou (ou é Teste), busca assinaturas do banco e dispara
    const { data: subscriptions, error } = await supabase.from('push_subscriptions').select('*');
    
    if (error || !subscriptions || subscriptions.length === 0) {
      return res.status(500).json({ error: 'Nenhum aparelho cadastrado ou erro DB.' });
    }

    const payload = JSON.stringify({
      title: isTest ? '🔧 TESTE: ConfirmAula!' : '🎸 STUDIO CALL: CONFIRMAÇÕES!',
      body: isTest ? 'Sua conexão de Web Push nativa está sincronizada!' : 'Chegou o momento! Inicie o disparo dos Whatsapps para garantir a agenda cheia hoje/amanhã.',
      icon: '/apple-touch-icon.png'
    });

    const promises = subscriptions.map(sub => {
       try {
         const subscriptionObject = typeof sub.subscription === 'string' ? JSON.parse(sub.subscription) : sub.subscription;
         return webpush.sendNotification(subscriptionObject, payload).catch(err => {
            console.error(`Falha Push para: ${sub.alias}`, err?.statusCode || err);
         });
       } catch (e) {
           return Promise.resolve();
       }
    });

    await Promise.all(promises);

    res.status(200).json({ success: true, disparos: subscriptions.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Verifique se você criou a tabela no Supabase.' });
  }
}
