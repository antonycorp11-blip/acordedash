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

async function check() {
    const { data, error } = await supabase.from('schedule_slots').select('*');
    if (error) {
        console.error(error);
        return;
    }
    console.log(`Total slots in DB: ${data.length}`);
    const aprilSlots = data.filter(s => s.date && s.date.startsWith('2026-04'));
    console.log(`April slots in DB: ${aprilSlots.length}`);
}
check();
