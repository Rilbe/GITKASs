import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  // Don't throw — export a dummy client and warn. App should check for supabase.
  console.warn("VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not defined. Supabase client will not be initialized.");
  // Export a minimal stub to avoid runtime crashes; callers should guard against null.
  export const supabase: any = null;
} else {
  export const supabase = createClient(url, key);
}
