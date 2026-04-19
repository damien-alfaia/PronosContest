/**
 * Types DB Supabase — placeholder Sprint 0.
 *
 * À régénérer automatiquement après chaque migration avec :
 *   supabase gen types typescript --local > src/types/database.ts
 *
 * (ou `--linked` si le projet est branché à un Supabase distant)
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
