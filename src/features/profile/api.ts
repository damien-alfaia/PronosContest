import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

/**
 * Charge le profil de l'utilisateur courant.
 * Retourne `null` si la ligne n'existe pas (cas improbable car créée par trigger).
 */
export const fetchCurrentProfile = async (userId: string): Promise<Profile | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
};

/**
 * Met à jour le profil de l'utilisateur courant.
 *
 * On ne laisse pas le front toucher à `id`, `email`, ni `role`
 * (blindage en plus de la RLS qui l'interdit déjà).
 */
export const updateCurrentProfile = async (
  userId: string,
  patch: Omit<ProfileUpdate, 'id' | 'email' | 'role'>,
): Promise<Profile> => {
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
};
