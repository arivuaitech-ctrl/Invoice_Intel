
import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  BarChart, Bar, Tooltip, ResponsiveContainer, Cell, PieChart, Pie 
} from 'recharts';
import { 
  Search, Download, Trash2, Plus, Edit2, AlertTriangle, 
  PieChart as PieChartIcon, List, Settings, LogOut, Sparkles, Crown, CreditCard,
  RefreshCw, CheckCircle2, X, Info
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
  const [showDebug, setShowDebug] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ExpenseItem | undefined>(undefined);

  // Stats derivation
  const filteredExpenses = useMemo(() => {
    return expenses
      .filter((item) => {
        const vendor = item.vendorName || '';
        const note = item.summary || '';
        const matchesSearch = vendor.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              note.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        const factor = sortOrder === 'asc' ? 1 : -1;
        if (sortField === 'amount') return (a.amount - b.amount) * factor;
        return (new Date(a.date).getTime() - new Date(b.date).getTime()) * factor;
      });
  }, [expenses, searchTerm, selectedCategory, sortField, sortOrder]);

  const stats = useMemo<Stats>(() => {
    const totalAmount = expenses.reduce((sum, item) => sum + item.amount, 0);
    const categoryMap = new Map<string, number>();
    expenses.forEach((item) => {
      categoryMap.set(item.category, (categoryMap.get(item.category) || 0) + item.amount);
    });
    const categoryBreakdown = Array.from(categoryMap.entries()).map(([name, value]) => ({ name, value }));
    return { totalAmount, count: expenses.length, categoryBreakdown };
  }, [expenses]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
        setPaymentStatus('success');
        window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const profile = await userService.upsertProfile(session.user);
        setUser(profile);
        setExpenses(await db.getAll(session.user.id));
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    setBudgets(db.getBudgets());
    return () => subscription.unsubscribe();
  }, []);

  const refreshProfile = async () => {
    if (!user) return;
    setLoading(true);
    const refreshed = await userService.getProfile(user.id);
    if (refreshed) setUser(refreshed);
    setLoading(false);
  };

  const handleFilesSelect = async (files: File[]) => {
    if (!user) return;
    if (!userService.canUpload(user, files.length).allowed) {
        setIsPricingModalOpen(true);
        return;
    }

    setIsProcessing(true);
    let successCount = 0;
    for (const file of files) {
        setProgressStatus(`Analyzing ${file.name}...`);
        try {
            const data = await extractInvoiceData(file);
            const newItem: ExpenseItem = {
                id: crypto.randomUUID(),
                vendorName: data.vendorName || 'Unknown',
                date: data.date || new Date().toISOString().split('T')[0],
                amount: Number(data.amount) || 0,
                currency: 'RM',
                category: data.category as ExpenseCategory || ExpenseCategory.OTHERS,
                summary: data.summary || '',
                createdAt: Date.now()
            };
            await db.add(newItem, user.id);
            successCount++;
        } catch (e) { console.error(e); }
    }
    if (successCount > 0) {
        setUser(await userService.recordUsage(user, successCount));
        setExpenses(await db.getAll(user.id));
    }
    setIsProcessing(false);
    setProgressStatus('');
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
       <div className="flex flex-col items-center">
          <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
          <p className="text-slate-500 font-medium">Synchronizing profile...</p>
       </div>
    </div>
  );

  if (!user) return <LoginPage onLogin={userService.login} />;

  const badge = user.planId === 'free' 
    ? { text: `Trial: ${user.monthlyDocsLimit - user.docsUsedThisMonth} left`, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    : { text: `${user.planId.toUpperCase()} Plan`, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12">
      <header className="bg-white border-b sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xs">II</div>
                <h1 className="text-xl font-bold text-slate-900">InvoiceIntel</h1>
            </div>

            <div className="flex items-center gap-3">
                <div className={`px-3 py-1.5 rounded-full text-xs font-bold border ${badge.color} flex items-center gap-2`}>
                   {user.planId === 'free' ? <Sparkles className="w-3 h-3"/> : <Crown className="w-3 h-3"/>}
                   {badge.text}
                </div>
                <button onClick={refreshProfile} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors" title="Sync Account"><RefreshCw className="w-5 h-5"/></button>
                <button onClick={userService.logout} className="p-2 text-slate-400 hover:text-red-600" title="Logout"><LogOut className="w-5 h-5"/></button>
            </div>
        </div>
      </header>

      {paymentStatus === 'success' && (
        <div className="bg-emerald-600 text-white p-3 text-center text-sm font-semibold flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Payment Successful! If your plan isn't updated yet, please click the sync button above.
            <button onClick={() => setPaymentStatus(null)} className="ml-4 opacity-70 hover:opacity-100"><X className="w-4 h-4"/></button>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h2 className="text-lg font-bold mb-4">Add Invoices</h2>
                    <FileUpload onFilesSelect={handleFilesSelect} isProcessing={isProcessing} isDisabled={user.monthlyDocsLimit === 0 && user.planId === 'free'} disabledMessage="Trial Expired. Upgrade to continue." />
                    {progressStatus && <div className="mt-4 p-3 bg-indigo-50 text-indigo-700 text-xs rounded-lg animate-pulse">{progressStatus}</div>}
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">Summary</h3>
                    <div className="space-y-4">
                        <div>
                            <p className="text-3xl font-black text-slate-900">RM {stats.totalAmount.toFixed(2)}</p>
                            <p className="text-xs text-slate-500">Total Spent</p>
                        </div>
                        <div className="pt-4 border-t">
                            <button onClick={() => setView(view === 'expenses' ? 'analytics' : 'expenses')} className="w-full py-2 bg-slate-50 text-slate-600 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-100 transition-all">
                                {view === 'expenses' ? <PieChartIcon className="w-4 h-4"/> : <List className="w-4 h-4"/>}
                                {view === 'expenses' ? 'View Analytics' : 'View List'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="lg:col-span-2">
                {view === 'expenses' ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-4 border-b flex items-center gap-4 bg-slate-50/50">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                <input type="text" placeholder="Search..." className="w-full pl-10 pr-4 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                            </div>
                            <Button variant="secondary" onClick={() => setIsPricingModalOpen(true)} icon={<CreditCard className="w-4 h-4"/>}>Plans</Button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50 text-left text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4">Date</th>
                                        <th className="px-6 py-4">Vendor</th>
                                        <th className="px-6 py-4 text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredExpenses.map(item => (
                                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4 text-sm text-slate-500">{item.date}</td>
                                            <td className="px-6 py-4 text-sm font-bold">{item.vendorName}</td>
                                            <td className="px-6 py-4 text-sm font-black text-right">RM {item.amount.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    {filteredExpenses.length === 0 && (
                                        <tr><td colSpan={3} className="px-6 py-12 text-center text-slate-400 text-sm">No items found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <AnalyticsView expenses={expenses} budgets={budgets} />
                )}
            </div>
        </div>
      </main>

      <footer className="max-w-7xl mx-auto px-4 text-center mt-12 pb-8">
          <button onClick={() => setShowDebug(!showDebug)} className="text-[10px] text-slate-300 hover:text-indigo-400 flex items-center gap-1 mx-auto">
              <Info className="w-3 h-3"/> {showDebug ? 'Hide Debug' : 'Connection Diagnostics'}
          </button>
          {showDebug && (
              <div className="mt-4 p-4 bg-slate-900 text-indigo-300 text-[10px] font-mono rounded-xl text-left max-w-md mx-auto">
                  <p>USER_ID: {user.id}</p>
                  <p>EMAIL: {user.email}</p>
                  <p>PLAN: {user.planId}</p>
                  <p>DOC_LIMIT: {user.monthlyDocsLimit}</p>
                  <p className="mt-2 text-white/50 border-t pt-2 border-white/10 italic text-[9px]">
                      Copy these to troubleshoot Stripe Metadata mismatches.
                  </p>
              </div>
          )}
      </footer>

      <PricingModal isOpen={isPricingModalOpen} onClose={() => setIsPricingModalOpen(false)} user={user} onSuccess={setUser} />
    </div>
  );
}
