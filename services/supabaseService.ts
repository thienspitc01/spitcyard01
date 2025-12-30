
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabase: SupabaseClient | null = null;

export interface CloudConfig {
  url: string;
  key: string;
}

export const initSupabase = (config: CloudConfig) => {
  if (!config.url || !config.key) return null;
  supabase = createClient(config.url, config.key);
  return supabase;
};

export const getSupabase = () => supabase;

export const syncTable = async (tableName: string, id: string, data: any) => {
  if (!supabase) return;
  const { error } = await supabase
    .from(tableName)
    .upsert({ id, data, updated_at: new Date().toISOString() });
  
  if (error) console.error(`Sync error on ${tableName}:`, error);
};

export const fetchTableData = async (tableName: string) => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from(tableName)
    .select('data')
    .order('updated_at', { ascending: false });
  
  if (error) {
    console.error(`Fetch error on ${tableName}:`, error);
    return [];
  }
  return data.map(item => item.data);
};

export const subscribeToChanges = (tableName: string, callback: (payload: any) => void) => {
  if (!supabase) return null;
  
  const channel = supabase
    .channel(`${tableName}-changes`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: tableName },
      (payload) => {
        if (payload.new && payload.new.data) {
          callback(payload.new.data);
        }
      }
    )
    .subscribe();
    
  return channel;
};
