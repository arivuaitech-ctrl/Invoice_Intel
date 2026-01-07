import React, { useState, useEffect } from 'react';
import { ExpenseItem, ExpenseCategory } from '../types';
import Button from './Button';
import { X } from 'lucide-react';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: ExpenseItem) => void;
  initialData?: ExpenseItem;
}

const ExpenseModal: React.FC<ExpenseModalProps> = ({ isOpen, onClose, onSave, initialData }) => {
  const [formData, setFormData] = useState<Partial<ExpenseItem>>({
    vendorName: '',
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    currency: 'RM',
    category: ExpenseCategory.OTHERS,
    summary: '',
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
        // Reset for new entry
        setFormData({
            vendorName: '',
            date: new Date().toISOString().split('T')[0],
            amount: 0,
            currency: 'RM',
            category: ExpenseCategory.OTHERS,
            summary: '',
        });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vendorName || !formData.amount) return;

    onSave({
      id: initialData?.id || crypto.randomUUID(),
      createdAt: initialData?.createdAt || Date.now(),
      fileName: initialData?.fileName,
      ...formData as ExpenseItem
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background Overlay */}
        <div 
            className="fixed inset-0 bg-slate-900 bg-opacity-75 transition-opacity" 
            aria-hidden="true"
            onClick={onClose}
        ></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg leading-6 font-medium text-slate-900" id="modal-title">
                    {initialData ? 'Edit Expense' : 'Add Manual Expense'}
                </h3>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-500">
                    <X className="w-5 h-5" />
                </button>
            </div>
            
            <form id="expenseForm" onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Vendor / Merchant</label>
                <input
                  type="text"
                  required
                  className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 bg-white text-slate-900"
                  value={formData.vendorName}
                  onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700">Date</label>
                    <input
                    type="date"
                    required
                    className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 bg-white text-slate-900"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700">Amount</label>
                    <div className="relative mt-1 rounded-md shadow-sm">
                        <input
                        type="number"
                        step="0.01"
                        required
                        className="block w-full rounded-md border-slate-300 pl-3 pr-16 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 bg-white text-slate-900"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center">
                            <select
                                className="h-full rounded-md border-transparent bg-transparent py-0 pl-2 pr-7 text-slate-500 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm bg-white"
                                value={formData.currency}
                                onChange={(e) => setFormData({...formData, currency: e.target.value})}
                            >
                                <option>RM</option>
                                <option>USD</option>
                                <option>EUR</option>
                                <option>GBP</option>
                                <option>SGD</option>
                            </select>
                        </div>
                    </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Category</label>
                <select
                  className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 bg-white text-slate-900"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as ExpenseCategory })}
                >
                  {Object.values(ExpenseCategory).map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Summary / Notes</label>
                <textarea
                  rows={2}
                  className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 bg-white text-slate-900"
                  value={formData.summary || ''}
                  onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                />
              </div>
            </form>
          </div>
          <div className="bg-slate-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
            <Button type="submit" form="expenseForm" className="w-full sm:w-auto sm:ml-3">
              Save Expense
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

export default ExpenseModal;