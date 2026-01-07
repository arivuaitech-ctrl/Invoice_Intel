import React, { useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend,
  AreaChart, Area, CartesianGrid, ReferenceLine
} from 'recharts';
import { ExpenseItem, Stats, BudgetMap, ExpenseCategory } from '../types';
import { TrendingUp, Award, Calendar, DollarSign, AlertCircle } from 'lucide-react';

interface AnalyticsViewProps {
  expenses: ExpenseItem[];
  budgets: BudgetMap;
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];

const AnalyticsView: React.FC<AnalyticsViewProps> = ({ expenses, budgets }) => {
  
  // Prepare Data for Charts
  const chartData = useMemo(() => {
    // 1. Monthly Trends
    const monthlyMap = new Map<string, number>();
    expenses.forEach(item => {
      // Format YYYY-MM
      const month = item.date.substring(0, 7); 
      monthlyMap.set(month, (monthlyMap.get(month) || 0) + item.amount);
    });
    const monthly = Array.from(monthlyMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // 2. Category Distribution
    const categoryMap = new Map<string, number>();
    expenses.forEach(item => {
      categoryMap.set(item.category, (categoryMap.get(item.category) || 0) + item.amount);
    });
    const category = Array.from(categoryMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // 3. Top Vendors
    const vendorMap = new Map<string, number>();
    expenses.forEach(item => {
      vendorMap.set(item.vendorName, (vendorMap.get(item.vendorName) || 0) + item.amount);
    });
    const vendors = Array.from(vendorMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // Top 5

    // 4. Budget vs Actual
    const budgetComparison = Object.values(ExpenseCategory).map(cat => {
        const spent = categoryMap.get(cat) || 0;
        const limit = budgets[cat] || 0;
        return {
            name: cat,
            spent: spent,
            limit: limit,
            isOverBudget: limit > 0 && spent > limit
        };
    });

    return { monthly, category, vendors, budgetComparison };
  }, [expenses, budgets]);

  const totalSpent = expenses.reduce((acc, curr) => acc + curr.amount, 0);
  const averageTransaction = expenses.length > 0 ? totalSpent / expenses.length : 0;
  const maxMonth = chartData.monthly.length > 0 
    ? chartData.monthly.reduce((prev, current) => (prev.value > current.value) ? prev : current)
    : { name: 'N/A', value: 0 };

  const overBudgetItems = chartData.budgetComparison.filter(i => i.isOverBudget);

  if (expenses.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center h-96 text-slate-400 bg-white rounded-xl border border-slate-200 shadow-sm">
            <TrendingUp className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-lg">No data available for insights.</p>
            <p className="text-sm">Upload some invoices to see analytics.</p>
        </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
            <div className="p-3 bg-indigo-100 rounded-lg text-indigo-600">
                <span className="font-bold text-lg">RM</span>
            </div>
            <div>
                <p className="text-sm text-slate-500 font-medium">Total Spending</p>
                <p className="text-2xl font-bold text-slate-900">RM {totalSpent.toFixed(2)}</p>
            </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
            <div className="p-3 bg-emerald-100 rounded-lg text-emerald-600">
                <TrendingUp className="w-6 h-6" />
            </div>
            <div>
                <p className="text-sm text-slate-500 font-medium">Average Transaction</p>
                <p className="text-2xl font-bold text-slate-900">RM {averageTransaction.toFixed(2)}</p>
            </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
            <div className="p-3 bg-amber-100 rounded-lg text-amber-600">
                <Calendar className="w-6 h-6" />
            </div>
            <div>
                <p className="text-sm text-slate-500 font-medium">Highest Month</p>
                <p className="text-2xl font-bold text-slate-900">{maxMonth.name}</p>
                <p className="text-xs text-slate-400">RM {maxMonth.value.toFixed(2)}</p>
            </div>
        </div>
      </div>

        {/* Budget Status Section */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
                 <h3 className="text-lg font-semibold text-slate-800">Budget Status</h3>
                 {overBudgetItems.length > 0 && (
                     <div className="flex items-center text-red-600 bg-red-50 px-3 py-1 rounded-full text-xs font-medium">
                         <AlertCircle className="w-4 h-4 mr-1" />
                         {overBudgetItems.length} Categories Over Limit
                     </div>
                 )}
            </div>
           
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {chartData.budgetComparison.map((item) => (
                    <div key={item.name} className={`p-4 rounded-lg border ${item.isOverBudget ? 'border-red-200 bg-red-50' : 'border-slate-100 bg-slate-50'}`}>
                        <div className="flex justify-between items-center mb-2">
                            <span className="font-medium text-slate-700">{item.name}</span>
                            {item.limit > 0 && (
                                <span className={`text-xs font-bold ${item.isOverBudget ? 'text-red-600' : 'text-slate-400'}`}>
                                    {((item.spent / item.limit) * 100).toFixed(0)}%
                                </span>
                            )}
                        </div>
                        <div className="text-lg font-bold text-slate-900 mb-1">
                            RM {item.spent.toFixed(0)} 
                            <span className="text-xs text-slate-400 font-normal ml-1">
                                / {item.limit > 0 ? `RM ${item.limit}` : '∞'}
                            </span>
                        </div>
                        {item.limit > 0 && (
                            <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2">
                                <div 
                                    className={`h-1.5 rounded-full ${item.isOverBudget ? 'bg-red-500' : 'bg-indigo-500'}`} 
                                    style={{ width: `${Math.min((item.spent / item.limit) * 100, 100)}%` }}
                                ></div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend Chart */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-800 mb-6">Spending Trend</h3>
            <div className="w-full h-64" style={{ minHeight: '250px' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData.monthly}>
                        <defs>
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(value) => `RM${value}`} />
                        <Tooltip 
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            formatter={(value: number) => [`RM ${value.toFixed(2)}`, 'Amount']}
                        />
                        <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Category Pie Chart */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-800 mb-6">Spending by Category</h3>
            <div className="w-full h-64" style={{ minHeight: '250px' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={chartData.category}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {chartData.category.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => `RM ${value.toFixed(2)}`} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
      </div>

      {/* Top Vendors Bar Chart */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-800 mb-6">Top Vendors by Spend</h3>
        <div className="w-full h-64" style={{ minHeight: '250px' }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.vendors} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 13, fontWeight: 500}} />
                    <Tooltip 
                        cursor={{fill: '#f8fafc'}}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: number) => [`RM ${value.toFixed(2)}`, 'Total']}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                        {chartData.vendors.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsView;