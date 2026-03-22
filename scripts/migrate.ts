import { Client } from "pg";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Extract project ref from URL: https://hcgsdtbigidxanjtusrf.supabase.co
const ref = SUPABASE_URL.replace("https://", "").replace(".supabase.co", "");

async function tryConnect(config: object): Promise<Client | null> {
  const client = new Client(config);
  try {
    await client.connect();
    return client;
  } catch {
    return null;
  }
}

async function runMigration() {
  console.log("Connecting to Supabase project:", ref);

  const configs = [
    // Transaction pooler (port 6543)
    { host: `aws-0-ap-northeast-1.pooler.supabase.com`, port: 6543, database: "postgres", user: `postgres.${ref}`, password: SERVICE_KEY, ssl: { rejectUnauthorized: false } },
    // Session pooler (port 5432)
    { host: `aws-0-ap-northeast-1.pooler.supabase.com`, port: 5432, database: "postgres", user: `postgres.${ref}`, password: SERVICE_KEY, ssl: { rejectUnauthorized: false } },
    // Direct connection
    { host: `db.${ref}.supabase.co`, port: 5432, database: "postgres", user: "postgres", password: SERVICE_KEY, ssl: { rejectUnauthorized: false } },
    // Other regions
    { host: `aws-0-us-east-1.pooler.supabase.com`, port: 6543, database: "postgres", user: `postgres.${ref}`, password: SERVICE_KEY, ssl: { rejectUnauthorized: false } },
    { host: `aws-0-us-west-1.pooler.supabase.com`, port: 6543, database: "postgres", user: `postgres.${ref}`, password: SERVICE_KEY, ssl: { rejectUnauthorized: false } },
  ];

  let client: Client | null = null;
  for (const config of configs) {
    console.log(`Trying: ${(config as any).host}:${(config as any).port} user=${(config as any).user}`);
    client = await tryConnect(config);
    if (client) {
      console.log("Connected!");
      break;
    }
  }

  if (!client) {
    console.error("Failed to connect to Supabase database.");
    console.error("The service role key cannot be used as a PostgreSQL password.");
    console.error("You need to run the SQL manually in the Supabase SQL Editor.");
    process.exit(1);
  }

  const sql = `
-- Drop existing tables (order matters due to FKs)
DROP TABLE IF EXISTS health_data CASCADE;
DROP TABLE IF EXISTS visits CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS clinics CASCADE;

-- 1. clinics（医院）
CREATE TABLE clinics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid REFERENCES auth.users(id),
  address text,
  phone text,
  plan text DEFAULT 'phase1',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 2. patients（患者）
CREATE TABLE patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES clinics(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  name_kana text NOT NULL,
  birth_date date,
  gender text,
  phone text,
  member_grade text DEFAULT 'bronze',
  created_at timestamptz DEFAULT now()
);

-- 3. visits（来院記録）
CREATE TABLE visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  visited_at timestamptz NOT NULL DEFAULT now(),
  chief_complaint text,
  soap_note jsonb,
  audio_url text,
  lifestyle_advice jsonb,
  recommended_products jsonb,
  created_at timestamptz DEFAULT now()
);

-- 4. health_data（HealthKitデータ）
CREATE TABLE health_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  recorded_date date NOT NULL,
  steps integer,
  heart_rate_avg numeric,
  sleep_minutes integer,
  active_calories numeric,
  source text DEFAULT 'healthkit',
  synced_at timestamptz DEFAULT now()
);

-- RLS（行レベルセキュリティ）を有効化
ALTER TABLE clinics     ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients    ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits      ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_data ENABLE ROW LEVEL SECURITY;
`;

  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    console.log("Migration completed successfully!");
    console.log("Tables created: clinics, patients, visits, health_data");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
