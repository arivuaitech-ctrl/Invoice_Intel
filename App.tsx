
import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  BarChart, Bar, Tooltip, ResponsiveContainer, Cell, PieChart, Pie 
} from 'recharts';
import { 
  Search, Download, Trash2, Plus, Edit2, AlertTriangle, 
  Calendar, Filter, PieChart as PieChartIcon, List, Settings, LogOut, Sparkles, Crown, CreditCard,
  RefreshCw, CheckCircle2, X, Loader2
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
  const [paymentStatus, setPaymentStatus] = useState<'success' | 'cancelled' | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ExpenseItem | undefined>(undefined);

  const pollIntervalRef = useRef<number | null>(null);

  // --- Fix: Added missing filteredExpenses and stats derived state ---
  const filteredExpenses = useMemo(() => {
    return expenses
      .filter((item) => {
        const matchesSearch =
          item.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.summary.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        const factor = sortOrder === 'asc' ? 1 : -1;
        if (sortField === 'amount') return (a.amount - b.amount) * factor;
        if (sortField === 'vendorName') return a.vendorName.localeCompare(b.vendorName) * factor;
        // Default sort by date
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return (dateA - dateB) * factor;
      });
  }, [expenses, searchTerm, selectedCategory, sortField, sortOrder]);

  const stats = useMemo<Stats>(() => {
    const totalAmount = expenses.reduce((sum, item) => sum + item.amount, 0);
    const categoryMap = new Map<string, number>();
    expenses.forEach((item) => {
      categoryMap.set(item.category, (categoryMap.get(item.category) || 0) + item.amount);
    });
    const categoryBreakdown = Array.from(categoryMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    return {
      totalAmount,
      count: expenses.length,
      categoryBreakdown,
    };
  }, [expenses]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      setPaymentStatus('success');
      setIsSyncing(true);
      setTimeout(() => {
        window.history.replaceState({}, document.title, window.location.pathname);
      }, 5000);
    }
  }, []);

  const manualRefreshProfile = async () => {
    if (!user) return;
    setIsSyncing(true);
    const refreshed = await userService.getProfile(user.id);
    if (refreshed) {
        setUser(refreshed);
        if (refreshed.planId !== 'free') {
            setIsSyncing(false);
            setPaymentStatus('success');
        } else {
            // If still free, wait a bit then auto-stop
            setTimeout(() => setIsSyncing(false), 2000);
        }
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => { if (loading) setLoading(false); }, 15000);

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
                    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                }
             }, 3000);
             setTimeout(() => { if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); setIsSyncing(false); } }, 60000);
          }
        } catch (err) { console.error(err); }
      } else {
        setUser(null);
        setExpenses([]);
      }
      setLoading(false);
    });

    setBudgets(db.getBudgets());
    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [paymentStatus]);

  const handleLogin = async () => { try { await userService.login(); } catch (err) { console.error(err); } };
  const handleLogout = async () => { setUser(null); setExpenses([]); await userService.logout(); };

  const handleManageBilling = async () => {
    if (!user?.stripeCustomerId) {
      alert("Billing info syncing. Try again in 1 minute.");
      return;
    }
    setIsBillingLoading(true);
    try { await stripeService.redirectToCustomerPortal(user.stripeCustomerId); } finally { setIsBillingLoading(false); }
  };

  const handleFilesSelect = async (files: File[]) => {
    if (!user) return;
    const status = userService.canUpload(user, files.length);
    if (!status.allowed) { setIsPricingModalOpen(true); return; }

    setIsProcessing(true);
    let successCount = 0;
    for (const file of files) {
        setProgressStatus(`Processing: ${file.name}`);
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
            successCount++;
        } catch (error) { console.error(error); }
    }
    if (successCount > 0) {
        const updatedUser = await userService.recordUsage(user, successCount);
        setUser(updatedUser);
        setExpenses(await db.getAll(user.id));
    }
    setIsProcessing(false);
    setProgressStatus('');
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
       <div className="flex flex-col items-center animate-pulse">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-slate-500 text-sm font-medium">Loading your profile...</p>
       </div>
    </div>
  );

  if (!user) return <LoginPage onLogin={handleLogin} />;

  const badge = user.isTrialActive 
    ? { text: `Trial: ${user.monthlyDocsLimit - user.docsUsedThisMonth} left`, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    : (user.planId === 'free' 
        ? { text: 'Expired', color: 'bg-red-50 text-red-700 border-red-200' }
        : { text: `${user.planId.toUpperCase()}: ${user.monthlyDocsLimit - user.docsUsedThisMonth} left`, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xs">RM</span>
              </div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">InvoiceIntel</h1>
            </div>
            
            <div className="hidden md:flex bg-slate-100 p-1 rounded-lg">
                <button onClick={() => setView('expenses')} className={`flex items-center px-4 py-1.5 text-sm font-semibold rounded-md ${view === 'expenses' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}><List className="w-4 h-4 mr-2" />Expenses</button>
                <button onClick={() => setView('analytics')} className={`flex items-center px-4 py-1.5 text-sm font-semibold rounded-md ${view === 'analytics' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}><PieChartIcon className="w-4 h-4 mr-2" />Analytics</button>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={() => setIsPricingModalOpen(true)} className={`flex items-center px-3 py-1.5 rounded-full text-xs font-bold border ${badge.color}`}>
                  {user.isTrialActive ? <Sparkles className="w-3 h-3 mr-1.5" /> : <Crown className="w-3 h-3 mr-1.5" />}
                  {badge.text}
              </button>
              
              <div className="flex items-center gap-2 border-l pl-3 ml-1">
                  {user.stripeCustomerId && (
                    <button onClick={handleManageBilling} disabled={isBillingLoading} className="text-slate-500 hover:text-indigo-600 p-2" title="Billing"><CreditCard className="w-5 h-5" /></button>
                  )}
                  <button onClick={handleLogout} className="text-slate-400 hover:text-red-600 p-2" title="Logout"><LogOut className="w-5 h-5" /></button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {isSyncing && (
        <div className="bg-indigo-600 text-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-center gap-3 text-sm font-medium">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Syncing your subscription... </span>
                <button onClick={manualRefreshProfile} className="underline text-xs bg-white/10 px-2 py-0.5 rounded">Check now</button>
            </div>
        </div>
      )}

      {paymentStatus === 'success' && !isSyncing && (
        <div className="bg-emerald-600 text-white animate-fadeIn">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="w-5 h-5" /><span>Success! Account upgraded.</span></div>
                <button onClick={() => setPaymentStatus(null)}><X className="w-4 h-4" /></button>
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
                        <FileUpload onFilesSelect={handleFilesSelect} isProcessing={isProcessing} isDisabled={!userService.canUpload(user, 1).allowed} disabledMessage={user.monthlyDocsLimit === 0 ? "Account Locked: Upgrade to continue" : undefined} />
                        {progressStatus && <div className="mt-4 p-3 bg-indigo-50 text-indigo-700 rounded-lg text-sm text-center animate-pulse">{progressStatus}</div>}
                    </div>
                </div>
                <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <p className="text-xs font-bold text-slate-400 uppercase">Total Spent</p>
                        <p className="text-3xl font-black text-slate-900 mt-1">RM {stats.totalAmount.toFixed(2)}</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <p className="text-xs font-bold text-slate-400 uppercase">Top Category</p>
                        <p className="text-xl font-black text-slate-900 mt-1">{stats.categoryBreakdown[0]?.name || 'N/A'}</p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/50">
                    <div className="relative w-full sm:w-96">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <input type="text" className="w-full pl-10 pr-3 py-2 border rounded-lg text-sm" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                    <div className="flex gap-2">
                         <Button variant="secondary" onClick={() => setExpenses(expenses)}>Refresh</Button>
                         <Button variant="secondary" onClick={() => { const ws = XLSX.utils.json_to_sheet(expenses); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Expenses"); XLSX.writeFile(wb, "Expenses.xlsx"); }}>Export</Button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Date</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Vendor</th>
                            <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase">Amount</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                        {filteredExpenses.map((expense) => (
                        <tr key={expense.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">{expense.date}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">{expense.vendorName}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-black">RM {expense.amount.toFixed(2)}</td>
                        </tr>
                        ))}
                    </tbody>
                    </table>
                </div>
            </div>
        </>
        ) : <AnalyticsView expenses={expenses} budgets={budgets} />}
      </main>

      <PricingModal isOpen={isPricingModalOpen} onClose={() => setIsPricingModalOpen(false)} user={user} onSuccess={setUser} />
    </div>
  );
}
