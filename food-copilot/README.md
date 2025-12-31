# Food Co-Pilot

AI-native consumer health co-pilot for understanding food labels. Chat-first interface where AI reasons over real ingredient data to provide calm, honest guidance.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Copy environment template and fill in your values
cp .env.example .env.local

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 📦 Deployment to Vercel (Free Tier)

### Prerequisites
1. GitHub account
2. Vercel account (free at [vercel.com](https://vercel.com))
3. Supabase project (free at [supabase.com](https://supabase.com))
4. Thesys API key (from [thesys.dev](https://thesys.dev))

### Step 1: Set Up Supabase
1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the contents of `supabase-schema.sql`
3. Go to Project Settings → API to get your URL and anon key
4. Enable Email auth in Authentication → Providers

### Step 2: Deploy to Vercel
1. Push your code to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your GitHub repository
4. Add environment variables in Vercel dashboard:

| Variable | Type | Required |
|----------|------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | ✅ |
| `THESYS_API_KEY` | Secret | ✅ |
| `BYTEZ_API_KEY` | Secret | Optional |
| `OFF_USERNAME` | Secret | Optional |
| `OFF_PASSWORD` | Secret | Optional |

5. Click "Deploy"

### Step 3: Verify
- Test barcode scanning with: `3017620422003` (Nutella)
- Test AI chat functionality
- Test user authentication

## 🗄️ Database Setup

Run the SQL schema in your Supabase SQL Editor:

1. Go to your Supabase project dashboard
2. Open SQL Editor
3. Copy contents of `supabase-schema.sql`
4. Run the query

## 🏗️ Architecture

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
│ Open    │   │ Signal    │   │ Thesys   │
│ Food    │   │ Detection │   │ AI       │
│ Facts   │   │           │   │          │
└────┬────┘   └───────────┘   └──────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│        Supabase PostgreSQL              │
│  products | ingredients | sessions      │
└─────────────────────────────────────────┘
```

## ⚙️ Environment Variables

Copy `.env.example` to `.env.local` and configure:

```bash
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# AI Services
THESYS_API_KEY=your-thesys-key
BYTEZ_API_KEY=your-bytez-key  # Optional backup

# Open Food Facts (Optional)
OFF_USERNAME=your-username
OFF_PASSWORD=your-password
```

## 🔄 How It Works

1. **User enters barcode** → System fetches from Open Food Facts
2. **Signal detection** → Deterministic pattern matching (emulsifiers, NOVA markers, etc.)
3. **AI reasoning** → AI synthesizes signals into human-readable insight
4. **Honest communication** → Uncertainty flagged, no fear language

## 🧪 Sample Barcodes

- `3017620422003` - Nutella
- `5000112637922` - Coca-Cola
- `7622210449283` - Oreo
- `8000500310427` - Ferrero Rocher

## 💡 Design Principles

- **AI is the interface**, not a feature
- **Reasoning over data**, not data display
- **Honest uncertainty** communication
- **Minimal cognitive load**

## ❌ What This Is NOT

- Nutrition scanner
- Database browser
- Dashboard app
- Feature-heavy health tracker

## 🛠️ Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Supabase (PostgreSQL + Auth)
- Thesys AI (Generative UI)
- Open Food Facts API

## 📁 Project Structure

```
food-copilot/
├── src/
│   ├── app/
│   │   ├── api/           # API routes
│   │   │   ├── analyze/   # Product analysis
│   │   │   ├── chat/      # AI chat
│   │   │   ├── compare/   # Product comparison
│   │   │   └── history/   # Scan history
│   │   ├── layout.tsx     # Root layout
│   │   └── page.tsx       # Home page
│   ├── components/        # React components
│   └── lib/               # Utilities & services
├── .env.example           # Environment template
├── vercel.json            # Vercel configuration
├── supabase-schema.sql    # Database schema
└── package.json
```

## 📊 Free Tier Limits

| Service | Free Tier | Usage |
|---------|-----------|-------|
| **Vercel** | 100GB bandwidth/month | Hosting |
| **Supabase** | 500MB DB, 50K auth users | Database + Auth |
| **Open Food Facts** | Unlimited | Product data |
| **Thesys AI** | Check at signup | AI analysis |

## 📄 License

MIT
