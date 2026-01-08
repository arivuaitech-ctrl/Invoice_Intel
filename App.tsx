import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  BarChart, Bar, Tooltip, ResponsiveContainer, Cell, PieChart, Pie 
} from 'recharts';
import { 
  Search, Download, Trash2, Plus, Edit2, AlertTriangle, 
  PieChart as PieChartIcon, List, Settings, LogOut, Sparkles, Crown, CreditCard,
  RefreshCw, CheckCircle2, X, Loader2, ShieldAlert
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
  const [paymentStatus, setPaymentStatus] = useState<'success' | 'cancelled' | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ExpenseItem | undefined>(undefined);

  const pollIntervalRef = useRef<number | null>(null);

  // Gemini API Key check - Non-blocking UI banner
  const isGeminiKeyMissing = !process.env.API_KEY;

  // Handle URL cleanup and payment success detection
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    
    if (payment === 'success') {
      setPaymentStatus('success');
      setIsSyncing(true);
      setTimeout(() => {
        window.history.replaceState({}, document.title, window.location.pathname);
      }, 5000);
    } else if (payment === 'cancelled') {
      setPaymentStatus('cancelled');
      setTimeout(() => {
        window.history.replaceState({}, document.title, window.location.pathname);
      }, 3000);
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        try {
          const profile = await userService.upsertProfile(session.user);
          setUser(profile);
          const data = await db.getAll(session.user.id);
          setExpenses(data);

          if (paymentStatus === 'success' || (profile.monthlyDocsLimit === 0 && profile.planId === 'free')) {
             setIsSyncing(true);
             if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
             pollIntervalRef.current = window.setInterval(async () => {
                const refreshed = await userService.getProfile(session.user.id);
                if (refreshed && (refreshed.planId !== 'free' || refreshed.monthlyDocsLimit > 0)) {
                    setUser(refreshed);
                    setIsSyncing(false);
                    setPaymentStatus('success');
                    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                }
             }, 2000);
             setTimeout(() => {
                 if (pollIntervalRef.current) {
                     clearInterval(pollIntervalRef.current);
                     setIsSyncing(false);
                 }
             }, 120000);
          }
        } catch (err: any) {
          console.error("Auth Init Error:", err);
        }
      } else {
        setUser(null);
        setExpenses([]);
      }
      setLoading(false);
    });

    setBudgets(db.getBudgets());
    return () => {
      subscription.unsubscribe();
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [paymentStatus]);

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
    categoryBreakdown.sort((a, b) => b.value - a.value);
    return { totalAmount, count: filteredExpenses.length, categoryBreakdown };
  }, [filteredExpenses]);

  async function refreshExpenses() {
    if (user) {
      const data = await db.getAll(user.id);
      setExpenses(data);
    }
  }

  function checkBudgetWarning(category: ExpenseCategory, amount: number) {
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
  }

  async function handleFilesSelect(files: File[]) {
    if (!user) return;
    if (isGeminiKeyMissing) {
        alert("AI Processing unavailable: GEMINI_API_KEY is missing. Please configure it in Netlify settings.");
        return;
    }
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
  }

  async function handleSaveExpense(item: ExpenseItem) {
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
  }

  function handleSaveBudgets(newBudgets: BudgetMap) {
    db.saveBudgets(newBudgets);
    setBudgets(newBudgets);
  }

  async function handleDelete(id: string) {
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
  }

  async function handleClearAll() {
    if (user && window.confirm("Are you sure you want to delete ALL data?")) {
      await db.clearAll(user.id);
      setExpenses([]);
    }
  }

  function handleExport() {
    const ws = XLSX.utils.json_to_sheet(expenses.map(({id, createdAt, imageData, ...rest}) => rest));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Expenses");
    XLSX.writeFile(wb, `InvoiceIntel_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  function handleUserUpdate(updatedUser: UserProfile) {
    setUser(updatedUser);
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
       <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-slate-500 text-sm font-medium animate-pulse tracking-wide">Initializing InvoiceIntel...</p>
       </div>
    </div>
  );

  if (!user) {
      return <LoginPage onLogin={() => userService.login()} />;
  }

  const badgeInfo = () => {
      if (user.isTrialActive) return { text: `Trial: ${user.monthlyDocsLimit - user.docsUsedThisMonth} left`, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      if (user.planId === 'free') return { text: 'Expired', color: 'bg-red-50 text-red-700 border-red-200' };
      const remaining = user.monthlyDocsLimit - user.docsUsedThisMonth;
      return { text: `${user.planId.toUpperCase()}: ${remaining} left`, color: remaining < 5 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200' };
  };
  const badge = badgeInfo();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* Configuration Status Banner */}
      {isGeminiKeyMissing && (
        <div className="bg-amber-500 text-white animate-slideDown shadow-md relative z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between text-xs font-bold">
                <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4" />
                    <span>AI EXTRACTION OFFLINE: Gemini API Key missing in Netlify. Manual entry still works.</span>
                </div>
                <button onClick={() => window.location.reload()} className="underline flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Retry
                </button>
            </div>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-indigo-100 shadow-lg">
                <span className="text-white font-bold text-xs">RM</span>
              </div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">InvoiceIntel</h1>
            </div>
            
            <div className="hidden md:flex bg-slate-100 p-1 rounded-lg">
                <button onClick={() => setView('expenses')} className={`flex items-center px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${view === 'expenses' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><List className="w-4 h-4 mr-2" />Expenses</button>
                <button onClick={() => setView('analytics')} className={`flex items-center px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${view === 'analytics' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><PieChartIcon className="w-4 h-4 mr-2" />Analytics</button>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={() => setIsPricingModalOpen(true)} className={`flex items-center px-3 py-1.5 rounded-full text-xs font-bold border transition-all hover:scale-105 active:scale-95 ${badge.color}`}>
                  {user.isTrialActive ? <Sparkles className="w-3 h-3 mr-1.5" /> : <Crown className="w-3 h-3 mr-1.5" />}
                  {badge.text}
              </button>
              
              <div className="flex items-center gap-2 border-l pl-3 ml-1">
                  {user.stripeCustomerId && (
                    <button 
                      onClick={() => stripeService.redirectToCustomerPortal(user.stripeCustomerId!)}
                      className="flex items-center justify-center text-slate-500 hover:text-indigo-600 p-2 rounded-xl hover:bg-indigo-50 transition-all group"
                      title="Manage Subscription"
                    >
                      <CreditCard className="w-5 h-5 group-hover:scale-110" />
                    </button>
                  )}
                  <button 
                    onClick={() => userService.logout().then(() => setUser(null))} 
                    className="flex items-center justify-center text-slate-400 hover:text-red-600 p-2 rounded-xl hover:bg-red-50 transition-all group" 
                    title="Logout"
                  >
                    <LogOut className="w-5 h-5 group-hover:translate-x-0.5" />
                  </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {isSyncing && (
        <div className="bg-indigo-600 text-white animate-pulse">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-center gap-3 text-sm font-medium">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Syncing account status... Please wait.</span>
            </div>
        </div>
      )}

      {paymentStatus === 'success' && !isSyncing && (
        <div className="bg-emerald-600 text-white animate-fadeIn">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Payment successful! Welcome to your new plan.</span>
                </div>
                <button onClick={() => setPaymentStatus(null)} className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10"><X className="w-4 h-4" /></button>
            </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {view === 'expenses' ? (
        <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Plus className="w-5 h-5 text-indigo-500" />Add Invoices</h2>
                    <FileUpload 
                      onFilesSelect={handleFilesSelect} 
                      isProcessing={isProcessing} 
                      isDisabled={!userService.canUpload(user, 1).allowed} 
                      disabledMessage={user.monthlyDocsLimit === 0 ? "Account Locked: Awaiting Sync" : undefined} 
                    />
                    {progressStatus && <div className="mt-4 p-3 bg-indigo-50 text-indigo-700 rounded-lg text-sm text-center font-medium border border-indigo-100 animate-pulse">{progressStatus}</div>}
                    <div className="mt-4 pt-4 border-t text-center"><button onClick={() => setIsModalOpen(true)} className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 underline-offset-4 hover:underline">Or enter manually</button></div>
                </div>
            </div>
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Expenses</p>
                    <p className="text-3xl font-black text-slate-900 mt-1">RM {stats.totalAmount.toFixed(2)}</p>
                    <div className="h-24 mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.categoryBreakdown}><Bar dataKey="value" radius={[4, 4, 0, 0]}>{stats.categoryBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Bar></BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Top Category</p>
                    <p className="text-xl font-black text-slate-900 mt-1">{stats.categoryBreakdown[0]?.name || 'N/A'}</p>
                    <div className="h-24 mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart><Pie data={stats.categoryBreakdown} dataKey="value" innerRadius={20} outerRadius={35} paddingAngle={2}>{stats.categoryBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie></PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/50">
                    <div className="relative w-full sm:w-96">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-slate-400" />
                        </div>
                        <input type="text" className="w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" placeholder="Search by vendor or notes..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                         <Button variant="secondary" className="flex-1 sm:flex-none" onClick={() => setIsBudgetModalOpen(true)} icon={<Settings className="w-4 h-4"/>}>Budget</Button>
                         <Button variant="secondary" className="flex-1 sm:flex-none" onClick={handleExport} icon={<Download className="w-4 h-4"/>}>Export</Button>
                         <Button variant="danger" className="flex-1 sm:flex-none" onClick={handleClearAll} icon={<Trash2 className="w-4 h-4"/>}>Clear</Button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Vendor</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Category</th>
                        <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                        <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                        {filteredExpenses.length > 0 ? filteredExpenses.map((expense) => (
                        <tr key={expense.id} className="hover:bg-slate-50/80 transition-colors group">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-medium">{expense.date}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">{expense.vendorName}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm"><span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-600 border border-indigo-100">{expense.category}</span></td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono font-black text-slate-900">
                              RM {(Number(expense.amount) || 0).toFixed(2)}
                            </td>
                            <td className="px-6 py-4 text-right text-sm font-medium">
                                <button onClick={() => { setEditingItem(expense); setIsModalOpen(true); }} className="text-slate-400 hover:text-indigo-600 p-2 transition-all rounded-lg hover:bg-indigo-50" title="Edit"><Edit2 className="w-4 h-4" /></button>
                                <button onClick={() => handleDelete(expense.id)} className="text-slate-400 hover:text-red-600 p-2 transition-all rounded-lg hover:bg-red-50 ml-1" title="Delete"><Trash2 className="w-4 h-4" /></button>
                            </td>
                        </tr>
                        )) : (
                          <tr>
                            <td colSpan={5} className="px-6 py-12 text-center">
                              <div className="flex flex-col items-center text-slate-400">
                                <Search className="w-8 h-8 mb-2 opacity-20" />
                                <p className="text-sm font-medium">No transactions found.</p>
                              </div>
                            </td>
                          </tr>
                        )}
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