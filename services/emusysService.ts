
import { Teacher, ScheduleSlot } from '../types';

const EMUSYS_API_URL = '/emusys-api/v1'; // Usando o proxy do Vite
const API_TOKEN = import.meta.env.VITE_EMUSYS_TOKEN;

export interface EmusysLesson {
    id: number;
    tipo: string;
    categoria: string;
    turma_nome: string;
    curso_nome: string;
    data_hora_inicio: string;
    data_hora_fim: string;
    professores: Array<{ nome: string; email?: string; }>;
    alunos: Array<{ nome_aluno: string; instrumento?: string; }>;
    cancelada: boolean;
}

export const emusysService = {
    async fetchLessons(startDate: string, endDate: string): Promise<EmusysLesson[]> {
        if (!API_TOKEN) {
            console.error('Emusys API Token missing');
            return [];
        }

        let allItems: EmusysLesson[] = [];
        let nextCursor: string | null = null;
        let hasMore = true;

        try {
            while (hasMore) {
                let url = `${EMUSYS_API_URL}/aulas?token=${API_TOKEN}&data_hora_inicial=${encodeURIComponent(startDate)}&data_hora_final=${encodeURIComponent(endDate)}`;
                if (nextCursor) url += `&cursor=${encodeURIComponent(nextCursor)}`;

                const response = await fetch(url, {
                    headers: {
                        'Accept': 'application/json'
                    }
                });

                if (!response.ok) {
                    const text = await response.text();
                    console.error(`Erro API Emusys (${response.status}):`, text.substring(0, 200));
                    throw new Error(`Erro API Aulas: ${response.status}`);
                }

                const data = await response.json();
                const items = data.items || [];
                allItems = [...allItems, ...items];

                nextCursor = data.paginacao?.proximo_cursor || null;
                hasMore = !!(data.paginacao?.tem_mais && nextCursor);

                if (allItems.length > 5000) break;
            }
            return allItems;
        } catch (err) {
            console.error('Falha na requisição Emusys:', err);
            throw err;
        }
    },

    async syncToAppData(startDate: string, endDate: string) {
        try {
            const lessons = await this.fetchLessons(startDate, endDate);
            const teachersMap = new Map<string, Teacher>();
            const scheduleSlots: ScheduleSlot[] = [];

            lessons.forEach(lesson => {
                if (lesson.cancelada) return;

                const teacherName = (lesson.professores[0]?.nome || 'DESCONHECIDO').toUpperCase().trim();
                let teacher = teachersMap.get(teacherName);

                if (!teacher) {
                    // Limpeza radical para ID estável: apenas letras A-Z maiúsculas
                    const cleanId = `t-${teacherName.replace(/[^A-Z]/g, '')}`;
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
                    teacherId: teacher.id,
                    dayOfWeek,
                    time,
                    studentName: (lesson.alunos[0]?.nome_aluno || 'SEM ALUNO').trim(),
                    instrument: (lesson.curso_nome || 'GERAL').trim(),
                    isExperimental: (lesson.categoria || '').toLowerCase().includes('experimental'),
                    date: datePart,
                    createdAt: Date.now()
                });
            });

            return {
                teachers: Array.from(teachersMap.values()),
                slots: scheduleSlots
            };
        } catch (err) {
            console.error('Erro ao sincronizar dados do Emusys:', err);
            return { teachers: [], slots: [] };
        }
    }
};
