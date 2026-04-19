import { describe, expect, it } from 'vitest';

import { supabase } from '@/lib/supabase';

describe('supabase client', () => {
  it('exporte un client construit avec les méthodes attendues', () => {
    expect(supabase).toBeDefined();
    expect(typeof supabase.from).toBe('function');
    expect(typeof supabase.auth.signInWithPassword).toBe('function');
  });
});
