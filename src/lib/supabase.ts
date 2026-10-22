import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://cfwxcbqbmlpcjdlbxsct.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_d5EskoMJ2Oq2eDuf07Fc1Q_YkjnDVO6';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
