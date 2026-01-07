import React, { useState, useEffect } from 'react';
import { BudgetMap, ExpenseCategory } from '../types';
import Button from './Button';
import { X, AlertTriangle } from 'lucide-react';

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  budgets: BudgetMap;
  onSave: (budgets: BudgetMap) => void;
}

const BudgetModal: React.FC<BudgetModalProps> = ({ isOpen, onClose, budgets, onSave }) => {
  const [localBudgets, setLocalBudgets] = useState<BudgetMap>({ ...budgets });

  useEffect(() => {
    if (isOpen) {
      setLocalBudgets({ ...budgets });
    }
  }, [isOpen, budgets]);

  const handleChange = (category: ExpenseCategory, value: string) => {
    const numValue = parseFloat(value) || 0;
    setLocalBudgets(prev => ({
      ...prev,
      [category]: numValue
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(localBudgets);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div 
            className="fixed inset-0 bg-slate-900 bg-opacity-75 transition-opacity" 
            aria-hidden="true"
            onClick={onClose}
        ></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg leading-6 font-medium text-slate-900 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-indigo-500" />
                    Set Monthly Budgets (RM)
                </h3>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-500">
                    <X className="w-5 h-5" />
                </button>
            </div>
            
            <p className="text-sm text-slate-500 mb-6">
                Define your spending limits. Set to 0 to disable warnings for a category.
            </p>

            <form id="budgetForm" onSubmit={handleSubmit} className="space-y-4">
              {Object.values(ExpenseCategory).map((cat) => (
                <div key={cat} className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-slate-700 w-1/3">
                    {cat}
                  </label>
                  <div className="relative rounded-md shadow-sm w-2/3">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <span className="text-slate-500 sm:text-sm">RM</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="10"
                      className="block w-full rounded-md border-slate-300 pl-12 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 bg-white text-slate-900"
                      value={localBudgets[cat] || ''}
                      onChange={(e) => handleChange(cat, e.target.value)}
                      placeholder="No Limit"
                    />
                  </div>
                </div>
              ))}
            </form>
          </div>
          <div className="bg-slate-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
            <Button type="submit" form="budgetForm" className="w-full sm:w-auto sm:ml-3">
              Save Budgets
            </Button>
            <Button variant="secondary" onClick={onClose} className="mt-3 w-full sm:mt-0 sm:ml-3 sm:w-auto">
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BudgetModal;