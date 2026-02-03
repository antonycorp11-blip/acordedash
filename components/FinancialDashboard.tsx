
import React, { useState, useEffect, useMemo } from 'react';
import { Expense, Teacher } from '../types';
import { emusysService } from '../services/emusysService';

interface Props {
    expenses: Expense[];
    onUpdateExpenses: (expenses: Expense[]) => void;
    teachers: Teacher[];
}


const FinancialDashboard: React.FC<Props> = ({ expenses, onUpdateExpenses, teachers }) => {
    const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
    const [receivables, setReceivables] = useState<any[]>([]);
    const [teacherPayments, setTeacherPayments] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showManualModal, setShowManualModal] = useState(false);
    const [manualValue, setManualValue] = useState<string>('');

    // Valor manual que persiste por mês
    const [manualReceivable, setManualReceivable] = useState<number>(() => {
        const saved = localStorage.getItem(`ca_manual_rec_${selectedMonth}`);
        return saved ? Number(saved) : 0;
    });

    const [newExpense, setNewExpense] = useState<Partial<Expense>>({
        category: 'Estrutura',
        type: 'fixed',
        amount: 0,
        description: '',
        startDate: selectedMonth
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const [rec, payments] = await Promise.all([
                emusysService.fetchReceivables(selectedMonth),
                emusysService.fetchTeacherPayments(selectedMonth)
            ]);
            setReceivables(rec);
            setTeacherPayments(payments);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const saved = localStorage.getItem(`ca_manual_rec_${selectedMonth}`);
        setManualReceivable(saved ? Number(saved) : 0);
    }, [selectedMonth]);

    const handleSaveManual = () => {
        const val = Number(manualValue.replace(',', '.'));
        setManualReceivable(val);
        localStorage.setItem(`ca_manual_rec_${selectedMonth}`, val.toString());
        setShowManualModal(false);
    };

    const monthlyExpenses = useMemo(() => {
        return expenses.filter(exp => {
            if (exp.type === 'fixed') {
                return exp.startDate <= selectedMonth;
            } else if (exp.type === 'installment') {
                const [startYear, startMonth] = exp.startDate.split('-').map(Number);
                const [currYear, currMonth] = selectedMonth.split('-').map(Number);
                const monthsDiff = (currYear - startYear) * 12 + (currMonth - startMonth);
                return monthsDiff >= 0 && monthsDiff < (exp.installments || 1);
            } else {
                // 'single'
                return exp.startDate === selectedMonth;
            }
        });
    }, [expenses, selectedMonth]);

    const totals = useMemo(() => {
        const apiTotal = receivables.reduce((acc, curr) => acc + (curr.valor || 0), 0);
        const totalReceivable = apiTotal > 0 ? apiTotal : manualReceivable;
        const totalTeacherPayments = teacherPayments.reduce((acc, curr) => acc + (curr.valor_liquido || 0), 0);

        const catTotals = {
            'Estrutura': monthlyExpenses.filter(e => e.category === 'Estrutura').reduce((a, b) => a + b.amount, 0),
            'Pessoal': monthlyExpenses.filter(e => e.category === 'Pessoal').reduce((a, b) => a + b.amount, 0) + totalTeacherPayments,
            'Investimentos/Dividas': monthlyExpenses.filter(e => e.category === 'Investimentos/Dividas').reduce((a, b) => a + b.amount, 0),
            'Impostos': monthlyExpenses.filter(e => e.category === 'Impostos').reduce((a, b) => a + b.amount, 0),
        };

        const totalExpense = Object.values(catTotals).reduce((a, b) => a + b, 0);
        return { totalReceivable, catTotals, totalExpense };
    }, [receivables, teacherPayments, monthlyExpenses, manualReceivable]);

    const handleAddExpense = (closeModal: boolean = true) => {
        if (!newExpense.description || !newExpense.amount) return;
        const expense: Expense = {
            id: crypto.randomUUID(),
            description: newExpense.description || '',
            amount: Number(newExpense.amount),
            category: newExpense.category as any,
            type: newExpense.type as any,
            installments: newExpense.type === 'installment' ? Number(newExpense.installments) : undefined,
            startDate: newExpense.startDate || selectedMonth,
        };
        onUpdateExpenses([...expenses, expense]);

        if (closeModal) {
            setShowAddModal(false);
            setNewExpense({ category: 'Estrutura', type: 'fixed', amount: 0, description: '', startDate: selectedMonth });
        } else {
            // Keep category, reset other fields for next entry
            setNewExpense({
                ...newExpense,
                description: '',
                amount: 0,
            });
        }
    };

    const handleDeleteExpense = (id: string) => {
        if (confirm('Deseja excluir esta despesa?')) {
            onUpdateExpenses(expenses.filter(e => e.id !== id));
        }
    };

    const categoryIcons: Record<string, string> = {
        'Estrutura': '🏢',
        'Pessoal': '👥',
        'Investimentos/Dividas': '📈',
        'Impostos': '🏛️'
    };

    return (
        <div className="space-y-10 animate-slide pb-24 max-w-[1400px] mx-auto p-6">
            <header className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                    <h2 className="text-3xl font-black text-studio-black dark:text-studio-beige uppercase tracking-tight">Dashboard Financeiro</h2>
                    <p className="text-xs font-bold text-studio-brown/40 uppercase tracking-widest mt-1">Gestão de Receitas e Despesas</p>
                </div>

                <div className="flex items-center gap-4 bg-white/50 dark:bg-studio-brown/20 p-2 rounded-[2rem] border border-studio-brown/10 backdrop-blur-md">
                    <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="bg-transparent border-none outline-none font-black text-studio-orange uppercase tracking-widest text-xs p-2 no-scrollbar"
                    />
                    <button
                        onClick={() => fetchData()}
                        className="p-3 bg-studio-orange text-white rounded-full hover:scale-110 active:scale-90 transition-all shadow-lg"
                    >
                        <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    </button>
                </div>
            </header>

            {/* Main Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div
                    onClick={() => {
                        setManualValue(totals.totalReceivable.toString());
                        setShowManualModal(true);
                    }}
                    className="card-bg p-8 rounded-[3rem] shadow-sm border-b-4 border-emerald-500 cursor-pointer hover:scale-[1.02] transition-all group"
                >
                    <div className="flex justify-between items-start">
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block mb-2">Total a Receber</span>
                        <svg className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-xs font-bold text-studio-brown/40 uppercase">R$</span>
                        <span className="text-4xl font-black text-studio-black dark:text-studio-beige">{totals.totalReceivable.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    {manualReceivable > 0 && receivables.length === 0 && (
                        <span className="text-[8px] font-bold text-emerald-500 uppercase mt-2 block">Ajuste Manual</span>
                    )}
                </div>
                <div className="card-bg p-8 rounded-[3rem] shadow-sm border-b-4 border-red-500">
                    <span className="text-[10px] font-black text-red-600 uppercase tracking-widest block mb-2">Total Despesas</span>
                    <div className="flex items-baseline gap-1">
                        <span className="text-xs font-bold text-studio-brown/40 uppercase">R$</span>
                        <span className="text-4xl font-black text-studio-black dark:text-studio-beige">{totals.totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                </div>
                <div className={`card-bg p-8 rounded-[3rem] shadow-sm border-b-4 ${totals.totalReceivable - totals.totalExpense >= 0 ? 'border-emerald-500' : 'border-red-500'}`}>
                    <span className="text-[10px] font-black uppercase tracking-widest block mb-2 opacity-40">Saldo (DRE)</span>
                    <div className="flex items-baseline gap-1">
                        <span className="text-xs font-bold text-studio-brown/40 uppercase">R$</span>
                        <span className="text-4xl font-black text-studio-black dark:text-studio-beige">{(totals.totalReceivable - totals.totalExpense).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                </div>
                <div className="bg-studio-black p-8 rounded-[3rem] text-white shadow-xl relative overflow-hidden flex flex-col justify-center">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Margem de Lucro</span>
                    <div className="text-4xl font-black text-studio-orange">
                        {totals.totalReceivable > 0 ? Math.round(((totals.totalReceivable - totals.totalExpense) / totals.totalReceivable) * 100) : 0}%
                    </div>
                    <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-studio-orange/10 rounded-full blur-2xl"></div>
                </div>
            </div>

            {/* Expense Categories Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {(['Estrutura', 'Pessoal', 'Investimentos/Dividas', 'Impostos'] as const).map(cat => {
                    const catTotal = totals.catTotals[cat];
                    const percent = totals.totalReceivable > 0 ? Math.round((catTotal / totals.totalReceivable) * 100) : 0;

                    return (
                        <div key={cat} className="card-bg p-8 rounded-[3rem] shadow-sm space-y-6">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="text-lg font-black uppercase tracking-tight">{cat}</h4>
                                    <div className="text-[10px] font-bold text-studio-brown/40 uppercase tracking-widest">Peso Sobre Receita</div>
                                </div>
                                <div className="text-2xl font-black text-studio-orange">{percent}%</div>
                            </div>

                            <div className="h-2 bg-studio-sand dark:bg-studio-brown/20 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-studio-orange rounded-full transition-all duration-1000"
                                    style={{ width: `${Math.min(100, percent)}%` }}
                                ></div>
                            </div>

                            <div className="space-y-3 pt-2">
                                <div className="flex justify-between items-center text-xs font-black uppercase">
                                    <span className="opacity-40 tracking-widest">Lançamentos</span>
                                    <span className="text-studio-orange">R$ {catTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>

                                <div className="max-h-48 overflow-y-auto no-scrollbar space-y-2">
                                    {monthlyExpenses.filter(e => e.category === cat).map(e => (
                                        <div key={e.id} className="flex justify-between items-center bg-studio-sand/20 dark:bg-studio-brown/10 p-4 rounded-2xl group">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black text-studio-black dark:text-studio-beige uppercase">{e.description}</span>
                                                <span className="text-[9px] font-bold opacity-30 uppercase">
                                                    {e.type === 'fixed' ? 'Mensal Fixo' : (e.type === 'installment' ? `Parcelado (${e.installments}x)` : 'Mês Único')}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="text-xs font-black text-studio-black dark:text-studio-beige">R$ {e.amount.toLocaleString('pt-BR')}</span>
                                                <button
                                                    onClick={() => handleDeleteExpense(e.id)}
                                                    className="opacity-0 group-hover:opacity-100 p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-all"
                                                >
                                                    &times;
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {cat === 'Pessoal' && teacherPayments.length > 0 && (
                                        <div className="bg-studio-orange/5 border border-studio-orange/10 p-4 rounded-2xl">
                                            <div className="flex justify-between items-center">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-black text-studio-orange uppercase">Folha de Professores</span>
                                                    <span className="text-[9px] font-bold opacity-60 uppercase">Importado do Emusys</span>
                                                </div>
                                                <span className="text-xs font-black text-studio-orange">R$ {teacherPayments.reduce((a, b) => a + (b.valor_liquido || 0), 0).toLocaleString('pt-BR')}</span>
                                            </div>
                                        </div>
                                    )}
                                    {monthlyExpenses.filter(e => e.category === cat).length === 0 && cat !== 'Pessoal' && (
                                        <div className="py-8 text-center opacity-20 text-[10px] font-black uppercase tracking-widest italic">Sem lançamentos</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Floating Add Button */}
            <button
                onClick={() => setShowAddModal(true)}
                className="fixed bottom-10 right-10 w-16 h-16 bg-studio-orange text-white rounded-full shadow-2xl shadow-studio-orange/40 flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40 group"
            >
                <svg className="w-8 h-8 group-hover:rotate-90 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
            </button>

            {/* Modal Manual Receivable */}
            {showManualModal && (
                <div className="fixed inset-0 z-[600] flex items-center justify-center bg-studio-black/80 backdrop-blur-md p-6">
                    <div className="card-bg rounded-[3rem] w-full max-w-sm overflow-hidden shadow-2xl border border-studio-brown/10 animate-slide">
                        <div className="p-8 bg-emerald-500 text-white flex justify-between items-center">
                            <h3 className="text-xl font-black uppercase tracking-tight">Ajuste de Receita</h3>
                            <button onClick={() => setShowManualModal(false)} className="font-bold text-2xl">&times;</button>
                        </div>
                        <div className="p-8 space-y-4">
                            <p className="text-[10px] font-black uppercase opacity-40 leading-relaxed">
                                Insira o valor total previsto do Emusys para este mês. Este valor será usado caso a integração falhe.
                            </p>
                            <div className="relative">
                                <span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-studio-brown/40">R$</span>
                                <input
                                    type="text"
                                    autoFocus
                                    value={manualValue}
                                    onChange={e => setManualValue(e.target.value)}
                                    className="w-full bg-studio-sand/30 dark:bg-studio-brown/20 p-5 pl-12 rounded-2xl border border-studio-brown/5 outline-none font-black text-xl text-studio-black dark:text-studio-beige focus:border-emerald-500 transition-all"
                                />
                            </div>
                            <button
                                onClick={handleSaveManual}
                                className="w-full py-5 bg-emerald-500 text-white rounded-[2rem] font-black uppercase tracking-widest shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
                            >Confirmar Valor</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Add Expense */}
            {showAddModal && (
                <div className="fixed inset-0 z-[500] flex items-center justify-center bg-studio-black/80 backdrop-blur-md p-6 overflow-y-auto">
                    <div className="card-bg rounded-[3rem] w-full max-w-2xl overflow-hidden shadow-2xl border border-studio-brown/10 my-8 animate-slide">
                        <div className="p-8 border-b border-studio-brown/5 bg-studio-orange text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-2xl font-black uppercase tracking-tight">Novo Lançamento</h3>
                                <p className="text-[10px] font-black opacity-80 uppercase tracking-widest">Cadastro rápido de saídas</p>
                            </div>
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-all font-bold text-2xl"
                            >&times;</button>
                        </div>

                        <div className="p-10 space-y-8">
                            {/* Categoria por Cards */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Selecione a Categoria</label>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {(['Estrutura', 'Pessoal', 'Investimentos/Dividas', 'Impostos'] as const).map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => setNewExpense({ ...newExpense, category: cat })}
                                            className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${newExpense.category === cat ? 'border-studio-orange bg-studio-orange/5' : 'border-studio-brown/5 opacity-50 bg-white/50'}`}
                                        >
                                            <span className="text-2xl">{categoryIcons[cat]}</span>
                                            <span className="text-[8px] font-black uppercase tracking-tighter text-center">{cat}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Descrição da Despesa</label>
                                <input
                                    type="text"
                                    autoFocus
                                    value={newExpense.description}
                                    onChange={e => setNewExpense({ ...newExpense, description: e.target.value })}
                                    placeholder="Ex: Conta de Luz, Marketing mensal..."
                                    className="w-full bg-studio-sand/30 dark:bg-studio-brown/20 p-5 rounded-2xl border border-studio-brown/5 outline-none font-bold text-sm text-studio-black dark:text-studio-beige focus:border-studio-orange transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Valor (R$)</label>
                                    <div className="relative">
                                        <span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-studio-brown/40">R$</span>
                                        <input
                                            type="number"
                                            value={newExpense.amount || ''}
                                            onChange={e => setNewExpense({ ...newExpense, amount: Number(e.target.value) })}
                                            className="w-full bg-studio-sand/30 dark:bg-studio-brown/20 p-5 pl-12 rounded-2xl border border-studio-brown/5 outline-none font-bold text-sm text-studio-black dark:text-studio-beige focus:border-studio-orange transition-all"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Recorrência</label>
                                    <div className="flex bg-studio-sand/30 dark:bg-studio-brown/20 p-1.5 rounded-2xl border border-studio-brown/5">
                                        <button
                                            onClick={() => setNewExpense({ ...newExpense, type: 'single' })}
                                            className={`flex-1 py-3 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${newExpense.type === 'single' ? 'bg-studio-orange text-white shadow-lg' : 'opacity-40'}`}
                                        >Mês Único</button>
                                        <button
                                            onClick={() => setNewExpense({ ...newExpense, type: 'fixed' })}
                                            className={`flex-1 py-3 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${newExpense.type === 'fixed' ? 'bg-studio-orange text-white shadow-lg' : 'opacity-40'}`}
                                        >Mensal Fixo</button>
                                        <button
                                            onClick={() => setNewExpense({ ...newExpense, type: 'installment' })}
                                            className={`flex-1 py-3 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${newExpense.type === 'installment' ? 'bg-studio-orange text-white shadow-lg' : 'opacity-40'}`}
                                        >Parcelas</button>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Habilitar Para</label>
                                    <input
                                        type="month"
                                        value={newExpense.startDate}
                                        onChange={e => setNewExpense({ ...newExpense, startDate: e.target.value })}
                                        className="w-full bg-studio-sand/30 dark:bg-studio-brown/20 p-5 rounded-2xl border border-studio-brown/5 outline-none font-black text-[10px] text-studio-black dark:text-studio-beige no-scrollbar"
                                    />
                                </div>
                                {newExpense.type === 'installment' && (
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Número de Meses</label>
                                        <input
                                            type="number"
                                            value={newExpense.installments || ''}
                                            onChange={e => setNewExpense({ ...newExpense, installments: Number(e.target.value) })}
                                            className="w-full bg-studio-sand/30 dark:bg-studio-brown/20 p-5 rounded-2xl border border-studio-brown/5 outline-none font-bold text-sm text-studio-black dark:text-studio-beige focus:border-studio-orange transition-all"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    onClick={() => handleAddExpense(false)}
                                    className="flex-1 py-6 bg-studio-black text-white rounded-[2.5rem] font-black uppercase tracking-widest text-[10px] hover:scale-[1.02] active:scale-[0.98] transition-all opacity-80"
                                >Salvar e + Adicionar</button>
                                <button
                                    onClick={() => handleAddExpense(true)}
                                    className="flex-[1.5] py-6 bg-studio-orange text-white rounded-[2.5rem] font-black uppercase tracking-[0.2em] shadow-2xl shadow-studio-orange/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
                                >Salvar e Concluir</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FinancialDashboard;
