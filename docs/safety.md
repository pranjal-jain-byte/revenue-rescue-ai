# Safety Architecture — RevenueRescue AI

## Core Safety Guarantee

**The AI model NEVER directly executes financial actions.**

This is not a design aspiration — it is an architectural constraint enforced at every layer.

## The Safety Stack

```
Layer 1: LLM Isolation
  - LLM receives only structured, validated inputs
  - LLM produces only structured JSON recommendations
  - LLM output is validated before any execution

Layer 2: Schema Validation
  - All LLM output is parsed against a strict JSON schema
  - Any missing or invalid field → immediate fallback

Layer 3: Policy Engine Gate
  - Deterministic rules evaluated independently of LLM
  - Rules are database-configurable, not hardcoded
  - LLM cannot "instruct" the policy engine

Layer 4: Audit Trail
  - Every decision, block, and action is immutably logged
  - Timestamp, agent, before/after state recorded
  - Cannot be modified after writing

Layer 5: Payment Provider Safety
  - Only TEST MODE Razorpay keys accepted
  - API key format validated before use
  - Mock provider is the default (zero external calls)
```

## Failure Mode Analysis

| Failure | System Response |
|---|---|
| AI times out (>10s) | Fall back to deterministic diagnosis. Log AI_FALLBACK_ACTIVATED. No action until policy approves. |
| AI returns invalid JSON | Validate fails. Deterministic fallback. Log aiFailed=true. |
| AI recommends impossible action | Policy engine rejects. BLOCKED logged. |
| Policy rule not found in DB | Use hardcoded safe defaults. |
| Payment provider fails | Log error. Case status → FAILED. No retry without new trigger. |
| Database unreachable | API returns 500. No action taken. |

## Reliability Lab (Failure Injection)

To prove these safety guarantees, the UI includes a **Reliability Lab** tab where judges can inject failures on demand:
- **`AI_UNAVAILABLE` / `INVALID_AI_RESPONSE`**: Proves that AI failure results in a deterministic safe fallback, not an unhandled exception or risky action.
- **`PAYMENT_TIMEOUT` / `DUPLICATE_EVENT`**: Proves that idempotency locks prevent blind retries and double-charging during network partitions or race conditions.
- **`SUSPICIOUS_TRANSACTION`**: Proves that the policy engine automatically intercepts and blocks risky cases regardless of the LLM's recommendation.

## Policy Engine Rules (All Enforced Deterministically)

Every rule is evaluated by the policy engine with no AI involvement:

1. **MAX_RETRY_ATTEMPTS** — Prevents infinite retry loops
2. **HIGH_VALUE_THRESHOLD** — Protects merchant from large unintended transactions
3. **MIN_RECOVERY_PROBABILITY** — Stops wasting resources on hopeless cases
4. **MAX_DAILY_CONTACTS** — Prevents customer harassment
5. **SUSPICIOUS_AUTO_BLOCK** — Fraud protection
6. **RESPECT_OPT_OUT** — Regulatory compliance
7. **MAX_ESCALATION_VALUE** — Forces human review for large amounts
8. **RECOVERY_WINDOW_HOURS** — Time-bounded recovery
9. **MAX_DISCOUNT_PERCENT** — Prevents excessive discounting
10. **REQUIRE_AUDIT_LOG** — Enforces observability

## Audit Trail Design

Every audit event includes:
- `timestamp` — Exact time
- `event` — Machine-readable event name
- `agent` — Which system component acted
- `previousState` — Before state
- `newState` — After state
- `metadata` — All relevant context
- `caseId` — Links to recovery case

Events are insert-only (no update/delete in agent code).

## What the LLM Cannot Do

- ❌ Directly call payment APIs
- ❌ Modify policy rules
- ❌ Skip the policy engine
- ❌ Override a BLOCKED decision
- ❌ Execute more than one action per workflow step
- ❌ Access customer PII beyond what's in the prompt context
- ❌ Generate or modify case IDs
- ❌ Read or write audit events
