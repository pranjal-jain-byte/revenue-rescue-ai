/**
 * AI Diagnosis Engine
 *
 * Uses Gemini (via OpenAI-compatible API) to interpret transaction failures.
 * The LLM only produces RECOMMENDATIONS. It NEVER executes financial actions.
 *
 * Safety guarantees:
 * - All LLM output is parsed into a strict JSON schema
 * - If the LLM fails, times out, or produces invalid output → safe fallback
 * - Fallback uses deterministic rule-based diagnosis
 * - The policy engine is ALWAYS consulted after this — regardless of AI output
 */

import { logger } from '@/lib/utils/logger';
import type { ActionType } from '@/lib/agent/policy-engine';

export interface DiagnosisInput {
  caseId: string;
  eventType: string;
  failureReason: string | null;
  paymentMethod: string | null;
  amount: number;
  currency: string;
  attemptCount: number;
  customerSuccessfulPayments: number;
  customerFailedPayments: number;
  customerLifetimeValue: number;
  previousRecoveries: number;
  isSuspicious: boolean;
  recoveryProbability: number;
}

export interface DiagnosisOutput {
  rootCause: string;
  recoveryProbability: number;
  recommendedAction: ActionType;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  reason: string;
  shouldEscalate: boolean;
  aiUsed: boolean;
  aiFailed: boolean;
  fallbackReason?: string;
}

// ── Fallback: deterministic rule-based diagnosis ──────────────────────────────

function fallbackDiagnosis(input: DiagnosisInput): DiagnosisOutput {
  let rootCause = input.failureReason ?? 'UNKNOWN';
  let recommendedAction: ActionType = 'SEND_PAYMENT_REMINDER';
  let reason = 'Using rule-based fallback diagnosis (AI unavailable).';
  let confidence: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
  let shouldEscalate = false;

  if (input.isSuspicious) {
    recommendedAction = 'ESCALATE_TO_HUMAN';
    reason = 'Transaction flagged as suspicious. Human review required.';
    confidence = 'HIGH';
    shouldEscalate = true;
  } else if (input.amount > 100000) {
    recommendedAction = 'ESCALATE_TO_HUMAN';
    reason = 'High-value transaction requires human approval.';
    confidence = 'HIGH';
    shouldEscalate = true;
  } else if (input.recoveryProbability < 0.20) {
    recommendedAction = 'STOP_RECOVERY';
    reason = 'Recovery probability too low for automated intervention.';
    confidence = 'HIGH';
  } else if (input.attemptCount >= 2) {
    recommendedAction = 'OFFER_ALTERNATE_PAYMENT_METHOD';
    reason = 'Multiple retries failed. Offering alternate payment method.';
    confidence = 'MEDIUM';
  } else if (
    input.failureReason === 'NETWORK_TIMEOUT' ||
    input.failureReason === 'INSUFFICIENT_BALANCE'
  ) {
    recommendedAction = 'RETRY_PAYMENT';
    reason = 'Temporary failure — retry likely to succeed based on failure pattern.';
    confidence = 'HIGH';
  } else if (input.eventType === 'CHECKOUT_ABANDONED') {
    recommendedAction = 'SEND_CHECKOUT_RECOVERY_MESSAGE';
    reason = 'Customer abandoned checkout — send recovery nudge.';
    confidence = 'MEDIUM';
  } else if (input.recoveryProbability > 0.60) {
    recommendedAction = 'RETRY_PAYMENT';
    reason = 'High recovery probability — automated retry recommended.';
    confidence = 'HIGH';
  } else {
    recommendedAction = 'SEND_PAYMENT_REMINDER';
    reason = 'Moderate failure — payment reminder is the safest intervention.';
    confidence = 'MEDIUM';
  }

  if (input.failureReason === 'CARD_EXPIRED' || input.failureReason === 'INVALID_CVV') {
    recommendedAction = 'OFFER_ALTERNATE_PAYMENT_METHOD';
    reason = 'Card issue cannot be resolved by retry — suggest alternate method.';
    confidence = 'HIGH';
    rootCause = input.failureReason;
  }

  if (input.failureReason === 'TRANSACTION_NOT_PERMITTED' || input.failureReason === 'DO_NOT_HONOR') {
    recommendedAction = 'ESCALATE_TO_HUMAN';
    reason = 'Bank has declined permanently — human review needed.';
    confidence = 'HIGH';
    shouldEscalate = true;
  }

  return {
    rootCause,
    recoveryProbability: input.recoveryProbability,
    recommendedAction,
    confidence,
    reason,
    shouldEscalate,
    aiUsed: false,
    aiFailed: false,
    fallbackReason: 'AI unavailable — using deterministic rule-based diagnosis.',
  };
}

// ── JSON schema validation ─────────────────────────────────────────────────────

const VALID_ACTIONS: ActionType[] = [
  'RETRY_PAYMENT',
  'SEND_PAYMENT_REMINDER',
  'OFFER_ALTERNATE_PAYMENT_METHOD',
  'SEND_CHECKOUT_RECOVERY_MESSAGE',
  'ESCALATE_TO_HUMAN',
  'STOP_RECOVERY',
];

function validateLLMOutput(raw: unknown): DiagnosisOutput | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;

  const rootCause = typeof obj.root_cause === 'string' ? obj.root_cause : null;
  const recoveryProb = typeof obj.recovery_probability === 'number' ? obj.recovery_probability : null;
  const action = obj.recommended_action as ActionType;
  const confidence = obj.confidence as 'LOW' | 'MEDIUM' | 'HIGH';
  const reason = typeof obj.reason === 'string' ? obj.reason : null;
  const shouldEscalate = typeof obj.should_escalate === 'boolean' ? obj.should_escalate : false;

  if (!rootCause || recoveryProb === null || !VALID_ACTIONS.includes(action)) {
    return null;
  }

  if (!['LOW', 'MEDIUM', 'HIGH'].includes(confidence)) return null;

  return {
    rootCause,
    recoveryProbability: Math.max(0, Math.min(1, recoveryProb)),
    recommendedAction: action,
    confidence,
    reason: reason ?? 'No reason provided.',
    shouldEscalate,
    aiUsed: true,
    aiFailed: false,
  };
}

// ── Main diagnosis function ───────────────────────────────────────────────────

export async function diagnoseCase(input: DiagnosisInput): Promise<DiagnosisOutput> {
  const apiKey = process.env.GEMINI_API_KEY;
  const baseUrl = process.env.AI_BASE_URL ?? 'https://generativelanguage.googleapis.com/v1beta/openai';
  const model = process.env.AI_MODEL ?? 'gemini-1.5-flash';

  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    logger.warn('AI diagnosis skipped: no API key configured', { caseId: input.caseId });
    return { ...fallbackDiagnosis(input), fallbackReason: 'AI API key not configured.' };
  }

  const prompt = `You are a fintech revenue recovery AI agent. Analyze this payment failure case and recommend an action.

TRANSACTION CONTEXT:
- Event Type: ${input.eventType}
- Failure Reason: ${input.failureReason ?? 'unknown'}
- Payment Method: ${input.paymentMethod ?? 'unknown'}
- Amount: ₹${input.amount.toLocaleString('en-IN')} ${input.currency}
- Previous Attempts: ${input.attemptCount}
- Suspicious: ${input.isSuspicious}

CUSTOMER CONTEXT:
- Successful Payments: ${input.customerSuccessfulPayments}
- Failed Payments: ${input.customerFailedPayments}
- Previous Recoveries: ${input.previousRecoveries}
- Lifetime Value: ₹${input.customerLifetimeValue.toLocaleString('en-IN')}
- Recovery Probability (pre-computed): ${(input.recoveryProbability * 100).toFixed(1)}%

AVAILABLE ACTIONS:
- RETRY_PAYMENT: Automatically retry the payment
- SEND_PAYMENT_REMINDER: Send a reminder to the customer
- OFFER_ALTERNATE_PAYMENT_METHOD: Suggest a different payment method
- SEND_CHECKOUT_RECOVERY_MESSAGE: Send cart recovery message
- ESCALATE_TO_HUMAN: Flag for human review
- STOP_RECOVERY: Cease all recovery attempts

Respond ONLY with a valid JSON object in exactly this schema (no markdown, no explanation outside JSON):
{
  "root_cause": "string describing the root cause",
  "recovery_probability": 0.00 to 1.00,
  "recommended_action": "one of the AVAILABLE ACTIONS above",
  "confidence": "LOW" | "MEDIUM" | "HIGH",
  "reason": "concise explanation of your recommendation",
  "should_escalate": true | false
}`;

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 512,
      }),
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Empty AI response');
    }

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in AI response');
    }

    const parsed: unknown = JSON.parse(jsonMatch[0]);
    const validated = validateLLMOutput(parsed);

    if (!validated) {
      logger.warn('AI output failed validation', { caseId: input.caseId, metadata: { raw: jsonMatch[0] } });
      return {
        ...fallbackDiagnosis(input),
        aiFailed: true,
        aiUsed: true,
        fallbackReason: 'AI produced invalid JSON schema — falling back to deterministic rules.',
      };
    }

    logger.info('AI diagnosis successful', {
      caseId: input.caseId,
      component: 'AI_DIAGNOSIS',
      metadata: { action: validated.recommendedAction, confidence: validated.confidence },
    });

    return validated;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error('AI diagnosis failed', {
      caseId: input.caseId,
      component: 'AI_DIAGNOSIS',
      error: errMsg,
    });

    return {
      ...fallbackDiagnosis(input),
      aiFailed: true,
      aiUsed: true,
      fallbackReason: `AI unavailable: ${errMsg}. Using deterministic fallback — no financial action executed without policy approval.`,
    };
  }
}
