const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
const lines = envFile.split('\n');
const env = {};
lines.forEach(line => {
    const [k, v] = line.split('=');
    if(k && v) env[k.trim()] = v.trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const EMUSYS_API_URL = 'https://api.emusys.com.br/v1';
const API_TOKEN = env.VITE_EMUSYS_TOKEN;

const normalizeKey = (s) => {
    return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
};

async function sync() {
    console.log("Fetching Emusys classes...");
    const d = new Date();
    const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0] + ' 00:00:00';
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 6, 0).toISOString().split('T')[0] + ' 23:59:59';
    
    let url = `${EMUSYS_API_URL}/aulas?token=${API_TOKEN}&data_hora_inicial=${encodeURIComponent(firstDay)}&data_hora_final=${encodeURIComponent(lastDay)}`;
    let res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    let data = await res.json();
    let lessons = data.items;
    while(data.paginacao?.tem_mais && data.paginacao?.proximo_cursor) {
        res = await fetch(url + '&cursor=' + encodeURIComponent(data.paginacao.proximo_cursor), { headers: { 'Accept': 'application/json' } });
        data = await res.json();
        lessons = lessons.concat(data.items);
    }
    console.log(`Fetched ${lessons.length} lessons from Emusys.`);

    const teachersMap = new Map();
    const scheduleSlots = [];

    lessons.forEach(lesson => {
        if (lesson.cancelada) return;

        const teacherName = (lesson.professores[0]?.nome || 'DESCONHECIDO').toUpperCase().trim();
        let teacher = teachersMap.get(teacherName);

        if (!teacher) {
            const cleanName = normalizeKey(teacherName);
            const cleanId = `t-${cleanName.replace(/[^A-Z0-9]/g, '')}`;
            teacher = { id: cleanId, name: teacherName };
            teachersMap.set(teacherName, teacher);
        }

        const [datePart, timePart] = lesson.data_hora_inicio.split(' ');
        const [year, month, day] = datePart.split('-').map(Number);
        const dateObj = new Date(year, month - 1, day);
        const dayOfWeek = dateObj.getDay();
        const time = timePart.substring(0, 5);

        scheduleSlots.push({
            id: `em-${lesson.id}`,
            teacherid: teacher.id,
            dayofweek: dayOfWeek,
            time: time,
            studentname: (lesson.alunos[0]?.nome_aluno || 'SEM ALUNO').trim(),
            instrument: (lesson.curso_nome || 'GERAL').trim(),
            isexperimental: (lesson.categoria || '').toLowerCase().includes('experimental'),
            date: datePart,
        });
    });

    console.log(`Prepared ${scheduleSlots.length} slots for DB. Upserting in chunks...`);
    
    const teachersList = Array.from(teachersMap.values());
    if (teachersList.length > 0) {
        const { error } = await supabase.from('teachers').upsert(teachersList);
        if (error) console.error("Error upserting teachers:", error);
    }

    const chunkSize = 100;
    for (let i = 0; i < scheduleSlots.length; i += chunkSize) {
        const chunk = scheduleSlots.slice(i, i + chunkSize);
        const { error } = await supabase.from('schedule_slots').upsert(chunk);
        if (error) console.error("Error upserting slots chunk:", error);
    }

    console.log("Upsert complete!");
    
    const { data: dbData } = await supabase.from('schedule_slots').select('*');
    const aprilSlots = dbData.filter(s => s.date && s.date.startsWith('2026-04'));
    console.log(`Total slots in DB: ${dbData.length}`);
    console.log(`April slots in DB: ${aprilSlots.length}`);
}
sync();
