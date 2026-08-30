# Setup Guide — RevenueRescue AI

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 18+ |
| npm | 9+ |
| Docker | 24+ (for PostgreSQL) |
| PostgreSQL | 14+ (optional if using Docker) |

## Quick Start (5 minutes)

### Step 1: Install dependencies

```bash
npm install
```

### Step 2: Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Required
DATABASE_URL="postgresql://revenue_rescue:revenue_rescue_dev@localhost:5432/revenue_rescue_ai"

# Optional — Gemini AI (safe fallback works without this)
GEMINI_API_KEY="your_key_here"
AI_BASE_URL="https://generativelanguage.googleapis.com/v1beta/openai"
AI_MODEL="gemini-1.5-flash"

# Optional — Razorpay Test Mode
# RAZORPAY_KEY_ID="rzp_test_..."
# RAZORPAY_KEY_SECRET="..."
```

### Step 3: Start PostgreSQL

```bash
docker compose up -d
```

Verify it's running:
```bash
docker compose ps
```

### Step 4: Initialize database

```bash
# Apply schema
npm run db:push

# Seed with 1,000+ synthetic cases
npm run db:seed
```

### Step 5: Start development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Database Commands

| Command | Description |
|---|---|
| `npm run db:push` | Apply schema to database |
| `npm run db:seed` | Seed synthetic data |
| `npm run db:reset` | Reset + reseed (destructive) |
| `npm run db:studio` | Open Prisma Studio |

## Demo Flow

1. Open `/dashboard` — see executive KPIs
2. Go to `/simulation` — click "Run Recovery Simulation"
3. Select 1,000 cases and run
4. Open `/cases` — explore the revenue at risk table
5. Click a PAYMENT_FAILED case — see AI analysis
6. Click "Run Recovery Agent" — see either SUCCESS or BLOCKED
7. Go to `/audit` — see full event timeline
8. Go to `/policies` — see/edit guardrail rules
9. Go to `/escalations` — see high-value cases

## Running Tests

```bash
npx tsx tests/policy-engine.test.ts
```

## Troubleshooting

**Prisma errors after schema change:**
```bash
npm run db:push
```

**Database connection failed:**
```bash
docker compose up -d
# Wait 10 seconds for Postgres to initialize
npm run db:push
```

**AI diagnosis not working:**
- Check `GEMINI_API_KEY` in `.env.local`
- System will fall back to deterministic rules automatically

**Mock provider vs Razorpay:**
- Default: mock provider (always works)
- Set `PAYMENT_PROVIDER=razorpay` with valid test keys to use Razorpay

## Production Notes

This is a prototype. For production:
1. Add authentication
2. Configure real Razorpay webhooks
3. Train ML model on real merchant data
4. Add rate limiting to APIs
5. Set up proper log aggregation
6. Add database connection pooling (e.g., PgBouncer)
