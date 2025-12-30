# Food Co-Pilot

AI-native consumer health co-pilot for understanding food labels. Chat-first interface where AI reasons over real ingredient data to provide calm, honest guidance.

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables (already configured in .env.local)

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Before First Run: Database Setup

Run the SQL schema in your Supabase SQL Editor:

1. Go to https://txvfwighxvsgocseyxmh.supabase.co
2. Open SQL Editor
3. Copy contents of `supabase-schema.sql`
4. Run the query

## Architecture

```
┌─────────────────────────────────────────┐
│           Chat-First Frontend           │
│     (barcode input → AI response)       │
└────────────────────┬────────────────────┘
                     │
┌────────────────────▼────────────────────┐
│              API Routes                 │
│  /api/analyze/[barcode]  /api/chat      │
└────────────────────┬────────────────────┘
                     │
     ┌───────────────┼───────────────┐
     ▼               ▼               ▼
┌─────────┐   ┌───────────┐   ┌──────────┐
│ Open    │   │ Signal    │   │ Bytez AI │
│ Food    │   │ Detection │   │ (Claude) │
│ Facts   │   │           │   │          │
└────┬────┘   └───────────┘   └──────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│        Supabase PostgreSQL              │
│  products | ingredients | sessions      │
└─────────────────────────────────────────┘
```

## How It Works

1. **User enters barcode** → System fetches from Open Food Facts
2. **Signal detection** → Deterministic pattern matching (emulsifiers, NOVA markers, etc.)
3. **AI reasoning** → Claude synthesizes signals into human-readable insight
4. **Honest communication** → Uncertainty flagged, no fear language

## Sample Barcodes

- `3017620422003` - Nutella
- `5000112637922` - Coca-Cola
- `7622210449283` - Oreo
- `8000500310427` - Ferrero Rocher

## Design Principles

- **AI is the interface**, not a feature
- **Reasoning over data**, not data display
- **Honest uncertainty** communication
- **Minimal cognitive load**

## What This Is NOT

- ❌ Nutrition scanner
- ❌ Database browser
- ❌ Dashboard app
- ❌ Feature-heavy health tracker

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Supabase (PostgreSQL)
- Bytez (Claude Opus 4.5)
- Open Food Facts API
