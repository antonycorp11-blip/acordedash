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

        // 1. Teachers
        if (data.teachers.length > 0) {
            // Filter out non-UUIDs if necessary, but Emusys IDs are now t-NAME (not UUID)
            // If the DB requires UUID, we have a problem. 
            // Let's try to upsert and see. 
            await supabase.from('teachers').upsert(data.teachers.map(t => this.mapToDB(t)));
        }

        // 2. Slots
        if (data.slots.length > 0) {
            const slotsToSync = data.slots.map(s => this.mapToDB(s));
            await supabase.from('schedule_slots').upsert(slotsToSync);
        }

        // 3. Confirmations
        const confRows = Object.entries(data.confirmations).map(([date, slot_ids]) => ({
            date,
            slot_ids
        }));
        if (confRows.length > 0) {
            await supabase.from('confirmations').upsert(confRows);
        }

        // 4. Expenses
        if (data.expenses.length > 0) {
            const validExpenses = data.expenses.map(e => this.mapToDB(e));
            await supabase.from('expenses').upsert(validExpenses);
        }

        console.log('Supabase Sync Complete!');
    }
};
