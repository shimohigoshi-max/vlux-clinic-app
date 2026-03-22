# VLUX v3.1 — Connected Healthcare Ecosystem Demo

## Overview
A healthcare demo application (branded VLUX) showing how AI can bridge the gap between clinicians and patients. Features two views:
- **iPad View (Clinician Terminal)**: Voice recording (Web Speech API), AI-powered two-step analysis (auto-summarize + full karte generation), treatment history with AI correlation analysis, HealthKit sync simulation, EC sales management dashboard
- **Smartphone View (Patient)**: Timeline with doctor's notes + AI life advice card (monthly theme, 5-axis focus areas with priority, today's action, next visit goal), health metrics, coupon wallet (3 types), booking button, VLUXストア with rank-based pricing, VLUXスコア membership rank system (5 tiers), cross-clinic data inheritance demo

## Architecture
- **Frontend**: React + TypeScript with Tailwind CSS and shadcn/ui components
- **Backend**: Express.js with Anthropic AI integration for conversation analysis
- **AI**: Uses Replit AI Integrations (Anthropic) - no API key required, model: claude-sonnet-4-6
- **Storage**: In-memory for UI state + Supabase PostgreSQL for persistent data (clinics, patients, visits, health_data)

## Key Files
- `client/src/pages/home.tsx` - Main page with all state management (voice recording, AI mutations, health sync, cart), VLUXLogo component
- `client/src/components/ipad-view.tsx` - Clinician iPad view with 5 tabs: 音声入力 (Voice), カルテ履歴 (Karte History - expandable cards with formal karte + AI summary, newest first), 履歴・相関分析 (History/Correlation), 健康データ (Health), 通販売上 (EC Sales Dashboard)
- `client/src/components/smartphone-view.tsx` - Patient smartphone view with 4 tabs: タイムライン, 健康データ, VLUXストア (rank-based pricing), VLUXスコア (membership card). Includes ClinicBanner for cross-clinic switching.
- `client/src/lib/constants.ts` - Types, sample data, 8 treatment history records, 5-tier rank system, status color utilities, PHASES (5 phases), CLINIC_MASTER (2 clinics), revenue constants
- `server/routes.ts` - AI endpoints + Supabase CRUD endpoints for 4 tables
- `server/supabase.ts` - Supabase client factory (`getSupabaseClient()`) + TypeScript types for all 4 tables

## API Endpoints
### AI
- `POST /api/summarize` - Quick AI summary of conversation (auto-triggered after voice input)
- `POST /api/analyze` - Full karte generation. Body: `{transcription: string, ...}`. Returns `{chief_complaint, assessment, treatment_plan, lifestyle_advice[], recommended_products[], follow_up, risk_flags[], visit_id}`. Saves to Supabase visits.
- `POST /api/correlate` - AI correlation analysis of treatment history vs health data

### Patient-facing APIs (Supabase-backed, uses demo patient)
- `GET /api/patient/profile` — デモ患者プロフィール (name_kana, member_grade, visit_count)
- `GET /api/patient/visits` — 来院履歴 (visited_at, chief_complaint, soap_note, lifestyle_advice, recommended_products)
- `GET /api/patient/health-data` — 健康データ (recorded_date, steps, heart_rate_avg, sleep_minutes, active_calories)
- `POST /api/dev/seed` — テストデータ投入 (7日分の健康データ + 3件の来院記録)

### Supabase CRUD (admin)
- `GET/POST/DELETE /api/clinics` — クリニック一覧・登録・削除
- `GET/POST/PATCH/DELETE /api/patients` — 患者一覧・登録・更新・削除
- `GET/POST/DELETE /api/visits` — 来院記録
- `GET/POST/DELETE /api/health-data` — 健康データ

### Supabase Config
- URL: `SUPABASE_URL` env var
- Key: `SUPABASE_PUBLISHABLE_KEY` env var
- Tables must be created manually via SQL in Supabase dashboard (SQL Editor)

## Key Constants
- VISIT_COUNT = 8, current rank = Bronze
- CLINIC_MASTER: tanaka (田中整骨院, default), sakai (堺整骨院グループ)
- Revenue: REV_CONV_RATE=0.25

## Tech Stack
- React, TypeScript, Tailwind CSS, shadcn/ui
- Express.js backend
- Anthropic AI (via Replit AI Integrations)
- TanStack Query for data fetching
- Lucide React for icons
- Web Speech API for voice recording

## Fonts
- Noto Sans JP (primary sans-serif, Japanese text support)
- Space Mono (monospace, used for data displays and labels)

## Theme
- Dark mode only (set via `class="dark"` on html element)
- Primary accent: Teal/cyan for healthcare branding
- Uses shadcn's design token system for consistent theming
- Deep navy background with teal primary color
- VLUX branding: gradient logo (green → blue → purple)
