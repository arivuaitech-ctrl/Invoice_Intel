
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

  update: async (updatedItem: ExpenseItem, userId: string): Promise<void> => {
    const payload = mapToDb(updatedItem);
    delete payload.id; 
    delete payload.user_id;
    delete payload.created_at; 
    
    const { data, error, status } = await supabase
      .from('expenses')
      .update(payload)
      .eq('id', updatedItem.id)
      .eq('user_id', userId)
      .select();

    if (error) {
      console.error("Supabase Update Error:", error);
      throw error;
    }
    
    if (!data || data.length === 0) {
      console.warn("Update succeeded but 0 rows affected. Check RLS Policies in Supabase.");
    }
  },

  delete: async (id: string, userId: string): Promise<void> => {
    const { error, status, count } = await supabase
      .from('expenses')
      .delete({ count: 'exact' })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error("Supabase Delete Error:", error);
      throw error;
    }
    
    if (count === 0) {
      console.warn("Delete succeeded but 0 rows removed. Check if user_id matches.");
    }
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
