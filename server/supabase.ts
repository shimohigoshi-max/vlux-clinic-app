import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_PUBLISHABLE_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export function getSupabaseClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}

export function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type Clinic = {
  id: string;
  name: string;
  address: string;
  phone: string;
  created_at: string;
};

export type Patient = {
  id: string;
  clinic_id: string;
  name: string;
  phone: string;
  grade: string;
  created_at: string;
};

export type Visit = {
  id: string;
  patient_id: string;
  clinic_id: string;
  note: string;
  advice: string;
  created_at: string;
};

export type HealthData = {
  id: string;
  patient_id: string;
  steps: number;
  sleep_hours: number;
  heart_rate: number;
  recorded_at: string;
};
