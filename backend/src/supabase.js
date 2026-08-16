import { createClient } from "@supabase/supabase-js";
import { assertSupabaseConfig, config } from "./config.js";

assertSupabaseConfig();

export const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export const authClient = createClient(
  config.supabaseUrl,
  config.anonKey || config.serviceRoleKey,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
