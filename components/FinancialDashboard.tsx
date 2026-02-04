
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
        <div className="space-y-6 md:space-y-10 animate-slide pb-24 max-w-[1400px] mx-auto p-4 md:p-6 overflow-x-hidden">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-6">
                <div>
                    <h2 className="text-2xl md:text-3xl font-black text-studio-black dark:text-studio-beige uppercase tracking-tight">Financeiro</h2>
                    <p className="text-[9px] font-bold text-studio-brown/40 uppercase tracking-widest mt-0.5">Gestão de Receitas e Despesas</p>
                </div>

                <div className="flex items-center gap-3 bg-white/50 dark:bg-studio-brown/20 p-1.5 rounded-2xl border border-studio-brown/10 backdrop-blur-md w-full md:w-auto">
                    <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="flex-1 bg-transparent border-none outline-none font-black text-studio-orange uppercase tracking-widest text-[10px] p-2"
                    />
                    <button
                        onClick={() => fetchData()}
                        className="p-2.5 bg-studio-orange text-white rounded-xl shadow-lg active:scale-90 transition-all"
                    >
                        <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    </button>
                </div>
            </header>

            {/* Main Stats - Compact on Mobile */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                <div
                    onClick={() => {
                        setManualValue(totals.totalReceivable.toString());
                        setShowManualModal(true);
                    }}
                    className="card-bg p-4 md:p-8 rounded-3xl md:rounded-[3rem] shadow-sm border-b-4 border-emerald-500 cursor-pointer active:scale-95 transition-all"
                >
                    <span className="text-[8px] md:text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1 block">Receber</span>
                    <div className="flex items-baseline gap-0.5">
                        <span className="text-[9px] font-bold opacity-30">R$</span>
                        <span className="text-xl md:text-4xl font-black">{Math.round(totals.totalReceivable).toLocaleString('pt-BR')}</span>
                    </div>
                </div>

                <div className="card-bg p-4 md:p-8 rounded-3xl md:rounded-[3rem] shadow-sm border-b-4 border-red-500">
                    <span className="text-[8px] md:text-[10px] font-black text-red-600 uppercase tracking-widest mb-1 block">Despesas</span>
                    <div className="flex items-baseline gap-0.5">
                        <span className="text-[9px] font-bold opacity-30">R$</span>
                        <span className="text-xl md:text-4xl font-black">{Math.round(totals.totalExpense).toLocaleString('pt-BR')}</span>
                    </div>
                </div>

                <div className={`card-bg p-4 md:p-8 rounded-3xl md:rounded-[3rem] shadow-sm border-b-4 ${totals.totalReceivable - totals.totalExpense >= 0 ? 'border-emerald-500' : 'border-red-500'}`}>
                    <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest mb-1 block opacity-30">Saldo</span>
                    <div className="flex items-baseline gap-0.5">
                        <span className="text-[9px] font-bold opacity-30">R$</span>
                        <span className="text-xl md:text-4xl font-black">{Math.round(totals.totalReceivable - totals.totalExpense).toLocaleString('pt-BR')}</span>
                    </div>
                </div>

                <div className="bg-studio-black p-4 md:p-8 rounded-3xl md:rounded-[3rem] text-white shadow-xl flex flex-col justify-center">
                    <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Lucro</span>
                    <div className="text-xl md:text-4xl font-black text-studio-orange">
                        {totals.totalReceivable > 0 ? Math.round(((totals.totalReceivable - totals.totalExpense) / totals.totalReceivable) * 100) : 0}%
                    </div>
                </div>
            </div>

            {/* Expense Categories - Optimized for Mobile Scrolling */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                {(['Estrutura', 'Pessoal', 'Investimentos/Dividas', 'Impostos'] as const).map(cat => {
                    const catTotal = totals.catTotals[cat];
                    const percent = totals.totalReceivable > 0 ? Math.round((catTotal / totals.totalReceivable) * 100) : 0;

                    return (
                        <div key={cat} className="card-bg p-5 md:p-8 rounded-3xl md:rounded-[3rem] shadow-sm">
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <h4 className="text-sm md:text-lg font-black uppercase tracking-tight">{cat}</h4>
                                    <span className="text-[9px] font-black text-studio-orange uppercase">R$ {catTotal.toLocaleString('pt-BR')}</span>
                                </div>
                                <div className="text-lg md:text-2xl font-black opacity-20">{percent}%</div>
                            </div>

                            <div className="h-1.5 bg-studio-sand dark:bg-studio-brown/20 rounded-full overflow-hidden mb-5">
                                <div
                                    className="h-full bg-studio-orange rounded-full transition-all"
                                    style={{ width: `${Math.min(100, percent)}%` }}
                                ></div>
                            </div>

                            <div className="space-y-2 max-h-[300px] overflow-y-auto no-scrollbar">
                                {monthlyExpenses.filter(e => e.category === cat).map(e => (
                                    <div key={e.id} className="flex justify-between items-center bg-studio-sand/10 dark:bg-studio-brown/10 p-3 rounded-xl border border-studio-brown/5">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black uppercase">{e.description}</span>
                                            <span className="text-[7px] font-bold opacity-30 uppercase">{e.type === 'fixed' ? 'Mensal' : 'Único'}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black">R$ {e.amount}</span>
                                            <button onClick={() => handleDeleteExpense(e.id)} className="text-red-500 p-1">×</button>
                                        </div>
                                    </div>
                                ))}
                                {cat === 'Pessoal' && teacherPayments.length > 0 && (
                                    <div className="bg-studio-orange/5 border border-studio-orange/10 p-3 rounded-xl flex justify-between items-center">
                                        <span className="text-[10px] font-black text-studio-orange uppercase">Equipe (Emusys)</span>
                                        <span className="text-[10px] font-black text-studio-orange">R$ {teacherPayments.reduce((a, b) => a + (b.valor_liquido || 0), 0).toLocaleString('pt-BR')}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Add Button */}
            <button
                onClick={() => setShowAddModal(true)}
                className="fixed bottom-24 right-6 md:bottom-10 md:right-10 w-14 h-14 md:w-16 md:h-16 bg-studio-orange text-white rounded-full shadow-2xl flex items-center justify-center active:scale-95 transition-all z-40"
            >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
            </button>

            {/* Modal Manual Receivable */}
            {showManualModal && (
                <div className="fixed inset-0 z-[600] flex items-center justify-center bg-studio-black/80 backdrop-blur-md p-4">
                    <div className="card-bg rounded-3xl w-full max-w-sm overflow-hidden animate-slide">
                        <div className="p-6 bg-emerald-500 text-white flex justify-between items-center">
                            <h3 className="text-lg font-black uppercase">Ajuste de Receita</h3>
                            <button onClick={() => setShowManualModal(false)} className="text-xl">×</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <input
                                type="number"
                                autoFocus
                                value={manualValue}
                                onChange={e => setManualValue(e.target.value)}
                                className="w-full bg-studio-sand/10 p-4 rounded-xl border border-studio-brown/5 font-black text-xl outline-none"
                            />
                            <button
                                onClick={handleSaveManual}
                                className="w-full py-4 bg-emerald-500 text-white rounded-xl font-black uppercase text-xs"
                            >Salvar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Add Expense */}
            {showAddModal && (
                <div className="fixed inset-0 z-[500] flex items-center justify-center bg-studio-black/80 backdrop-blur-md p-4 overflow-y-auto">
                    <div className="card-bg rounded-3xl w-full max-w-lg overflow-hidden my-4 animate-slide">
                        <div className="p-6 bg-studio-orange text-white flex justify-between items-center">
                            <h3 className="text-lg font-black uppercase">Novo Gasto</h3>
                            <button onClick={() => setShowAddModal(false)} className="text-xl">×</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-4 gap-2">
                                {(['Estrutura', 'Pessoal', 'Investimentos/Dividas', 'Impostos'] as const).map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setNewExpense({ ...newExpense, category: cat })}
                                        className={`p-2 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${newExpense.category === cat ? 'border-studio-orange bg-studio-orange/5' : 'border-transparent opacity-40'}`}
                                    >
                                        <span className="text-xl">{categoryIcons[cat]}</span>
                                        <span className="text-[7px] font-black uppercase text-center">{cat}</span>
                                    </button>
                                ))}
                            </div>
                            <input
                                type="text"
                                placeholder="Descrição"
                                value={newExpense.description}
                                onChange={e => setNewExpense({ ...newExpense, description: e.target.value })}
                                className="w-full bg-studio-sand/10 p-4 rounded-xl border font-bold text-xs outline-none"
                            />
                            <input
                                type="number"
                                placeholder="Valor (R$)"
                                value={newExpense.amount || ''}
                                onChange={e => setNewExpense({ ...newExpense, amount: Number(e.target.value) })}
                                className="w-full bg-studio-sand/10 p-4 rounded-xl border font-bold text-xs outline-none"
                            />
                            <button
                                onClick={() => handleAddExpense(true)}
                                className="w-full py-4 bg-studio-orange text-white rounded-xl font-black uppercase text-xs shadow-lg"
                            >Cadastrar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FinancialDashboard;
