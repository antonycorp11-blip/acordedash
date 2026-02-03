
import { Teacher, ScheduleSlot } from '../types';

const EMUSYS_API_URL = '/emusys-api/v1'; // Usando o proxy do Vite
const API_TOKEN = '4vb5JK9QS6YkhaA6JpIIxocrV3VuqU';

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
        let allItems: EmusysLesson[] = [];
        let nextCursor: string | null = null;
        let hasMore = true;
        try {
            while (hasMore) {
                let url = `${EMUSYS_API_URL}/aulas/?data_hora_inicial=${encodeURIComponent(startDate)}&data_hora_final=${encodeURIComponent(endDate)}`;
                if (nextCursor) url += `&cursor=${encodeURIComponent(nextCursor)}`;
                const response = await fetch(url, { headers: { 'token': API_TOKEN, 'Accept': 'application/json' } });
                if (!response.ok) throw new Error(`Erro API Aulas: ${response.status}`);
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
        const lessons = await this.fetchLessons(startDate, endDate);
        const teachersMap = new Map<string, Teacher>();
        const scheduleSlots: ScheduleSlot[] = [];
        lessons.forEach(lesson => {
            if (lesson.cancelada) return;
            const teacherName = (lesson.professores[0]?.nome || 'DESCONHECIDO').toUpperCase().trim();
            let teacher = teachersMap.get(teacherName);
            if (!teacher) {
                teacher = { id: `t-${teacherName}`, name: teacherName };
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
                isExperimental: lesson.categoria.toLowerCase().includes('experimental'),
                date: datePart,
                createdAt: Date.now()
            });
        });
        return { teachers: Array.from(teachersMap.values()), slots: scheduleSlots };
    },

    async fetchReceivables(monthStr: string) {
        try {
            const [year, month] = monthStr.split('-').map(Number);
            const lastDay = new Date(year, month, 0).getDate();
            const startDate = `${monthStr}-01`;
            const endDate = `${monthStr}-${lastDay}`;

            // 1. Validar se a conexão básica está funcionando e qual a resposta de um endpoint OK
            try {
                const testRes = await fetch(`${EMUSYS_API_URL}/aulas/?data_hora_inicial=${startDate} 00:00:00&data_hora_final=${startDate} 00:10:00`, {
                    headers: { 'token': API_TOKEN }
                });
                console.log('--- TESTE DE CONEXÃO ---');
                console.log('API v1/aulas Status:', testRes.status);
            } catch (e) { console.error('Token ou Proxy falhando'); }

            // MEGA VARREDURA: Tentando todas as variações conhecidas do Emusys
            const modules = [
                'titulo_receber', 'titulos_receber', 'contas_receber', 'faturas',
                'recebimentos', 'faturamento', 'financeiro/receber', 'titulos',
                'vendas', 'caixa', 'lancamentos_financeiros', 'receita', 'receber'
            ];

            // Tentamos com prefixo v1, sem prefixo v1, com / e sem /
            const versions = ['/v1/', '/'];

            for (const mod of modules) {
                for (const ver of versions) {
                    const baseUrl = ver === '/v1/' ? EMUSYS_API_URL : '/emusys-api';
                    const endpoint = mod.startsWith('financeiro') ? `/${mod}` : `/${mod}/`;

                    const url = `${baseUrl}${endpoint}?data_vencimento_inicial=${startDate}&data_vencimento_final=${endDate}`;

                    try {
                        const response = await fetch(url, { headers: { 'token': API_TOKEN } });
                        if (response.ok) {
                            const data = await response.json();
                            const items = data.items || [];
                            if (items.length > 0) {
                                console.log(`✅ ACHEI! Módulo: ${mod} via ${ver}`);
                                return items.map((i: any) => ({
                                    ...i,
                                    valor: Number(i.valor || i.vl_total || i.valor_total || i.valor_titulo || 0)
                                }));
                            }
                        } else if (response.status === 400 || response.status === 404) {
                            // Só logamos se não for 404 comum para não poluir demais
                            if (ver === '/v1/') console.log(`Tentando ${mod}... (Status ${response.status})`);
                        }
                    } catch (e) { }
                }
            }

            console.error('ERRO: Não conseguimos encontrar o endpoint financeiro. O Emusys retornou "Endpoint inválido" para todas as tentativas padrões.');
            return [];
        } catch (err) {
            console.error('Erro crítico:', err);
            return [];
        }
    },

    async fetchTeacherPayments(monthStr: string) {
        try {
            const [year, month] = monthStr.split('-').map(Number);
            const lastDay = new Date(year, month, 0).getDate();
            const startDate = `${monthStr}-01`;
            const endDate = `${monthStr}-${lastDay}`;

            const candidates = ['pagamentos_professores', 'pagamentos', 'extrato_professores', 'lancamentos'];
            for (const mod of candidates) {
                const url = `${EMUSYS_API_URL}/${mod}/?data_pagamento_inicial=${startDate}&data_pagamento_final=${endDate}`;
                try {
                    const response = await fetch(url, { headers: { 'token': API_TOKEN } });
                    if (response.ok) {
                        const data = await response.json();
                        const items = data.items || [];
                        if (items.length > 0) return items.map((i: any) => ({
                            ...i,
                            valor_liquido: Number(i.valor_liquido || i.valor || i.vl_total || i.valor_pago || 0)
                        }));
                    }
                } catch (e) { }
            }
            return [];
        } catch (err) { return []; }
    }
};
