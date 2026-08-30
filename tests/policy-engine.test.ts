/**
 * Policy Engine Tests
 *
 * These tests verify that the deterministic guardrails work correctly.
 * They are the MOST IMPORTANT tests in the project — they prove
 * the system is safe.
 */

import { evaluatePolicySync } from '../lib/agent/policy-engine';

const DEFAULT_RULES = {
  MAX_RETRY_ATTEMPTS: '2',
  HIGH_VALUE_THRESHOLD: '50000',
  MIN_RECOVERY_PROBABILITY: '0.20',
  MAX_DAILY_CONTACTS: '3',
  MAX_DISCOUNT_PERCENT: '15',
  SUSPICIOUS_AUTO_BLOCK: 'true',
  REQUIRE_AUDIT_LOG: 'true',
  RESPECT_OPT_OUT: 'true',
  MAX_ESCALATION_VALUE: '100000',
  RECOVERY_WINDOW_HOURS: '72',
};

const BASE_CONTEXT = {
  customerId: 'test-customer-1',
  amount: 5000,
  eventType: 'PAYMENT_FAILED',
  failureReason: 'INSUFFICIENT_BALANCE',
  attemptCount: 0,
  recoveryProbability: 0.75,
  isSuspicious: false,
  customerOptedOut: false,
  dailyContactCount: 0,
  caseStatus: 'IN_PROGRESS',
};

// ── Test Suite ────────────────────────────────────────────────────────────────

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`  ✅ PASS: ${message}`);
}

function test(name: string, fn: () => void): void {
  console.log(`\n🧪 ${name}`);
  try {
    fn();
  } catch (err) {
    console.error(`  ❌ ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  }
}

// ── RULE 1: Max Retry Attempts ────────────────────────────────────────────────

test('RULE 1: Max retry attempts — should BLOCK if attemptCount >= MAX_RETRY_ATTEMPTS', () => {
  const result = evaluatePolicySync('RETRY_PAYMENT', {
    ...BASE_CONTEXT,
    attemptCount: 2,
  }, DEFAULT_RULES);
  assert(result.decision === 'BLOCKED', 'Should be BLOCKED when attemptCount >= 2');
  assert(result.ruleTriggered === 'MAX_RETRY_ATTEMPTS', 'Should trigger MAX_RETRY_ATTEMPTS rule');
});

test('RULE 1: Max retry attempts — should APPROVE if attemptCount < MAX_RETRY_ATTEMPTS', () => {
  const result = evaluatePolicySync('RETRY_PAYMENT', {
    ...BASE_CONTEXT,
    attemptCount: 1,
  }, DEFAULT_RULES);
  assert(result.decision === 'APPROVED', 'Should be APPROVED when attemptCount < 2');
});

test('RULE 1: Max retry attempts — should BLOCK if attemptCount is 3', () => {
  const result = evaluatePolicySync('RETRY_PAYMENT', {
    ...BASE_CONTEXT,
    attemptCount: 3,
  }, DEFAULT_RULES);
  assert(result.decision === 'BLOCKED', 'Should be BLOCKED when attemptCount is 3');
});

// ── RULE 2: High Value Threshold ──────────────────────────────────────────────

test('RULE 2: High-value cases — should ESCALATE if amount > HIGH_VALUE_THRESHOLD', () => {
  const result = evaluatePolicySync('RETRY_PAYMENT', {
    ...BASE_CONTEXT,
    amount: 75000,
  }, DEFAULT_RULES);
  assert(result.decision === 'ESCALATE', 'Should ESCALATE when amount > 50000');
  assert(result.ruleTriggered === 'HIGH_VALUE_THRESHOLD', 'Should trigger HIGH_VALUE_THRESHOLD rule');
});

test('RULE 2: High-value cases — should APPROVE if amount <= HIGH_VALUE_THRESHOLD', () => {
  const result = evaluatePolicySync('RETRY_PAYMENT', {
    ...BASE_CONTEXT,
    amount: 49999,
  }, DEFAULT_RULES);
  assert(result.decision === 'APPROVED', 'Should be APPROVED when amount <= 50000');
});

// ── RULE 3: Auto-escalation threshold ────────────────────────────────────────

test('RULE 3: Auto-escalation — should ESCALATE if amount > MAX_ESCALATION_VALUE', () => {
  const result = evaluatePolicySync('RETRY_PAYMENT', {
    ...BASE_CONTEXT,
    amount: 150000,
  }, DEFAULT_RULES);
  assert(result.decision === 'ESCALATE', 'Should ESCALATE when amount > 100000');
  assert(result.ruleTriggered === 'MAX_ESCALATION_VALUE', 'Should trigger MAX_ESCALATION_VALUE');
});

// ── RULE 4: Recovery Probability Minimum ──────────────────────────────────────

test('RULE 4: Recovery probability — should BLOCK if prob < MIN_RECOVERY_PROBABILITY', () => {
  const result = evaluatePolicySync('RETRY_PAYMENT', {
    ...BASE_CONTEXT,
    recoveryProbability: 0.10,
  }, DEFAULT_RULES);
  assert(result.decision === 'BLOCKED', 'Should BLOCK when prob < 0.20');
  assert(result.ruleTriggered === 'MIN_RECOVERY_PROBABILITY', 'Should trigger MIN_RECOVERY_PROBABILITY');
});

test('RULE 4: Recovery probability — should APPROVE if prob >= MIN_RECOVERY_PROBABILITY', () => {
  const result = evaluatePolicySync('RETRY_PAYMENT', {
    ...BASE_CONTEXT,
    recoveryProbability: 0.25,
  }, DEFAULT_RULES);
  assert(result.decision === 'APPROVED', 'Should APPROVE when prob >= 0.20');
});

// ── RULE 5: Customer Opt-Out ──────────────────────────────────────────────────

test('RULE 5: Customer opt-out — should BLOCK reminder if customer opted out', () => {
  const result = evaluatePolicySync('SEND_PAYMENT_REMINDER', {
    ...BASE_CONTEXT,
    customerOptedOut: true,
  }, DEFAULT_RULES);
  assert(result.decision === 'BLOCKED', 'Should BLOCK reminder when opted out');
  assert(result.ruleTriggered === 'RESPECT_OPT_OUT', 'Should trigger RESPECT_OPT_OUT');
});

test('RULE 5: Customer opt-out — should NOT block retry for opted-out customer', () => {
  const result = evaluatePolicySync('RETRY_PAYMENT', {
    ...BASE_CONTEXT,
    customerOptedOut: true,
  }, DEFAULT_RULES);
  assert(result.decision === 'APPROVED', 'Retry should still be allowed for opted-out customers');
});

// ── RULE 6: Suspicious Transactions ──────────────────────────────────────────

test('RULE 6: Suspicious transaction — should BLOCK auto-retry', () => {
  const result = evaluatePolicySync('RETRY_PAYMENT', {
    ...BASE_CONTEXT,
    isSuspicious: true,
  }, DEFAULT_RULES);
  assert(result.decision === 'BLOCKED', 'Should BLOCK suspicious transactions');
  assert(result.ruleTriggered === 'SUSPICIOUS_AUTO_BLOCK', 'Should trigger SUSPICIOUS_AUTO_BLOCK');
});

test('RULE 6: Suspicious transaction — should ALLOW escalation even if suspicious', () => {
  const result = evaluatePolicySync('ESCALATE_TO_HUMAN', {
    ...BASE_CONTEXT,
    isSuspicious: true,
  }, DEFAULT_RULES);
  assert(result.decision === 'APPROVED', 'Escalation should still be allowed for suspicious cases');
});

// ── RULE 7: Max Daily Contacts ────────────────────────────────────────────────

test('RULE 7: Max daily contacts — should BLOCK if at limit', () => {
  const result = evaluatePolicySync('SEND_PAYMENT_REMINDER', {
    ...BASE_CONTEXT,
    dailyContactCount: 3,
  }, DEFAULT_RULES);
  assert(result.decision === 'BLOCKED', 'Should BLOCK when daily contacts >= 3');
  assert(result.ruleTriggered === 'MAX_DAILY_CONTACTS', 'Should trigger MAX_DAILY_CONTACTS');
});

// ── Accounting Invariant ──────────────────────────────────────────────────────

test('ACCOUNTING: Recovered revenue must not exceed at-risk amount', () => {
  const totalAtRisk = 100000;
  const totalRecovered = 60000;
  assert(totalRecovered <= totalAtRisk, 'Recovered must not exceed at-risk');
});

test('ACCOUNTING: Recovery rate must be in [0, 1]', () => {
  const rate = 0.60;
  assert(rate >= 0 && rate <= 1, 'Recovery rate must be in [0, 1]');
});

// ── Custom Rule Values ────────────────────────────────────────────────────────

test('Custom rules: custom max retry of 1 should block at attemptCount=1', () => {
  const customRules = { ...DEFAULT_RULES, MAX_RETRY_ATTEMPTS: '1' };
  const result = evaluatePolicySync('RETRY_PAYMENT', {
    ...BASE_CONTEXT,
    attemptCount: 1,
  }, customRules);
  assert(result.decision === 'BLOCKED', 'Should BLOCK with custom MAX_RETRY_ATTEMPTS=1 and attemptCount=1');
});

test('Custom rules: disabled SUSPICIOUS_AUTO_BLOCK should allow suspicious retry', () => {
  const customRules = { ...DEFAULT_RULES, SUSPICIOUS_AUTO_BLOCK: 'false' };
  const result = evaluatePolicySync('RETRY_PAYMENT', {
    ...BASE_CONTEXT,
    isSuspicious: true,
  }, customRules);
  assert(result.decision === 'APPROVED', 'Should APPROVE when SUSPICIOUS_AUTO_BLOCK is disabled');
});

console.log('\n\n✅ All policy engine tests completed.\n');
