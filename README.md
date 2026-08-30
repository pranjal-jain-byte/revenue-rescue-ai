# RevenueRescue AI

> **Detect. Diagnose. Recover. Stop.**
>
> An autonomous, safety-controlled AI revenue recovery agent for merchants.

---

## ⚠️ Important Disclaimer

> **All financial transactions in this prototype use Razorpay Test Mode or a mock provider. No real money is moved. All customer and transaction data is synthetic.**

---

## 🏆 Razorpay Buildathon 2024 — Track 03: AI Revenue Recovery

RevenueRescue AI is a production-grade fintech agentic system that:

- **Detects** revenue at risk: failed payments, abandoned checkouts, subscription failures, overdue invoices
- **Diagnoses** root causes using Gemini AI with deterministic fallback
- **Predicts** recovery probability with a transparent, explainable scoring model
- **Decides** the optimal intervention strategy
- **Gates** every action through a deterministic policy engine (the LLM NEVER bypasses this)
- **Executes** bounded recovery actions via Razorpay Test Mode or a mock provider
- **Observes** results and records a complete audit trail
- **Measures** actual revenue recovered (not theoretical projections)

---

## 📊 Results (1,000 Synthetic Cases)

| Metric | Value |
|---|---|
| Revenue at Risk | ₹18.42L |
| Revenue Recovered | ~₹11.76L |
| Recovery Rate | ~63.9% |
| Actions Blocked by Policy | ~87 |
| Human Escalations | ~42 |
| Avg Recovery Time | ~420ms |

> These metrics are from a synthetic dataset. Real-world performance will differ. See [docs/evaluation.md](docs/evaluation.md).

---

## 🏗 Architecture

```
EVENT (Payment Failed / Checkout Abandoned / etc.)
 ↓
[DETECT] Revenue at risk identified
 ↓
[CLASSIFY] Event type + context gathered
 ↓
[DIAGNOSE] Gemini AI analyzes structured context → validated JSON
 ↓
[SCORE] Recovery probability (logistic regression model, explainable)
 ↓
[SELECT] Action selection based on diagnosis + probability
 ↓
[GATE] ← POLICY ENGINE (deterministic, LLM cannot bypass this)
 ↓ APPROVED        ↓ BLOCKED            ↓ ESCALATE
[EXECUTE]      [AUDIT + BLOCK]    [HUMAN QUEUE]
 ↓
[OBSERVE] Result recorded
 ↓
[AUDIT] Every step immutably logged
 ↓
RECOVERED / STOPPED / ESCALATED
```

**Critical architectural guarantee:**

```
❌ NEVER:  LLM → Direct Payment API
✅ ALWAYS: LLM → Recommendation → Policy Engine → Executor → Payment Provider
```

---

## 🤖 Agent Actions

| Action | Description |
|---|---|
| `RETRY_PAYMENT` | Retry the failed payment via provider |
| `SEND_PAYMENT_REMINDER` | Send payment link to customer |
| `OFFER_ALTERNATE_PAYMENT_METHOD` | Suggest UPI/card/wallet alternative |
| `SEND_CHECKOUT_RECOVERY_MESSAGE` | Abandoned cart recovery nudge |
| `ESCALATE_TO_HUMAN` | Flag for manual review |
| `STOP_RECOVERY` | Cease all recovery attempts |

---

## 🛡 Policy Engine Guardrails

The policy engine enforces 7 configurable rules that the LLM cannot bypass:

1. **MAX_RETRY_ATTEMPTS** — Max payment retries (default: 2)
2. **HIGH_VALUE_THRESHOLD** — Amount requiring human approval (default: ₹50,000)
3. **MIN_RECOVERY_PROBABILITY** — Minimum probability to attempt recovery (default: 20%)
4. **MAX_DAILY_CONTACTS** — Max contacts per customer per day (default: 3)
5. **SUSPICIOUS_AUTO_BLOCK** — Auto-block suspicious transactions
6. **RESPECT_OPT_OUT** — Never contact opted-out customers
7. **MAX_ESCALATION_VALUE** — Auto-escalate above threshold (default: ₹1L)

All rules are configurable from the `/policies` admin page.

---

## 💰 Razorpay Integration

- Uses **Razorpay TEST MODE** (`rzp_test_...` keys) when credentials are provided
- Falls back to **deterministic mock provider** automatically if no credentials
- Safety check prevents live API keys from being used
- Mock provider is seeded by case ID for reproducible demos

---

## 🎮 Recovery Simulation

Run the agent over 100, 500, or 1,000 synthetic cases:

1. Navigate to `/simulation`
2. Select case count
3. Click "Run Recovery Simulation"
4. Watch the agent workflow execute step-by-step
5. See recovered revenue, blocked actions, and escalations

---

## 📈 Evaluation Methodology

The recovery probability scorer uses a logistic-regression-style model with transparent, explainable features:

| Feature | Impact |
|---|---|
| Failure reason | High |
| Payment method | Low |
| Historical success rate | Medium |
| Previous recoveries | Medium |
| Transaction amount | Negative |
| Retry count | Negative |
| Suspicious flag | Strong negative |

**Model metrics on synthetic test split:**
- Precision: 0.74
- Recall: 0.71
- F1: 0.72
- ROC-AUC: 0.81

> ⚠️ These metrics are from synthetic data. Do not extrapolate to production without real data.

---

## 🚀 Local Setup

### Prerequisites

- Node.js 18+
- Gemini API key (optional — safe fallback works without it)

### 1. Clone and install

```bash
git clone <repo>
cd revenue-rescue-ai
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
# Edit .env.local with your values
```

### 3. Initialize database

```bash
npm run db:push     # Apply schema
npm run db:seed     # Seed 1,000+ synthetic cases
```

### 4. Start the app

```bash
npm run dev
# Open http://localhost:3000
```

---

## 🔑 Environment Variables

| Variable | Description | Required |
|---|---|---|
| `DATABASE_URL` | SQLite connection string (e.g. `file:./prisma/dev.db`) | ✅ |
| `GEMINI_API_KEY` | Gemini API key for AI diagnosis | ❌ (fallback) |
| `AI_BASE_URL` | OpenAI-compatible base URL | ❌ |
| `AI_MODEL` | Model name | ❌ |
| `PAYMENT_PROVIDER` | `mock` or `razorpay` | ❌ |
| `RAZORPAY_KEY_ID` | Razorpay test key | ❌ |
| `RAZORPAY_KEY_SECRET` | Razorpay test secret | ❌ |

---

## 🎯 3-Minute Judge Demo Flow

1. Open `/dashboard` — see total revenue at risk
2. Go to `/cases` and open a failed payment case
3. Show the **Overview** tab — explain the explainable recovery probability score
4. Open the **Decision Graph** tab — walk through the deterministic agent workflow (Detect → Diagnose → Predict → Decide → Gate → Execute → Observe)
5. Show the **Policy Gate** node — prove the LLM is gated by deterministic limits
6. Open the **Investigation Timeline** tab — show the immutable audit trail of past actions
7. Open the **Reliability Lab** tab:
   - Trigger `AI_UNAVAILABLE` — demonstrate deterministic safe fallback.
   - Trigger `PAYMENT_TIMEOUT` — demonstrate idempotency preventing blind retries.
   - Trigger `DUPLICATE_EVENT` — show the system safely blocking duplicate financial actions.
8. Show the resulting audit trail in the **Timeline** tab for full observability.

## 🔒 Security

- No API keys committed to repository
- All secrets via environment variables
- LLM output validated before any execution
- Policy engine is deterministic and LLM-independent
- Mock provider by default (no accidental live transactions)
- Razorpay safety check rejects non-test-mode keys

---

## ⚙️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, TypeScript, Tailwind CSS, Recharts |
| Backend | Next.js API Routes |
| Database | SQLite + Prisma ORM |
| AI | Gemini (via OpenAI-compatible API) |
| ML | Logistic regression (custom, explainable) |
| Payment | Razorpay Test Mode / Mock Provider |

---

## 📚 Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — Full system design
- [SETUP.md](SETUP.md) — Detailed setup guide
- [docs/safety.md](docs/safety.md) — Safety guarantees
- [docs/evaluation.md](docs/evaluation.md) — ML evaluation methodology

---

## ⚠️ Limitations

1. Recovery probability model trained on synthetic data — real-world accuracy unknown
2. Simulation uses simplified action outcomes — production requires real payment webhooks
3. AI diagnosis is best-effort — deterministic fallback is always available
4. No real-time webhook integration — events are seeded/triggered manually
5. No authentication in demo mode

---

## 🔮 Future Improvements

- Real-time Razorpay webhook integration
- Production ML model trained on merchant's historical data
- Customer segmentation for personalized recovery
- Multi-merchant isolation
- A/B testing for recovery strategies
- LLM fine-tuning on recovery outcomes
- Real-time notification system
