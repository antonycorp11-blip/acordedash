
export interface Teacher {
  id: string;
  name: string;
}

export interface ScheduleSlot {
  id: string;
  teacherId: string;
  dayOfWeek: number; // 0 (Domingo) a 6 (Sábado)
  time: string; // Formato HH:mm
  studentName: string;
  instrument: string;
  isExperimental: boolean;
  date?: string; // Data específica da aula (YYYY-MM-DD)
  createdAt: number;
}

export interface Confirmations {
  [date: string]: string[];
}

export interface DateOverrides {
  [date: string]: {
    hidden: string[];
  };
}

export const DAYS_OF_WEEK = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado'
];

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: 'Estrutura' | 'Pessoal' | 'Investimentos/Dividas' | 'Impostos';
  type: 'fixed' | 'installment' | 'single';
  installments?: number; // Total number of installments
  currentInstallment?: number; // Only for reference
  startDate: string; // YYYY-MM
}

export interface FinancialData {
  receivables: {
    amount: number;
    status: string;
    date: string;
  }[];
  expenses: Expense[];
}
