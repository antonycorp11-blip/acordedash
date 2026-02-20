import { supabase } from '../lib/supabase';
import { Teacher, ScheduleSlot, Expense } from '../types';

export const dbService = {
    // Helper to map DB columns to JS keys
    mapFromDB(row: any) {
        if (!row) return row;
        const mapped: any = { ...row };
        if (row.teacherid) mapped.teacherId = row.teacherid;
        if (row.studentname) mapped.studentName = row.studentname;
        if (row.dayofweek !== undefined) mapped.dayOfWeek = row.dayofweek;
        if (row.isexperimental !== undefined) mapped.isExperimental = row.isexperimental;
        if (row.startdate) mapped.startDate = row.startdate;
        return mapped;
    },

    mapToDB(obj: any) {
        if (!obj) return obj;
        const mapped: any = { ...obj };
        if (obj.teacherId) { mapped.teacherid = obj.teacherId; delete mapped.teacherId; }
        if (obj.studentName) { mapped.studentname = obj.studentName; delete mapped.studentName; }
        if (obj.dayOfWeek !== undefined) { mapped.dayofweek = obj.dayOfWeek; delete mapped.dayOfWeek; }
        if (obj.isExperimental !== undefined) { mapped.isexperimental = obj.isExperimental; delete mapped.isExperimental; }
        if (obj.startDate) { mapped.startdate = obj.startDate; delete mapped.startDate; }
        return mapped;
    },

    // Teachers
    async getTeachers() {
        const { data, error } = await supabase.from('teachers').select('*').order('name');
        if (error) throw error;
        return (data || []).map(t => this.mapFromDB(t)) as Teacher[];
    },

    // Slots
    async getSlots() {
        const { data, error } = await supabase.from('schedule_slots').select('*');
        if (error) throw error;
        return (data || []).map(s => this.mapFromDB(s)) as ScheduleSlot[];
    },

    // Confirmations
    async getConfirmations() {
        const { data, error } = await supabase.from('confirmations').select('*');
        if (error) throw error;
        const conf: any = {};
        data?.forEach(item => {
            conf[item.date] = item.slot_ids;
        });
        return conf;
    },

    // Expenses
    async getExpenses() {
        const { data, error } = await supabase.from('expenses').select('*');
        if (error) throw error;
        return (data || []).map(e => this.mapFromDB(e)) as Expense[];
    },

    // Financial Settings
    async getFinancialSettings(month?: string) {
        let query = supabase.from('financial_settings').select('*');
        if (month) query = query.eq('month', month);
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    async saveFinancialSetting(month: string, value: number) {
        const { error } = await supabase.from('financial_settings').upsert({
            month,
            manual_receivable: value
        });
        if (error) throw error;
    },

    // MASSIVE SYNC
    async syncAll(data: {
        teachers: Teacher[],
        slots: ScheduleSlot[],
        confirmations: any,
        expenses: Expense[]
    }) {
        console.log('Starting Supabase Sync...');

        try {
            // 1. Teachers
            if (data.teachers.length > 0) {
                const teachersToDb = data.teachers.map(t => ({
                    id: t.id,
                    name: t.name
                }));
                const { error: tErr } = await supabase.from('teachers').upsert(teachersToDb);
                if (tErr) throw tErr;
            }

            // 2. Slots
            if (data.slots.length > 0) {
                const slotsToDb = data.slots.map(s => ({
                    id: s.id,
                    teacherid: s.teacherId,
                    dayofweek: s.dayOfWeek,
                    time: s.time,
                    studentname: s.studentName,
                    instrument: s.instrument,
                    isexperimental: s.isExperimental,
                    date: s.date || null
                }));
                const { error: sErr } = await supabase.from('schedule_slots').upsert(slotsToDb);
                if (sErr) throw sErr;
            }

            // 3. Confirmations
            const confRows = Object.entries(data.confirmations).map(([date, slot_ids]) => ({
                date,
                slot_ids
            }));
            if (confRows.length > 0) {
                const { error: cErr } = await supabase.from('confirmations').upsert(confRows);
                if (cErr) throw cErr;
            }

            // 4. Expenses
            if (data.expenses.length > 0) {
                const expToDb = data.expenses.map(e => ({
                    id: e.id,
                    description: e.description,
                    amount: e.amount,
                    category: e.category,
                    type: e.type,
                    startdate: e.startDate
                }));
                const { error: eErr } = await supabase.from('expenses').upsert(expToDb);
                if (eErr) throw eErr;
            }

            console.log('Supabase Sync Complete!');
        } catch (err: any) {
            console.error('Supabase Sync Failed!', {
                message: err.message,
                details: err.details,
                hint: err.hint,
                code: err.code
            });
            throw err;
        }
    },

    async deleteTeachers(ids: string[]) {
        if (ids.length === 0) return;
        const { error } = await supabase.from('teachers').delete().in('id', ids);
        if (error) throw error;
    }
};
