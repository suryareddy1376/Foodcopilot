# Food Co-Pilot 🥗

**AI-native consumer health co-pilot for understanding food labels.**

Chat-first interface where AI reasons over real ingredient data to provide calm, honest guidance.

## ✨ Features

- **🧠 Structured Reasoning** — AI shows its thinking: concerns, tradeoffs, uncertainties, and bottom-line
- **🎯 Decision Verdicts** — Clear 🟢 Safe / 🟡 Occasional / 🔴 Avoid recommendations
- **💡 Intent Inference** — AI assumes what you want to know (no 20 questions)
- **🔍 Confidence Indicators** — Transparent about data quality
- **⚠️ Failure Transparency** — Refuses to guess when data is insufficient
- **💾 Session Memory** — Remembers your preferences within a session

## 🚀 Quick Start

```bash
npm install
cp .env.example .env.local  # Add your API keys
npm run dev
```

## 🧪 Test Barcodes

- `3017620422003` — Nutella
- `5000112637922` — Coca-Cola
- `7622210449283` — Oreo

## 🛠️ Tech Stack

- **Next.js 14** + TypeScript + Tailwind CSS
- **Thesys AI** (Generative UI with Claude Sonnet)
- **Supabase** (PostgreSQL + Auth)
- **Open Food Facts** API
- **Tesseract.js** (OCR for ingredient scanning)
- **html5-qrcode** (Barcode scanning)

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│           Chat-First Frontend           │
│  (barcode scan / ingredient OCR → AI)   │
└────────────────────┬────────────────────┘
                     │
┌────────────────────▼────────────────────┐
│              API Routes                 │
│  /api/analyze/[barcode]  /api/chat      │
│  /api/compare            /api/history   │
└────────────────────┬────────────────────┘
                     │
     ┌───────────────┼───────────────┐
     ▼               ▼               ▼
┌─────────┐   ┌───────────┐   ┌──────────┐
│ Open    │   │ Signal    │   │ Thesys   │
│ Food    │   │ Detection │   │ AI       │
│ Facts   │   │           │   │          │
└─────────┘   └───────────┘   └──────────┘
                     │
                     ▼
┌─────────────────────────────────────────┐
│        Supabase PostgreSQL              │
│     products | scans | preferences      │
└─────────────────────────────────────────┘
```

## ⚙️ Environment Variables

| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | ✅ | Supabase anonymous key |
| `THESYS_API_KEY` | Secret | ✅ | Thesys AI API key |
| `BYTEZ_API_KEY` | Secret | Optional | Bytez AI fallback |
| `OFF_USERNAME` | Secret | Optional | Open Food Facts username |
| `OFF_PASSWORD` | Secret | Optional | Open Food Facts password |

## 📁 Project Structure

```
food-copilot/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── analyze/       # Product analysis endpoint
│   │   │   ├── chat/          # AI chat streaming
│   │   │   ├── compare/       # Product comparison
│   │   │   └── history/       # Scan history
│   │   ├── globals.css        # Global styles
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Main chat interface
│   ├── components/
│   │   ├── AuthModal.tsx      # Login/signup modal
│   │   ├── AuthProvider.tsx   # Auth context
│   │   ├── BarcodeScanner.tsx # Camera barcode scanner
│   │   ├── ErrorBoundary.tsx  # Error handling
│   │   ├── IngredientScanner.tsx # OCR ingredient scanner
│   │   ├── ProductComparison.tsx # Compare products
│   │   ├── ScanHistory.tsx    # User scan history
│   │   ├── ThesysUI.tsx       # Generative UI renderer
│   │   └── UserPreferences.tsx # Dietary preferences
│   └── lib/
│       ├── ai.ts              # AI utilities
│       ├── openfoodfacts.ts   # OFF API client
│       ├── signals.ts         # Ingredient signal detection
│       └── supabase.ts        # Supabase client
├── .env.example               # Environment template
├── supabase-schema.sql        # Database schema
├── vercel.json                # Vercel config
└── package.json
```

## 💡 Design Principles

- **AI is the interface** — not a feature bolted on
- **Reasoning over data** — synthesis, not raw display
- **Honest uncertainty** — transparent about what we don't know
- **Minimal cognitive load** — one clear answer, not information overload

## 📊 Free Tier Limits

| Service | Free Tier | Usage |
|---------|-----------|-------|
| **Vercel** | 100GB bandwidth/month | Hosting |
| **Supabase** | 500MB DB, 50K auth users | Database + Auth |
| **Open Food Facts** | Unlimited | Product data |
| **Thesys AI** | Check at signup | AI analysis |

## 📄 License

MIT
