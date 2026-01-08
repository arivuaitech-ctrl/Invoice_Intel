
import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  BarChart, Bar, Tooltip, ResponsiveContainer, Cell, PieChart, Pie 
} from 'recharts';
import { 
  Search, Download, Trash2, Plus, Edit2, AlertTriangle, 
  Calendar, Filter, PieChart as PieChartIcon, List, Settings, LogOut, Sparkles, Crown, CreditCard,
  RefreshCw
} from 'lucide-react';

import { ExpenseItem, Stats, SortField, SortOrder, ExpenseCategory, BudgetMap, UserProfile } from './types';
import { db } from './services/db';
import { extractInvoiceData } from './services/geminiService';
import { userService } from './services/userService';
import { stripeService } from './services/stripeService';
import { supabase } from './services/supabaseClient';

import FileUpload from './components/FileUpload';
import Button from './components/Button';
import ExpenseModal from './components/ExpenseModal';
import AnalyticsView from './components/AnalyticsView';
import BudgetModal from './components/BudgetModal';
import LoginPage from './components/LoginPage';
import PricingModal from './components/PricingModal';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];

type ViewType = 'expenses' | 'analytics';

const formatDate = (rawDate: string) => {
  if (!rawDate) return new Date().toISOString().split('T')[0];
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (regex.test(rawDate)) return rawDate;
  const d = new Date(rawDate);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return rawDate;
};

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [budgets, setBudgets] = useState<BudgetMap>({} as BudgetMap);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [view, setView] = useState<ViewType>('expenses');
  const [progressStatus, setProgressStatus] = useState<string>('');
  const [isBillingLoading, setIsBillingLoading] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ExpenseItem | undefined>(undefined);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        try {
          const profile = await userService.upsertProfile(session.user);
          setUser(profile);
          const data = await db.getAll(session.user.id);
          setExpenses(data);
        } catch (err: any) {
          console.error("Auth Change Error:", err);
          setUser(null);
        }
      } else {
        setUser(null);
        setExpenses([]);
        setView('expenses');
      }
      setLoading(false);
    });

    setBudgets(db.getBudgets());
    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await userService.login();
    } catch (err: any) {
      console.error("Login trigger failed:", err);
    }
  };

  const handleLogout = async () => {
    try {
      setUser(null);
      setExpenses([]);
      setView('expenses');
      await userService.logout();
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const handleManageBilling = async () => {
    if (!user?.stripeCustomerId) {
      alert("Billing info not found. If you just subscribed, please refresh the page in a few minutes.");
      return;
    }
    setIsBillingLoading(true);
    try {
      await stripeService.redirectToCustomerPortal(user.stripeCustomerId);
    } finally {
      setIsBillingLoading(false);
    }
  };

  const handleUserUpdate = (updatedUser: UserProfile) => {
    setUser(updatedUser);
  };

  const refreshExpenses = async () => {
    if (user) {
      const data = await db.getAll(user.id);
      setExpenses(data);
    }
  };

  const checkBudgetWarning = (category: ExpenseCategory, amount: number) => {
    const limit = budgets[category];
    if (limit && limit > 0) {
      const currentTotal = expenses
        .filter(e => e.category === category)
        .reduce((sum, e) => sum + e.amount, 0);
      
      if (currentTotal + amount > limit) {
        setTimeout(() => {
             alert(`⚠️ Warning: Spending on ${category} exceeds limit of RM ${limit}.`);
        }, 500);
      }
    }
  };

  const handleFilesSelect = async (files: File[]) => {
    if (!user) return;
    const status = userService.canUpload(user, files.length);
    if (!status.allowed) {
        setIsPricingModalOpen(true);
        return;
    }

    setIsProcessing(true);
    let successCount = 0;
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgressStatus(`Processing ${i + 1} of ${files.length}: ${file.name}`);
        try {
            const data = await extractInvoiceData(file);
            const newExpense: ExpenseItem = {
                id: crypto.randomUUID(),
                vendorName: data.vendorName || 'Unknown Vendor',
                date: formatDate(data.date),
                amount: Number(data.amount) || 0,
                currency: 'RM', 
                category: data.category as ExpenseCategory || ExpenseCategory.OTHERS,
                summary: data.summary || '',
                createdAt: Date.now(),
                fileName: file.name,
            };
            await db.add(newExpense, user.id);
            checkBudgetWarning(newExpense.category, newExpense.amount);
            successCount++;
        } catch (error: any) {
            console.error(`Failed to process ${file.name}`, error);
        }
    }

    if (successCount > 0) {
        const updatedUser = await userService.recordUsage(user, successCount);
        setUser(updatedUser);
        await refreshExpenses();
    }
    setIsProcessing(false);
    setProgressStatus('');
  };

  const handleSaveExpense = async (item: ExpenseItem) => {
    if (!user) return;
    const oldExpenses = [...expenses];
    const cleanedItem = { ...item, date: formatDate(item.date) };
    
    if (expenses.some(e => e.id === item.id)) {
      setExpenses(prev => prev.map(e => e.id === item.id ? cleanedItem : e));
    } else {
      setExpenses(prev => [cleanedItem, ...prev]);
    }

    try {
        if (oldExpenses.some(e => e.id === item.id)) {
          await db.update(cleanedItem, user.id);
        } else {
          await db.add(cleanedItem, user.id);
          checkBudgetWarning(item.category, item.amount);
        }
        await refreshExpenses();
    } catch (e: any) {
      console.error("Save failed:", e);
      setExpenses(oldExpenses);
      alert("Failed to save.");
    }
  };

  const handleSaveBudgets = (newBudgets: BudgetMap) => {
    db.saveBudgets(newBudgets);
    setBudgets(newBudgets);
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    if (window.confirm("Are you sure you want to delete this expense?")) {
      const oldExpenses = [...expenses];
      setExpenses(prev => prev.filter(e => e.id !== id));
      try {
        await db.delete(id, user.id);
      } catch (err) {
        console.error("Delete failed:", err);
        setExpenses(oldExpenses);
        alert("Could not delete item.");
      }
    }
  };

  const handleClearAll = async () => {
    if (user && window.confirm("Are you sure you want to delete ALL data?")) {
      await db.clearAll(user.id);
      setExpenses([]);
    }
  };

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(expenses.map(({id, createdAt, imageData, ...rest}) => rest));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Expenses");
    XLSX.writeFile(wb, `InvoiceIntel_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const filteredExpenses = useMemo(() => {
    return expenses
      .filter(item => {
        const vendor = item.vendorName || '';
        const summary = item.summary || '';
        const matchesSearch = vendor.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              summary.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [expenses, searchTerm, selectedCategory, sortField, sortOrder]);

  const stats = useMemo<Stats>(() => {
    const totalAmount = filteredExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const catMap = new Map<string, number>();
    filteredExpenses.forEach(item => {
      catMap.set(item.category, (catMap.get(item.category) || 0) + (Number(item.amount) || 0));
    });
    const categoryBreakdown = Array.from(catMap.entries()).map(([name, value]) => ({ name, value }));
    return { totalAmount, count: filteredExpenses.length, categoryBreakdown };
  }, [filteredExpenses]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
       <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>
  );

  if (!user) {
      return <LoginPage onLogin={handleLogin} />;
  }

  const badgeInfo = () => {
      if (user.isTrialActive) return { text: `Trial: ${10 - user.docsUsedThisMonth} left`, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      if (user.planId === 'free') return { text: 'Expired', color: 'bg-red-50 text-red-700 border-red-200' };
      const remaining = user.monthlyDocsLimit - user.docsUsedThisMonth;
      return { text: `${user.planId.toUpperCase()}: ${remaining} left`, color: remaining < 5 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200' };
  };
  const badge = badgeInfo();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xs">RM</span>
              </div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">InvoiceIntel</h1>
            </div>
            
            <div className="hidden md:flex bg-slate-100 p-1 rounded-lg">
                <button onClick={() => setView('expenses')} className={`flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-all ${view === 'expenses' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}><List className="w-4 h-4 mr-2" />Expenses</button>
                <button onClick={() => setView('analytics')} className={`flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-all ${view === 'analytics' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}><PieChartIcon className="w-4 h-4 mr-2" />Analytics</button>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={() => setIsPricingModalOpen(true)} className={`flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border ${badge.color}`}>
                  {user.isTrialActive ? <Sparkles className="w-3 h-3 mr-1.5" /> : <Crown className="w-3 h-3 mr-1.5" />}
                  {badge.text}
              </button>
              
              <div className="flex items-center gap-2 border-l pl-3">
                  {user.stripeCustomerId && (
                    <button 
                      onClick={handleManageBilling}
                      disabled={isBillingLoading}
                      className="flex items-center justify-center text-slate-500 hover:text-indigo-600 p-2 rounded-xl hover:bg-indigo-50 transition-all"
                      title="Manage Subscription"
                    >
                      {isBillingLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
                    </button>
                  )}
                  <button 
                    onClick={handleLogout} 
                    className="flex items-center justify-center text-slate-400 hover:text-red-600 p-2 rounded-xl hover:bg-red-50 transition-all" 
                    title="Logout"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {user.isTrialActive && (
          <div className="bg-indigo-600 text-white text-xs text-center py-2">
              Free Trial: <strong>{10 - user.docsUsedThisMonth} documents</strong> left. <button onClick={() => setIsPricingModalOpen(true)} className="underline ml-1">Upgrade</button>
          </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {view === 'expenses' ? (
        <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Plus className="w-5 h-5 text-indigo-500" />Add Invoices</h2>
                    <FileUpload onFilesSelect={handleFilesSelect} isProcessing={isProcessing} isDisabled={!userService.canUpload(user, 1).allowed} />
                    {progressStatus && <div className="mt-4 p-3 bg-indigo-50 text-indigo-700 rounded-lg text-sm text-center animate-pulse">{progressStatus}</div>}
                    <div className="mt-4 pt-4 border-t text-center"><button onClick={() => setIsModalOpen(true)} className="text-sm text-indigo-600 hover:underline">Or enter manually</button></div>
                </div>
            </div>
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Expenses</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">RM {stats.totalAmount.toFixed(2)}</p>
                    <div className="h-24 mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.categoryBreakdown}><Bar dataKey="value">{stats.categoryBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Bar></BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Top Category</p>
                    <p className="text-xl font-bold text-slate-900 mt-1">{stats.categoryBreakdown[0]?.name || 'N/A'}</p>
                    <div className="h-24 mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart><Pie data={stats.categoryBreakdown} dataKey="value" innerRadius={20} outerRadius={35}>{stats.categoryBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie></PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="p-4 border-b flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/50">
                    <div className="relative w-full sm:w-96">
                        <input type="text" className="w-full pl-10 pr-3 py-2 border rounded-lg text-sm" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                    <div className="flex gap-2">
                         <Button variant="secondary" onClick={() => setIsBudgetModalOpen(true)} icon={<Settings className="w-4 h-4"/>}>Budget</Button>
                         <Button variant="secondary" onClick={handleExport} icon={<Download className="w-4 h-4"/>}>Export</Button>
                         <Button variant="danger" onClick={handleClearAll} icon={<Trash2 className="w-4 h-4"/>}>Clear</Button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Vendor</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Category</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Amount</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {filteredExpenses.map((expense) => (
                        <tr key={expense.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium">{expense.date}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-900">{expense.vendorName}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm"><span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-600 border border-indigo-100">{expense.category}</span></td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono font-bold text-slate-900">
                              RM {(Number(expense.amount) || 0).toFixed(2)}
                            </td>
                            <td className="px-6 py-4 text-right text-sm font-medium">
                                <button onClick={() => { setEditingItem(expense); setIsModalOpen(true); }} className="text-indigo-600 hover:text-indigo-800 p-1.5 transition-colors"><Edit2 className="w-4 h-4" /></button>
                                <button onClick={() => handleDelete(expense.id)} className="text-red-500 hover:text-red-700 p-1.5 transition-colors ml-1"><Trash2 className="w-4 h-4" /></button>
                            </td>
                        </tr>
                        ))}
                    </tbody>
                    </table>
                </div>
            </div>
        </>
        ) : (
            <AnalyticsView expenses={expenses} budgets={budgets} />
        )}
      </main>

      <ExpenseModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingItem(undefined); }} onSave={handleSaveExpense} initialData={editingItem} />
      <BudgetModal isOpen={isBudgetModalOpen} onClose={() => setIsBudgetModalOpen(false)} budgets={budgets} onSave={handleSaveBudgets} />
      <PricingModal isOpen={isPricingModalOpen} onClose={() => setIsPricingModalOpen(false)} user={user} onSuccess={handleUserUpdate} />
    </div>
  );
}
