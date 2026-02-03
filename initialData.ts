
import { Teacher, ScheduleSlot } from './types';

export const INITIAL_TEACHERS_LIST: string[] = [];

export const getInitialData = (teacherMap: Record<string, string>): Omit<ScheduleSlot, 'id'>[] => {
  return [];
};
