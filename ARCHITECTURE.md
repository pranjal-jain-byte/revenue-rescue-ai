# Architecture — RevenueRescue AI

## System Overview

RevenueRescue AI is a safety-controlled autonomous revenue recovery agent.

## Critical Design Principle

```
❌ FORBIDDEN:
  LLM → Direct Payment Execution

✅ REQUIRED:
  LLM → Recommendation → Validation → Policy Engine → Executor → Payment Provider
```

The LLM (Gemini) is ONLY allowed to:
1. Analyze structured transaction/customer context
2. Produce a validated JSON recommendation

The LLM is NEVER allowed to:
1. Execute payment actions
2. Bypass policy checks
3. Access the payment provider directly

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          NEXT.JS APP                             │
├───────────────────────┬─────────────────────────────────────────┤
│      FRONTEND         │            BACKEND API ROUTES            │
│  ─────────────────    │   ─────────────────────────────────     │
│  /dashboard           │   GET  /api/dashboard                   │
│  /cases               │   GET  /api/recovery-cases              │
│  /cases/[id]          │   GET  /api/recovery-cases/[id]         │
│  /simulation          │   POST /api/recovery-cases/[id]/recover │
│  /audit               │   POST /api/simulations                 │
│  /policies            │   GET  /api/audit-events                │
│  /escalations         │   GET/PUT /api/policies                 │
└───────────────────────┴─────────────────────────────────────────┘
                                    │
                    ┌───────────────▼───────────────┐
                    │        AGENT ENGINE             │
                    │  lib/agent/workflow.ts          │
                    │  ─────────────────────────     │
                    │  1. Detector                    │
                    │  2. Classifier                  │
                    │  3. Recovery Scorer (ML)        │
                    │  4. AI Diagnosis Engine         │
                    │  5. Action Selector             │
                    │  6. Policy Engine ← GATE        │
                    │  7. Action Executor             │
                    └───────┬───────────────┬─────────┘
                            │               │
            ┌───────────────▼──┐   ┌────────▼────────────┐
            │   AI LAYER        │   │   PAYMENT LAYER      │
            │  lib/ai/          │   │   lib/providers/     │
            │  ─────────────   │   │   ──────────────     │
            │  Gemini API       │   │   MockProvider       │
            │  (OpenAI compat)  │   │   RazorpayProvider   │
            │  Validated JSON   │   │   (Test Mode only)   │
            │  Safe fallback    │   └──────────────────────┘
            └───────────────────┘
                            │
            ┌───────────────▼────────────────┐
            │         DATABASE LAYER          │
            │   PostgreSQL + Prisma ORM       │
            │   ─────────────────────────    │
            │   recovery_cases                │
            │   agent_decisions               │
            │   recovery_actions              │
            │   policy_rules                  │
            │   audit_events                  │
            │   simulation_runs               │
            └────────────────────────────────┘
```

## Agent Workflow (Detailed)

```
EVENT INGESTED
     │
     ▼
┌──────────────────────────────────────────┐
│  STEP 1: DETECT                          │
│  - Load recovery case from DB            │
│  - Identify revenue at risk              │
│  - Log: REVENUE_DETECTED                 │
└────────────────────┬─────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────┐
│  STEP 2: CLASSIFY                        │
│  - Determine event type                  │
│  - Assign risk level                     │
│  - Log: CASE_CLASSIFIED                  │
└────────────────────┬─────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────┐
│  STEP 3: SCORE (ML MODEL)                │
│  - Compute recovery probability          │
│  - Explainable feature weights           │
│  - No black box                          │
│  - Log: RECOVERY_SCORED                  │
└────────────────────┬─────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────┐
│  STEP 4: AI DIAGNOSIS (Gemini)           │
│  - Feed structured context               │
│  - Request JSON recommendation           │
│  - Validate schema strictly              │
│  - If AI fails → safe deterministic      │
│    fallback, NO action taken             │
│  - Log: DIAGNOSIS_COMPLETE               │
│        or AI_FALLBACK_ACTIVATED          │
└────────────────────┬─────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────┐
│  STEP 5: POLICY ENGINE GATE ← CRITICAL   │
│  Deterministic rules evaluated:          │
│  - MAX_RETRY_ATTEMPTS                    │
│  - HIGH_VALUE_THRESHOLD                  │
│  - MIN_RECOVERY_PROBABILITY              │
│  - SUSPICIOUS_AUTO_BLOCK                 │
│  - RESPECT_OPT_OUT                       │
│  - MAX_DAILY_CONTACTS                    │
│  - MAX_ESCALATION_VALUE                  │
│  LLM CANNOT BYPASS THIS GATE            │
│  Log: POLICY_APPROVED / BLOCKED /        │
│       ESCALATE                           │
└──────┬─────────────┬──────────┬──────────┘
       │             │          │
    APPROVED      BLOCKED    ESCALATE
       │             │          │
       ▼             ▼          ▼
  ┌─────────┐  ┌─────────┐ ┌─────────┐
  │ EXECUTE │  │  AUDIT  │ │ HUMAN   │
  │ ACTION  │  │  BLOCK  │ │ QUEUE   │
  └────┬────┘  └─────────┘ └─────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│  STEP 6: EXECUTE (Payment Provider)      │
│  - MockPaymentProvider (default)         │
│  - RazorpayTestProvider (if configured)  │
│  - Observe result                        │
│  - Log: ACTION_EXECUTED                  │
│        RECOVERY_SUCCESS / ACTION_FAILED  │
└────────────────────┬─────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────┐
│  STEP 7: AUDIT                           │
│  - Every step immutably logged           │
│  - Includes: agent, timestamp, metadata  │
│    previous/new state, result            │
└──────────────────────────────────────────┘
```

## UI & Demo Infrastructure

The frontend (`app/cases/[id]/page.tsx`) provides four specialized tabs:
1. **Overview**: Financial and customer context.
2. **Investigation Timeline**: A chronological, immutable event stream parsed from the database audit trail.
3. **Decision Graph**: An interactive visualization of the actual agent workflow (Detect → Diagnose → Predict → Decide → Gate → Execute → Observe), allowing judges to inspect inputs/outputs at every stage.
4. **Reliability Lab**: A failure injection control panel. It explicitly demonstrates how the system safely handles AI unavailability, hallucinated JSON, payment timeouts, duplicate idempotency conflicts, and suspicious transactions without bypassing the Policy Engine.

## Policy Engine Design

The policy engine is:
- **Deterministic** — no randomness, no AI
- **Audited** — every decision logged
- **Configurable** — editable from admin UI
- **LLM-independent** — cannot be overridden by AI output
- **Tested** — 15+ unit tests covering all rules

## Recovery Probability Model

Type: Feature-weighted logistic regression  
Implementation: TypeScript (no external ML library)  
Features: 8 documented, weighted features  
Output: Probability [0.03, 0.97] + explainability  
Evaluation: Train/test split on synthetic data  

## Payment Provider Abstraction

```typescript
interface PaymentProvider {
  retryPayment(params): Promise<PaymentAttemptResult>
  sendPaymentLink(params): Promise<{ success: boolean; linkId?: string }>
  isTestMode: boolean
}
```

Implementations:
- `MockPaymentProvider` — deterministic, seeded by case ID
- `RazorpayTestProvider` — real Razorpay API, TEST MODE only

Safety check rejects any non-test Razorpay key.
