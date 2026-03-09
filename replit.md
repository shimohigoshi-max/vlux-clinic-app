# Connected Healthcare Ecosystem Demo v2.4

## Overview
A healthcare demo application showing how AI can bridge the gap between clinicians and patients. Features two views:
- **iPad View (Clinician Terminal)**: Voice recording (Web Speech API), AI-powered two-step analysis (auto-summarize + full karte generation), treatment history with AI correlation analysis, HealthKit sync simulation
- **Smartphone View (Patient)**: Timeline with doctor's notes, health metrics, coupon wallet (3 types), booking button, shop with rank-based pricing, membership rank system (5 tiers: Bronze/Silver/Gold/Platinum/Eternal Platinum with progress bar, perks list, and roadmap)

## Architecture
- **Frontend**: React + TypeScript with Tailwind CSS and shadcn/ui components
- **Backend**: Express.js with Anthropic AI integration for conversation analysis
- **AI**: Uses Replit AI Integrations (Anthropic) - no API key required, model: claude-sonnet-4-6
- **Storage**: In-memory only (demo application, no database)

## Key Files
- `client/src/pages/home.tsx` - Main page with all state management (voice recording, AI mutations, health sync, cart)
- `client/src/components/ipad-view.tsx` - Clinician iPad view with 4 tabs: Voice, Karte, History/Correlation, Health
- `client/src/components/smartphone-view.tsx` - Patient smartphone view with 4 tabs: Timeline, Health Data, Shop (rank-based pricing), Rank (membership card + roadmap)
- `client/src/lib/constants.ts` - Types (SummaryResult, KarteResult, CorrelationResult, TreatmentRecord, Rank), sample data, 8 treatment history records, 5-tier rank system (Bronze/Silver/Gold/Platinum/Eternal Platinum), status color utilities
- `server/routes.ts` - Three API endpoints: POST /api/summarize, POST /api/analyze, POST /api/correlate

## API Endpoints
- `POST /api/summarize` - Quick AI summary of conversation (auto-triggered after voice input)
- `POST /api/analyze` - Full karte generation with lifestyle/diet/supplement/self-care fields + product recommendations
- `POST /api/correlate` - AI correlation analysis of 8-visit treatment history vs health data (HRV, steps, sleep)

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
