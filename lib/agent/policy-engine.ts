/**
 * Policy Engine — Deterministic Guardrails
 *
 * CRITICAL DESIGN PRINCIPLE:
 * The LLM NEVER directly executes financial actions.
 * Every recommended action MUST pass through this policy engine first.
 * This engine uses only deterministic rules — no AI involved.
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/utils/logger';

export type ActionType =
  | 'RETRY_PAYMENT'
  | 'SEND_PAYMENT_REMINDER'
  | 'OFFER_ALTERNATE_PAYMENT_METHOD'
  | 'SEND_CHECKOUT_RECOVERY_MESSAGE'
  | 'ESCALATE_TO_HUMAN'
  | 'STOP_RECOVERY';

export interface PolicyContext {
  caseId: string;
  customerId: string;
  amount: number;
  eventType: string;
  failureReason: string | null;
  attemptCount: number;
  recoveryProbability: number;
  isSuspicious: boolean;
  customerOptedOut: boolean;
  dailyContactCount: number;
  caseStatus: string;
}

export interface PolicyResult {
  decision: 'APPROVED' | 'BLOCKED' | 'ESCALATE';
  reason: string;
  ruleTriggered: string | null;
  appliedRules: string[];
}

// In-memory cache for policy rules (refreshed on each workflow run)
let policyCache: Record<string, string> | null = null;
let policyCacheTs = 0;
const CACHE_TTL_MS = 30_000;

async function getPolicies(): Promise<Record<string, string>> {
  if (policyCache && Date.now() - policyCacheTs < CACHE_TTL_MS) {
    return policyCache;
  }
  const rules = await prisma.policyRule.findMany({ where: { isEnabled: true } });
  const map: Record<string, string> = {};
  for (const r of rules) {
    map[r.ruleKey] = r.value;
  }
  policyCache = map;
  policyCacheTs = Date.now();
  return map;
}

export function invalidatePolicyCache(): void {
  policyCache = null;
}

function getNum(rules: Record<string, string>, key: string, fallback: number): number {
  const v = rules[key];
  if (v === undefined) return fallback;
  const n = parseFloat(v);
  return isNaN(n) ? fallback : n;
}

function getBool(rules: Record<string, string>, key: string, fallback: boolean): boolean {
  const v = rules[key];
  if (v === undefined) return fallback;
  return v === 'true';
}

/**
 * Main policy evaluation function.
 * Checks all applicable guardrails deterministically.
 * Returns a PolicyResult with decision, reason, and all applied rules.
 */
export async function evaluatePolicy(
  action: ActionType,
  context: PolicyContext
): Promise<PolicyResult> {
  const rules = await getPolicies();
  const appliedRules: string[] = [];

  const maxRetries = getNum(rules, 'MAX_RETRY_ATTEMPTS', 2);
  const highValueThreshold = getNum(rules, 'HIGH_VALUE_THRESHOLD', 50000);
  const minRecoveryProb = getNum(rules, 'MIN_RECOVERY_PROBABILITY', 0.20);
  const maxDailyContacts = getNum(rules, 'MAX_DAILY_CONTACTS', 3);
  const suspiciousAutoBlock = getBool(rules, 'SUSPICIOUS_AUTO_BLOCK', true);
  const respectOptOut = getBool(rules, 'RESPECT_OPT_OUT', true);
  const maxEscalationValue = getNum(rules, 'MAX_ESCALATION_VALUE', 100000);

  // ── RULE: Suspicious transaction auto-block ─────────────────────────────
  if (suspiciousAutoBlock && context.isSuspicious && action !== 'ESCALATE_TO_HUMAN' && action !== 'STOP_RECOVERY') {
    appliedRules.push('SUSPICIOUS_AUTO_BLOCK');
    logger.warn('Policy BLOCKED: suspicious transaction', { caseId: context.caseId });
    return {
      decision: 'BLOCKED',
      reason: 'Transaction flagged as suspicious. Automatic recovery blocked. Manual review required.',
      ruleTriggered: 'SUSPICIOUS_AUTO_BLOCK',
      appliedRules,
    };
  }

  // ── RULE: Customer opted out ───────────────────────────────────────────
  const contactActions: ActionType[] = [
    'SEND_PAYMENT_REMINDER',
    'SEND_CHECKOUT_RECOVERY_MESSAGE',
    'OFFER_ALTERNATE_PAYMENT_METHOD',
  ];
  if (respectOptOut && context.customerOptedOut && contactActions.includes(action)) {
    appliedRules.push('RESPECT_OPT_OUT');
    logger.warn('Policy BLOCKED: customer opted out', { caseId: context.caseId });
    return {
      decision: 'BLOCKED',
      reason: 'Customer has opted out of marketing communications.',
      ruleTriggered: 'RESPECT_OPT_OUT',
      appliedRules,
    };
  }

  // ── RULE: Max daily contacts ───────────────────────────────────────────
  if (contactActions.includes(action) && context.dailyContactCount >= maxDailyContacts) {
    appliedRules.push('MAX_DAILY_CONTACTS');
    return {
      decision: 'BLOCKED',
      reason: `Maximum daily contact limit reached (${context.dailyContactCount}/${maxDailyContacts}).`,
      ruleTriggered: 'MAX_DAILY_CONTACTS',
      appliedRules,
    };
  }

  // ── RULE: Max retry attempts ───────────────────────────────────────────
  if (action === 'RETRY_PAYMENT' && context.attemptCount >= maxRetries) {
    appliedRules.push('MAX_RETRY_ATTEMPTS');
    logger.warn('Policy BLOCKED: max retries exceeded', {
      caseId: context.caseId,
      metadata: { attemptCount: context.attemptCount, maxRetries }
    });
    return {
      decision: 'BLOCKED',
      reason: `Maximum retry attempts exceeded (${context.attemptCount}/${maxRetries}). No further automatic retries allowed.`,
      ruleTriggered: 'MAX_RETRY_ATTEMPTS',
      appliedRules,
    };
  }

  // ── RULE: Recovery probability too low ────────────────────────────────
  if (
    action === 'RETRY_PAYMENT' &&
    context.recoveryProbability < minRecoveryProb
  ) {
    appliedRules.push('MIN_RECOVERY_PROBABILITY');
    return {
      decision: 'BLOCKED',
      reason: `Recovery probability (${(context.recoveryProbability * 100).toFixed(1)}%) is below minimum threshold (${(minRecoveryProb * 100).toFixed(1)}%).`,
      ruleTriggered: 'MIN_RECOVERY_PROBABILITY',
      appliedRules,
    };
  }

  // ── RULE: High-value auto-escalation ─────────────────────────────────
  if (context.amount > maxEscalationValue && action !== 'ESCALATE_TO_HUMAN' && action !== 'STOP_RECOVERY') {
    appliedRules.push('MAX_ESCALATION_VALUE');
    return {
      decision: 'ESCALATE',
      reason: `Amount (₹${context.amount.toLocaleString('en-IN')}) exceeds auto-escalation threshold (₹${maxEscalationValue.toLocaleString('en-IN')}). Requires human approval.`,
      ruleTriggered: 'MAX_ESCALATION_VALUE',
      appliedRules,
    };
  }

  // ── RULE: High-value cases require human approval ─────────────────────
  if (
    context.amount > highValueThreshold &&
    action === 'RETRY_PAYMENT'
  ) {
    appliedRules.push('HIGH_VALUE_THRESHOLD');
    return {
      decision: 'ESCALATE',
      reason: `Transaction amount (₹${context.amount.toLocaleString('en-IN')}) exceeds high-value threshold (₹${highValueThreshold.toLocaleString('en-IN')}). Escalating for human review.`,
      ruleTriggered: 'HIGH_VALUE_THRESHOLD',
      appliedRules,
    };
  }

  // ── RULE: Case already in terminal state ──────────────────────────────
  const terminalStates = ['RECOVERED', 'STOPPED', 'BLOCKED'];
  if (terminalStates.includes(context.caseStatus) && action !== 'STOP_RECOVERY') {
    appliedRules.push('TERMINAL_STATE');
    return {
      decision: 'BLOCKED',
      reason: `Case is already in terminal state: ${context.caseStatus}. No further actions allowed.`,
      ruleTriggered: 'TERMINAL_STATE',
      appliedRules,
    };
  }

  // ── All rules passed: APPROVED ─────────────────────────────────────────
  appliedRules.push('ALL_RULES_PASSED');
  return {
    decision: 'APPROVED',
    reason: 'All policy checks passed.',
    ruleTriggered: null,
    appliedRules,
  };
}

/**
 * Synchronous policy evaluation for simulation (uses cached rules)
 */
export function evaluatePolicySync(
  action: ActionType,
  context: Omit<PolicyContext, 'caseId'> & { caseId?: string },
  rules: Record<string, string>
): PolicyResult {
  const appliedRules: string[] = [];

  const maxRetries = getNum(rules, 'MAX_RETRY_ATTEMPTS', 2);
  const highValueThreshold = getNum(rules, 'HIGH_VALUE_THRESHOLD', 50000);
  const minRecoveryProb = getNum(rules, 'MIN_RECOVERY_PROBABILITY', 0.20);
  const maxDailyContacts = getNum(rules, 'MAX_DAILY_CONTACTS', 3);
  const suspiciousAutoBlock = getBool(rules, 'SUSPICIOUS_AUTO_BLOCK', true);
  const respectOptOut = getBool(rules, 'RESPECT_OPT_OUT', true);
  const maxEscalationValue = getNum(rules, 'MAX_ESCALATION_VALUE', 100000);

  if (suspiciousAutoBlock && context.isSuspicious && action !== 'ESCALATE_TO_HUMAN' && action !== 'STOP_RECOVERY') {
    appliedRules.push('SUSPICIOUS_AUTO_BLOCK');
    return { decision: 'BLOCKED', reason: 'Transaction flagged as suspicious.', ruleTriggered: 'SUSPICIOUS_AUTO_BLOCK', appliedRules };
  }

  const contactActions: ActionType[] = ['SEND_PAYMENT_REMINDER', 'SEND_CHECKOUT_RECOVERY_MESSAGE', 'OFFER_ALTERNATE_PAYMENT_METHOD'];
  if (respectOptOut && context.customerOptedOut && contactActions.includes(action)) {
    appliedRules.push('RESPECT_OPT_OUT');
    return { decision: 'BLOCKED', reason: 'Customer opted out.', ruleTriggered: 'RESPECT_OPT_OUT', appliedRules };
  }

  if (contactActions.includes(action) && context.dailyContactCount >= maxDailyContacts) {
    appliedRules.push('MAX_DAILY_CONTACTS');
    return { decision: 'BLOCKED', reason: `Max daily contacts (${maxDailyContacts}) reached.`, ruleTriggered: 'MAX_DAILY_CONTACTS', appliedRules };
  }

  if (action === 'RETRY_PAYMENT' && context.attemptCount >= maxRetries) {
    appliedRules.push('MAX_RETRY_ATTEMPTS');
    return { decision: 'BLOCKED', reason: `Max retry attempts exceeded (${context.attemptCount}/${maxRetries}).`, ruleTriggered: 'MAX_RETRY_ATTEMPTS', appliedRules };
  }

  if (action === 'RETRY_PAYMENT' && context.recoveryProbability < minRecoveryProb) {
    appliedRules.push('MIN_RECOVERY_PROBABILITY');
    return { decision: 'BLOCKED', reason: `Recovery probability too low (${(context.recoveryProbability * 100).toFixed(1)}%).`, ruleTriggered: 'MIN_RECOVERY_PROBABILITY', appliedRules };
  }

  if (context.amount > maxEscalationValue && action !== 'ESCALATE_TO_HUMAN' && action !== 'STOP_RECOVERY') {
    appliedRules.push('MAX_ESCALATION_VALUE');
    return { decision: 'ESCALATE', reason: `Amount exceeds escalation threshold.`, ruleTriggered: 'MAX_ESCALATION_VALUE', appliedRules };
  }

  if (context.amount > highValueThreshold && action === 'RETRY_PAYMENT') {
    appliedRules.push('HIGH_VALUE_THRESHOLD');
    return { decision: 'ESCALATE', reason: `High-value case requires human review.`, ruleTriggered: 'HIGH_VALUE_THRESHOLD', appliedRules };
  }

  appliedRules.push('ALL_RULES_PASSED');
  return { decision: 'APPROVED', reason: 'All policy checks passed.', ruleTriggered: null, appliedRules };
}
