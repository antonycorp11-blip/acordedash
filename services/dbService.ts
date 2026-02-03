import { supabase } from '../lib/supabase';
import { Teacher, ScheduleSlot, Expense } from '../types';

export const dbService = {
    // Teachers
    async getTeachers() {
        const { data, error } = await supabase.from('teachers').select('*').order('name');
        if (error) throw error;
        return data || [];
    },

    // Slots
    async getSlots() {
        const { data, error } = await supabase.from('schedule_slots').select('*');
        if (error) throw error;
        return data || [];
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
        return data || [];
    },

    // Financial Settings (Manual Receivable)
    async getFinancialSettings() {
        const { data, error } = await supabase.from('financial_settings').select('*');
        if (error) throw error;
        return data || [];
    },

    // MASSIVE SYNC (LocalStorage -> Supabase)
    async syncAll(data: {
        teachers: Teacher[],
        slots: ScheduleSlot[],
        confirmations: any,
        expenses: Expense[]
    }) {
        console.log('Starting Supabase Sync...');

        // 1. Teachers
        if (data.teachers.length > 0) {
            await supabase.from('teachers').upsert(data.teachers);
        }

        // 2. Slots
        if (data.slots.length > 0) {
            await supabase.from('schedule_slots').upsert(data.slots);
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
            // Filter out any expense without a proper ID (uuid)
            const validExpenses = data.expenses.map(e => ({
                ...e,
                id: (e.id && e.id.length > 10) ? e.id : undefined // Ensure it's likely a UUID/String ID
            })).filter(e => e.id);
            await supabase.from('expenses').upsert(validExpenses);
        }

        console.log('Supabase Sync Complete!');
    }
};
