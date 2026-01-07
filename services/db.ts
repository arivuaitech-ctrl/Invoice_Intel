import { ExpenseItem, BudgetMap, ExpenseCategory } from '../types';
import { supabase } from './supabaseClient';

const mapToDb = (item: ExpenseItem, userId?: string) => {
  const data: any = {
    id: item.id,
    vendor_name: item.vendorName,
    date: item.date,
    amount: item.amount,
    currency: item.currency,
    category: item.category,
    summary: item.summary,
    file_name: item.fileName,
    image_data: item.imageData,
    created_at: item.createdAt
  };
  
  // Only include user_id on creation (insert), never on update
  if (userId) {
    data.user_id = userId;
  }
  
  return data;
};

const mapFromDb = (data: any): ExpenseItem => ({
  id: data.id,
  vendorName: data.vendor_name,
  date: data.date,
  amount: Number(data.amount) || 0,
  currency: data.currency || 'RM',
  category: data.category as ExpenseCategory,
  summary: data.summary || '',
  fileName: data.file_name,
  imageData: data.image_data,
  createdAt: data.created_at
});

export const db = {
  getAll: async (userId: string): Promise<ExpenseItem[]> => {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) {
      console.error("Error fetching expenses:", error);
      return [];
    }
    return (data || []).map(mapFromDb);
  },

  add: async (item: ExpenseItem, userId: string): Promise<void> => {
    const { error } = await supabase
      .from('expenses')
      .insert([mapToDb(item, userId)]);

    if (error) {
      console.error("Error adding expense:", error);
      throw error;
    }
  },

  update: async (updatedItem: ExpenseItem): Promise<void> => {
    // Exclude protected fields by just mapping basic item data
    const payload = mapToDb(updatedItem);
    delete payload.user_id; // Absolute safety check
    
    const { error } = await supabase
      .from('expenses')
      .update(payload)
      .eq('id', updatedItem.id);

    if (error) {
      console.error("Error updating expense:", error);
      throw error;
    }
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  clearAll: async (userId: string): Promise<void> => {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;
  },

  getBudgets: (): BudgetMap => {
    const data = localStorage.getItem('invoice_intel_budgets_v1');
    if (data) return JSON.parse(data);
    return {
      [ExpenseCategory.FOOD]: 0,
      [ExpenseCategory.UTILITY]: 0,
      [ExpenseCategory.TRANSPORT]: 0,
      [ExpenseCategory.HOTEL]: 0,
      [ExpenseCategory.OTHERS]: 0,
    };
  },

  saveBudgets: (budgets: BudgetMap): void => {
    localStorage.setItem('invoice_intel_budgets_v1', JSON.stringify(budgets));
  }
};