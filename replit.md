# Connected Healthcare Ecosystem Demo

## Overview
A healthcare demo application showing how AI can bridge the gap between clinicians and patients. Features two views:
- **iPad View (Clinician Terminal)**: Input clinical conversations, run AI analysis to auto-generate charts, and recommend products
- **Smartphone View (Patient)**: View treatment reports, health metrics, and shop for recommended products

## Architecture
- **Frontend**: React + TypeScript with Tailwind CSS and shadcn/ui components
- **Backend**: Express.js with Anthropic AI integration for conversation analysis
- **AI**: Uses Replit AI Integrations (Anthropic) - no API key required
- **Storage**: In-memory only (demo application, no database)

## Key Files
- `client/src/pages/home.tsx` - Main page with state management and view toggle
- `client/src/components/ipad-view.tsx` - Clinician iPad view with conversation input and AI analysis
- `client/src/components/smartphone-view.tsx` - Patient smartphone view with health metrics and shop
- `client/src/lib/constants.ts` - Sample data, product catalog, and TypeScript types
- `server/routes.ts` - Backend API route for AI conversation analysis (`POST /api/analyze`)

## Tech Stack
- React, TypeScript, Tailwind CSS, shadcn/ui
- Express.js backend
- Anthropic AI (via Replit AI Integrations)
- TanStack Query for data fetching
- Lucide React for icons

## Fonts
- Noto Sans JP (primary sans-serif, Japanese text support)
- Space Mono (monospace, used for data displays)

## Theme
- Dark mode by default (set via `class="dark"` on html element)
- Primary accent: Teal/cyan for healthcare branding
- Uses shadcn's design token system for consistent theming
