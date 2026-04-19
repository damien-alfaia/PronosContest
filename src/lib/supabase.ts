import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

/**
 * Client Supabase typé (front).
 *
 * ⚠️ N'utilise JAMAIS la service role key ici. Seule l'anon key est
 * exposée au navigateur. Les opérations privilégiées passent par des
 * Edge Functions Supabase.
 *
 * Les vars proviennent de `.env.local` (voir `.env.example`) :
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // En Sprint 0 on ne plante pas : on log un warn pour que le dev branche
  // `supabase start` ou un projet distant avant de taper la BDD.
  console.warn(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquants. ' +
      'Copie .env.example en .env.local puis lance `supabase start` ' +
      'ou renseigne un projet distant.',
  );
}

export const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl ?? 'http://localhost:54321',
  supabaseAnonKey ?? 'public-anon-key-placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
