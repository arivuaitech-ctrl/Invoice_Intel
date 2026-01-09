
import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  BarChart, Bar, Tooltip, ResponsiveContainer, Cell, PieChart, Pie 
} from 'recharts';
import { 
  Search, Download, Trash2, Plus, Edit2, AlertTriangle, Eye,
  PieChart as PieChartIcon, List, Settings, LogOut, Sparkles, Crown, CreditCard,
  RefreshCw, CheckCircle2, X, Loader2, ShieldAlert, ImageIcon
} from 'lucide-react';

import { ExpenseItem, Stats, SortField, SortOrder, ExpenseCategory, BudgetMap, UserProfile } from './types';
import { db } from './services/db';
import { extractInvoiceData, fileToGenerativePart } from './services/geminiService';
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
import ImageViewer from './components/ImageViewer';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#a855f7', '#64748b'];

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
  const [viewingImage, setViewingImage] = useState<{url: string, title: string} | null>(null);

  const pollIntervalRef = useRef<number | null>(null);

  const isGeminiKeyMissing = !process.env.API_KEY;

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

    const initAuth = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            try {
                const profile = await userService.upsertProfile(session.user);
                setUser(profile);
                const data = await db.getAll(session.user.id);
                setExpenses(data);
            } catch (err) {
                console.error("Auth session error:", err);
            }
        }
        setLoading(false);
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        try {
          const profile = await userService.upsertProfile(session.user);
          setUser(profile);
          const data = await db.getAll(session.user.id);
          setExpenses(data);
        } catch (err: any) {
          console.error("Auth Change Error:", err);
        }
      } else {
        setUser(null);
        setExpenses([]);
      }
    });

    setBudgets(db.getBudgets());
    return () => {
      subscription.unsubscribe();
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

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
             alert(`⚠️ Budget Alert: Spending on ${category} exceeds your RM ${limit} limit.`);
        }, 500);
      }
    }
  }

  async function handleFilesSelect(files: (File | Blob)[]) {
    if (!user) return;
    if (isGeminiKeyMissing) {
        alert("AI Processing unavailable: API Key missing.");
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
        const fileName = file instanceof File ? file.name : `captured-receipt-${Date.now()}.jpg`;
        setProgressStatus(`Analyzing ${i + 1}/${files.length}...`);
        
        try {
            const [data, imageInfo] = await Promise.all([
              extractInvoiceData(file),
              fileToGenerativePart(file)
            ]);

            const newExpense: ExpenseItem = {
                id: crypto.randomUUID(),
                vendorName: data.vendorName || 'Unknown Vendor',
                date: formatDate(data.date),
                amount: Number(data.amount) || 0,
                currency: data.currency || 'RM', 
                category: data.category as ExpenseCategory || ExpenseCategory.OTHERS,
                summary: data.summary || '',
                createdAt: Date.now(),
                fileName: fileName,
                imageData: `data:${imageInfo.mimeType};base64,${imageInfo.data}`
            };
            await db.add(newExpense, user.id);
            checkBudgetWarning(newExpense.category, newExpense.amount);
            successCount++;
        } catch (error: any) {
            console.error(`Extraction failed:`, error);
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
      }
    }
  }

  async function handleExport() {
    const dataToExport = expenses.map(({id, createdAt, imageData, ...rest}) => ({
      ...rest,
      date_created: new Date(createdAt).toLocaleString()
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Expenses");
    XLSX.writeFile(wb, `InvoiceIntel_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
       <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-slate-500 text-sm font-medium animate-pulse">Initializing InvoiceIntel...</p>
       </div>
    </div>
  );

  if (!user) {
      return <LoginPage onLogin={() => userService.login()} />;
  }

  const badgeInfo = () => {
      if (user.isTrialActive) return { text: `Trial: ${user.monthlyDocsLimit - user.docsUsedThisMonth} left`, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      if (user.planId === 'free') return { text: 'Limit Reached', color: 'bg-red-50 text-red-700 border-red-200' };
      const remaining = user.monthlyDocsLimit - user.docsUsedThisMonth;
      return { text: `${user.planId.toUpperCase()}: ${remaining} left`, color: remaining < 10 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200' };
  };
  const badge = badgeInfo();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {isGeminiKeyMissing && (
        <div className="bg-amber-500 text-white animate-slideDown shadow-md relative z-50">
            <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-center text-xs font-bold gap-3">
                <ShieldAlert className="w-4 h-4" />
                <span>AI EXTRACTION OFFLINE: Gemini API Key missing. Manual entry enabled.</span>
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
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-indigo-200 shadow-xl">
                <Sparkles className="text-white w-6 h-6" />
              </div>
              <h1 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 ml-2">InvoiceIntel</h1>
            </div>
            
            <div className="hidden md:flex bg-slate-100 p-1 rounded-xl">
                <button onClick={() => setView('expenses')} className={`flex items-center px-5 py-2 text-sm font-bold rounded-lg transition-all ${view === 'expenses' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><List className="w-4 h-4 mr-2" />List</button>
                <button onClick={() => setView('analytics')} className={`flex items-center px-5 py-2 text-sm font-bold rounded-lg transition-all ${view === 'analytics' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><PieChartIcon className="w-4 h-4 mr-2" />Insights</button>
            </div>

            <div className="flex items-center gap-4">
              <button onClick={() => setIsPricingModalOpen(true)} className={`flex items-center px-4 py-2 rounded-full text-xs font-black border transition-all hover:scale-105 active:scale-95 ${badge.color}`}>
                  {badge.text}
              </button>
              
              <div className="flex items-center gap-2 border-l pl-4">
                  {user.stripeCustomerId && (
                    <button onClick={() => stripeService.redirectToCustomerPortal(user.stripeCustomerId!)} className="text-slate-500 hover:text-indigo-600 p-2 rounded-xl hover:bg-indigo-50 transition-all"><CreditCard className="w-5 h-5" /></button>
                  )}
                  <button onClick={() => userService.logout().then(() => setUser(null))} className="text-slate-400 hover:text-red-600 p-2 rounded-xl hover:bg-red-50 transition-all" title="Logout"><LogOut className="w-5 h-5" /></button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {view === 'expenses' ? (
        <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                      <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><Plus className="w-5 h-5 text-indigo-600" />Scan Receipt</h2>
                      <FileUpload 
                        onFilesSelect={handleFilesSelect} 
                        isProcessing={isProcessing} 
                        isDisabled={!userService.canUpload(user, 1).allowed} 
                      />
                      {progressStatus && <div className="mt-4 p-3 bg-indigo-50 text-indigo-700 rounded-xl text-xs text-center font-black animate-pulse border border-indigo-100">{progressStatus}</div>}
                      <div className="mt-4 pt-4 border-t text-center"><button onClick={() => setIsModalOpen(true)} className="text-sm font-bold text-indigo-600 hover:text-indigo-800">Or type details manually</button></div>
                  </div>
              </div>
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-5"><ImageIcon className="w-24 h-24" /></div>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Total Expenses</p>
                      <p className="text-4xl font-black text-slate-900 mt-2">RM {stats.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                      <div className="h-20 mt-6">
                          <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={stats.categoryBreakdown.slice(0, 5)}><Bar dataKey="value" radius={[4, 4, 0, 0]}>{stats.categoryBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Bar></BarChart>
                          </ResponsiveContainer>
                      </div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Top Category</p>
                      <p className="text-2xl font-black text-indigo-600 mt-2">{stats.categoryBreakdown[0]?.name || 'No data'}</p>
                      <p className="text-sm text-slate-500 font-medium">RM {stats.categoryBreakdown[0]?.value.toFixed(2) || '0.00'}</p>
                  </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-5 border-b flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/30">
                    <div className="relative w-full sm:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input type="text" className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Search expenses..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                         <Button variant="secondary" className="flex-1 sm:flex-none" onClick={() => setIsBudgetModalOpen(true)} icon={<Settings className="w-4 h-4"/>}>Budget</Button>
                         <Button variant="secondary" className="flex-1 sm:flex-none" onClick={handleExport} icon={<Download className="w-4 h-4"/>}>Export</Button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50/50">
                        <tr>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Receipt</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Date / Vendor</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Category</th>
                        <th className="px-6 py-4 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">Amount</th>
                        <th className="px-6 py-4 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                        {filteredExpenses.length > 0 ? filteredExpenses.map((expense) => (
                        <tr key={expense.id} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-6 py-4 whitespace-nowrap">
                              {expense.imageData ? (
                                <div 
                                  onClick={() => setViewingImage({url: expense.imageData!, title: expense.vendorName})}
                                  className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden cursor-pointer hover:ring-2 ring-indigo-500 transition-all flex items-center justify-center"
                                >
                                  {expense.imageData.startsWith('data:application/pdf') ? (
                                    <List className="w-5 h-5 text-slate-400" />
                                  ) : (
                                    <img src={expense.imageData} className="w-full h-full object-cover" />
                                  )}
                                </div>
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center">
                                  <ImageIcon className="w-4 h-4 text-slate-300" />
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <p className="text-xs font-medium text-slate-500">{expense.date}</p>
                              <p className="text-sm font-bold text-slate-900">{expense.vendorName}</p>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-600 border border-indigo-100">
                                {expense.category}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-black text-slate-900">
                              <span className="text-[10px] text-slate-400 mr-1">{expense.currency}</span>
                              {(Number(expense.amount) || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                            </td>
                            <td className="px-6 py-4 text-right text-sm font-medium">
                                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {expense.imageData && (
                                      <button onClick={() => setViewingImage({url: expense.imageData!, title: expense.vendorName})} className="text-slate-400 hover:text-indigo-600 p-2 rounded-lg hover:bg-indigo-50"><Eye className="w-4 h-4" /></button>
                                    )}
                                    <button onClick={() => { setEditingItem(expense); setIsModalOpen(true); }} className="text-slate-400 hover:text-indigo-600 p-2 rounded-lg hover:bg-indigo-50"><Edit2 className="w-4 h-4" /></button>
                                    <button onClick={() => handleDelete(expense.id)} className="text-slate-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </td>
                        </tr>
                        )) : (
                          <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                              <Sparkles className="w-8 h-8 mb-2 mx-auto opacity-20" />
                              <p className="text-sm font-bold">Start tracking your food and bills today.</p>
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
      <PricingModal isOpen={isPricingModalOpen} onClose={() => setIsPricingModalOpen(false)} user={user} onSuccess={setUser} />
      <ImageViewer 
        isOpen={!!viewingImage} 
        onClose={() => setViewingImage(null)} 
        imageUrl={viewingImage?.url} 
        title={viewingImage?.title || ''} 
      />
    </div>
  );
}
