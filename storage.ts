
import { Teacher, ScheduleSlot, Confirmations, DateOverrides } from './types';

const KEYS = {
  T: 'ca_t',
  S: 'ca_s',
  C: 'ca_c',
  O: 'ca_o',
  E: 'ca_e'
};

export const loadData = () => {
  return {
    teachers: JSON.parse(localStorage.getItem(KEYS.T) || '[]') as Teacher[],
    slots: JSON.parse(localStorage.getItem(KEYS.S) || '[]') as ScheduleSlot[],
    confirmations: JSON.parse(localStorage.getItem(KEYS.C) || '{}') as Confirmations,
    overrides: JSON.parse(localStorage.getItem(KEYS.O) || '{}') as DateOverrides,
    expenses: JSON.parse(localStorage.getItem(KEYS.E) || '[]') as any[]
  };
};

export const saveData = (t: Teacher[], s: ScheduleSlot[], c: Confirmations, o: DateOverrides, e: any[]) => {
  localStorage.setItem(KEYS.T, JSON.stringify(t));
  localStorage.setItem(KEYS.S, JSON.stringify(s));
  localStorage.setItem(KEYS.C, JSON.stringify(c));
  localStorage.setItem(KEYS.O, JSON.stringify(o));
  localStorage.setItem(KEYS.E, JSON.stringify(e));
};
