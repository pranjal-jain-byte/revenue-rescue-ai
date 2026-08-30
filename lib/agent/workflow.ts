/**
 * Agent Workflow Orchestrator
 *
 * Implements the complete DETECT → DIAGNOSE → DECIDE → GATE → EXECUTE → OBSERVE loop.
 *
 * ARCHITECTURAL GUARANTEE:
 *   LLM → Recommendation → Validation → Policy Engine → Action Executor → Payment Provider
 *
 * The LLM NEVER directly executes any financial action.
 */

import { prisma } from '@/lib/db/prisma';
import { diagnoseCase } from '@/lib/agent/diagnosis';
import { scoreRecoveryProbability } from '@/lib/agent/recovery-probability';
import { evaluatePolicy, type PolicyContext, type ActionType } from '@/lib/agent/policy-engine';
import { getPaymentProvider } from '@/lib/providers/payment-provider';
import { logger } from '@/lib/utils/logger';

export interface WorkflowResult {
  caseId: string;
  caseNumber: string;
  status: string;
  actionTaken: string | null;
  policyDecision: string | null;
  amountRecovered: number;
  reasoning: string;
  auditEvents: string[];
}

async function logAudit(
  caseId: string,
  event: string,
  agent: string,
  previousState: string | null,
  newState: string | null,
  metadata: Record<string, unknown>
): Promise<void> {
  await prisma.auditEvent.create({
    data: { caseId, event, agent, previousState, newState, metadata: JSON.stringify(metadata), timestamp: new Date() },
  });
}

export async function runRecoveryWorkflow(
  caseId: string,
  injectFailure?: string
): Promise<WorkflowResult> {
  const startTs = Date.now();
  const auditEvents: string[] = [];

  // ── STEP 1: DETECT — Load case ────────────────────────────────────────
  const recoveryCase = await prisma.recoveryCase.findUnique({
    where: { id: caseId },
    include: { customer: true, merchant: true },
  });

  if (!recoveryCase) throw new Error(`Case ${caseId} not found`);

  logger.info('Recovery workflow started', { caseId, component: 'WORKFLOW' });
  auditEvents.push('REVENUE_DETECTED');

  await logAudit(caseId, 'REVENUE_DETECTED', 'DETECTOR', null, recoveryCase.status, {
    amount: recoveryCase.amount,
    eventType: recoveryCase.eventType,
    failureReason: recoveryCase.failureReason,
  });

  if (injectFailure === 'DUPLICATE_EVENT') {
    await logAudit(caseId, 'IDEMPOTENCY_BLOCK', 'SYSTEM', recoveryCase.status, recoveryCase.status, {
      reason: 'Duplicate payment event detected. Execution aborted to prevent double recovery.',
      action: 'BLOCKED'
    });
    auditEvents.push('IDEMPOTENCY_BLOCK');
    return {
      caseId,
      caseNumber: recoveryCase.caseNumber,
      status: recoveryCase.status,
      actionTaken: null,
      policyDecision: 'BLOCKED',
      amountRecovered: 0,
      reasoning: 'Duplicate event blocked by idempotency layer.',
      auditEvents,
    };
  }

  if (injectFailure === 'SUSPICIOUS_TRANSACTION') {
    recoveryCase.isSuspicious = true;
    await logAudit(caseId, 'RISK_FLAG_INJECTED', 'SYSTEM', recoveryCase.status, recoveryCase.status, {
      note: 'Transaction artificially flagged as suspicious for reliability testing.'
    });
    auditEvents.push('RISK_FLAG_INJECTED');
  }

  // ── STEP 2: CLASSIFY ─────────────────────────────────────────────────
  await logAudit(caseId, 'CASE_CLASSIFIED', 'CLASSIFIER', recoveryCase.status, recoveryCase.status, {
    riskLevel: recoveryCase.riskLevel,
    eventType: recoveryCase.eventType,
  });
  auditEvents.push('CASE_CLASSIFIED');

  // ── STEP 3: SCORE Recovery Probability ───────────────────────────────
  const scoreResult = scoreRecoveryProbability({
    failureReason: recoveryCase.failureReason ?? 'UNKNOWN',
    paymentMethod: recoveryCase.paymentMethod ?? 'UNKNOWN',
    successfulPayments: recoveryCase.customer.successfulPayments,
    failedPayments: recoveryCase.customer.failedPayments,
    previousRecoveries: recoveryCase.customer.previousRecoveries,
    lifetimeValue: recoveryCase.customer.lifetimeValue,
    amount: recoveryCase.amount,
    attemptCount: recoveryCase.attemptCount,
    eventType: recoveryCase.eventType,
    isSuspicious: recoveryCase.isSuspicious,
    customerOptedOut: recoveryCase.customer.optedOutOfMarketing,
  });

  await logAudit(caseId, 'RECOVERY_SCORED', 'SCORER', recoveryCase.status, recoveryCase.status, {
    probability: scoreResult.probability,
    confidence: scoreResult.confidence,
    factors: scoreResult.factors.map(f => ({ name: f.name, impact: f.impact })),
  });
  auditEvents.push('RECOVERY_SCORED');

  // Update case with new score
  await prisma.recoveryCase.update({
    where: { id: caseId },
    data: { recoveryProbability: scoreResult.probability, status: 'IN_PROGRESS' },
  });

  // ── STEP 4: AI DIAGNOSIS ─────────────────────────────────────────────
  let diagnosis;
  if (injectFailure === 'AI_UNAVAILABLE') {
    diagnosis = {
      rootCause: 'UNKNOWN',
      recoveryProbability: scoreResult.probability,
      recommendedAction: 'ESCALATE_TO_HUMAN',
      confidence: 'LOW',
      reason: 'AI service unavailable. Deterministic fallback activated.',
      shouldEscalate: true,
      aiUsed: false,
      aiFailed: true,
      fallbackReason: 'AI_UNAVAILABLE',
    };
  } else if (injectFailure === 'INVALID_AI_RESPONSE') {
    diagnosis = {
      rootCause: 'UNKNOWN',
      recoveryProbability: scoreResult.probability,
      recommendedAction: 'ESCALATE_TO_HUMAN',
      confidence: 'LOW',
      reason: 'AI returned invalid schema. Deterministic fallback activated.',
      shouldEscalate: true,
      aiUsed: true,
      aiFailed: true,
      fallbackReason: 'INVALID_AI_RESPONSE',
    };
  } else {
    diagnosis = await diagnoseCase({
      caseId,
      eventType: recoveryCase.eventType,
      failureReason: recoveryCase.failureReason,
      paymentMethod: recoveryCase.paymentMethod,
      amount: recoveryCase.amount,
      currency: recoveryCase.currency,
      attemptCount: recoveryCase.attemptCount,
      customerSuccessfulPayments: recoveryCase.customer.successfulPayments,
      customerFailedPayments: recoveryCase.customer.failedPayments,
      customerLifetimeValue: recoveryCase.customer.lifetimeValue,
      previousRecoveries: recoveryCase.customer.previousRecoveries,
      isSuspicious: recoveryCase.isSuspicious,
      recoveryProbability: scoreResult.probability,
    });
  }

  await logAudit(caseId, 'DIAGNOSIS_COMPLETE', 'AI_DIAGNOSIS', 'IN_PROGRESS', 'IN_PROGRESS', {
    rootCause: diagnosis.rootCause,
    recoveryProbability: diagnosis.recoveryProbability,
    recommendedAction: diagnosis.recommendedAction,
    confidence: diagnosis.confidence,
    aiUsed: diagnosis.aiUsed,
    aiFailed: diagnosis.aiFailed,
    fallbackReason: diagnosis.fallbackReason,
  });
  auditEvents.push('DIAGNOSIS_COMPLETE');

  if (diagnosis.aiFailed) {
    await logAudit(caseId, 'AI_FALLBACK_ACTIVATED', 'SYSTEM', 'IN_PROGRESS', 'IN_PROGRESS', {
      reason: diagnosis.fallbackReason,
      safetyNote: 'No financial action will be taken based on failed AI output alone.',
    });
    auditEvents.push('AI_FALLBACK_ACTIVATED');
  }

  // Save agent decision
  await prisma.agentDecision.create({
    data: {
      caseId,
      step: 'DIAGNOSIS',
      rootCause: diagnosis.rootCause,
      recoveryProbability: diagnosis.recoveryProbability,
      recommendedAction: diagnosis.recommendedAction,
      confidence: diagnosis.confidence as 'LOW' | 'MEDIUM' | 'HIGH',
      reasoning: diagnosis.reason,
      shouldEscalate: diagnosis.shouldEscalate,
      aiUsed: diagnosis.aiUsed,
      aiFailed: diagnosis.aiFailed,
    },
  });

  // ── STEP 5: POLICY GATE ──────────────────────────────────────────────
  const dailyContacts = await prisma.recoveryAction.count({
    where: {
      case: { customerId: recoveryCase.customerId },
      executedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });

  const policyContext: PolicyContext = {
    caseId,
    customerId: recoveryCase.customerId,
    amount: recoveryCase.amount,
    eventType: recoveryCase.eventType,
    failureReason: recoveryCase.failureReason,
    attemptCount: recoveryCase.attemptCount,
    recoveryProbability: scoreResult.probability,
    isSuspicious: recoveryCase.isSuspicious,
    customerOptedOut: recoveryCase.customer.optedOutOfMarketing,
    dailyContactCount: dailyContacts,
    caseStatus: recoveryCase.status,
  };

  const policyResult = await evaluatePolicy(diagnosis.recommendedAction as ActionType, policyContext);

  await logAudit(caseId, `POLICY_${policyResult.decision}`, 'POLICY_ENGINE', 'IN_PROGRESS', 'IN_PROGRESS', {
    action: diagnosis.recommendedAction,
    decision: policyResult.decision,
    reason: policyResult.reason,
    ruleTriggered: policyResult.ruleTriggered,
    appliedRules: policyResult.appliedRules,
  });
  auditEvents.push(`POLICY_${policyResult.decision}`);

  // ── HANDLE ESCALATION ────────────────────────────────────────────────
  if (policyResult.decision === 'ESCALATE') {
    await prisma.recoveryCase.update({
      where: { id: caseId },
      data: { status: 'ESCALATED', requiresHumanApproval: true, lastActionAt: new Date() },
    });
    await logAudit(caseId, 'CASE_ESCALATED', 'WORKFLOW', 'IN_PROGRESS', 'ESCALATED', {
      reason: policyResult.reason,
    });

    return {
      caseId,
      caseNumber: recoveryCase.caseNumber,
      status: 'ESCALATED',
      actionTaken: 'ESCALATE_TO_HUMAN',
      policyDecision: 'ESCALATE',
      amountRecovered: 0,
      reasoning: policyResult.reason,
      auditEvents,
    };
  }

  // ── HANDLE POLICY BLOCK ──────────────────────────────────────────────
  if (policyResult.decision === 'BLOCKED') {
    await prisma.recoveryCase.update({
      where: { id: caseId },
      data: { status: 'BLOCKED', lastActionAt: new Date() },
    });

    await prisma.recoveryAction.create({
      data: {
        caseId,
        actionType: diagnosis.recommendedAction,
        status: 'BLOCKED',
        policyDecision: 'BLOCKED',
        policyReason: policyResult.reason,
        executedAt: new Date(),
      },
    });

    await logAudit(caseId, 'ACTION_BLOCKED', 'POLICY_ENGINE', 'IN_PROGRESS', 'BLOCKED', {
      blockedAction: diagnosis.recommendedAction,
      reason: policyResult.reason,
      ruleTriggered: policyResult.ruleTriggered,
    });

    return {
      caseId,
      caseNumber: recoveryCase.caseNumber,
      status: 'BLOCKED',
      actionTaken: diagnosis.recommendedAction,
      policyDecision: 'BLOCKED',
      amountRecovered: 0,
      reasoning: policyResult.reason,
      auditEvents,
    };
  }

  // ── STEP 6: EXECUTE ACTION ───────────────────────────────────────────
  const provider = getPaymentProvider();
  let amountRecovered = 0;
  let executionResult = '';
  let finalStatus = 'FAILED';

  await logAudit(caseId, 'ACTION_EXECUTING', 'EXECUTOR', 'IN_PROGRESS', 'IN_PROGRESS', {
    action: diagnosis.recommendedAction,
    provider: provider.name,
  });

  try {
    if (injectFailure === 'PAYMENT_TIMEOUT') {
      throw new Error('Payment provider connection timed out.');
    }

    if (diagnosis.recommendedAction === 'RETRY_PAYMENT') {
      const result = await provider.retryPayment({
        orderId: recoveryCase.orderId ?? `ORD-${caseId.slice(-8)}`,
        amount: recoveryCase.amount,
        currency: recoveryCase.currency,
        customerId: recoveryCase.customerId,
        paymentMethod: recoveryCase.paymentMethod ?? 'UPI',
        caseId,
      });

      if (result.success) {
        amountRecovered = recoveryCase.amount;
        finalStatus = 'RECOVERED';
        executionResult = `Payment succeeded via ${result.provider}. PaymentID: ${result.paymentId}`;
      } else {
        finalStatus = 'FAILED';
        executionResult = `Payment failed: ${result.errorCode} — ${result.errorDescription}`;
      }
    } else if (
      diagnosis.recommendedAction === 'SEND_PAYMENT_REMINDER' ||
      diagnosis.recommendedAction === 'SEND_CHECKOUT_RECOVERY_MESSAGE'
    ) {
      const linkResult = await provider.sendPaymentLink({
        customerId: recoveryCase.customerId,
        amount: recoveryCase.amount,
        currency: recoveryCase.currency,
        caseId,
      });

      if (linkResult.success) {
        finalStatus = 'IN_PROGRESS';
        executionResult = `Payment link sent. LinkID: ${linkResult.linkId}`;
        // Simulate ~45% conversion after reminder
        const converted = Math.random() < 0.45;
        if (converted) {
          amountRecovered = recoveryCase.amount;
          finalStatus = 'RECOVERED';
          executionResult += ' | Customer completed payment.';
        }
      } else {
        executionResult = 'Failed to send payment link.';
      }
    } else if (diagnosis.recommendedAction === 'OFFER_ALTERNATE_PAYMENT_METHOD') {
      const linkResult = await provider.sendPaymentLink({
        customerId: recoveryCase.customerId,
        amount: recoveryCase.amount,
        currency: recoveryCase.currency,
        caseId,
      });
      finalStatus = 'IN_PROGRESS';
      executionResult = `Alternate payment method offer sent. LinkID: ${linkResult.linkId}`;
      const converted = Math.random() < 0.35;
      if (converted) {
        amountRecovered = recoveryCase.amount;
        finalStatus = 'RECOVERED';
        executionResult += ' | Customer completed payment via alternate method.';
      }
    } else if (diagnosis.recommendedAction === 'STOP_RECOVERY') {
      finalStatus = 'STOPPED';
      executionResult = 'Recovery stopped per agent recommendation.';
    }
  } catch (err) {
    logger.error('Action execution failed', { caseId, error: err instanceof Error ? err.message : String(err) });
    executionResult = `Execution error: ${err instanceof Error ? err.message : 'Unknown error'}`;
    if (injectFailure === 'PAYMENT_TIMEOUT') {
      finalStatus = 'ESCALATED'; // Mark as uncertain/escalated to prevent blind retries
      executionResult += ' | Idempotency lock applied. Case escalated for human review.';
    } else {
      finalStatus = 'FAILED';
    }
  }

  // ── STEP 7: OBSERVE & PERSIST ─────────────────────────────────────────
  await prisma.recoveryAction.create({
    data: {
      caseId,
      actionType: diagnosis.recommendedAction,
      status: finalStatus === 'RECOVERED' ? 'SUCCEEDED' : 'FAILED',
      policyDecision: 'APPROVED',
      policyReason: policyResult.reason,
      executionResult,
      amountRecovered,
      executedAt: new Date(),
    },
  });

  await prisma.recoveryCase.update({
    where: { id: caseId },
    data: {
      status: finalStatus as 'RECOVERED' | 'FAILED' | 'IN_PROGRESS' | 'STOPPED',
      actualRecovery: amountRecovered,
      attemptCount: { increment: 1 },
      lastActionAt: new Date(),
      recoveredAt: finalStatus === 'RECOVERED' ? new Date() : null,
    },
  });

  if (finalStatus === 'RECOVERED') {
    await logAudit(caseId, 'RECOVERY_SUCCESS', 'EXECUTOR', 'IN_PROGRESS', 'RECOVERED', {
      amountRecovered,
      action: diagnosis.recommendedAction,
      durationMs: Date.now() - startTs,
    });
    auditEvents.push('RECOVERY_SUCCESS');
  } else {
    await logAudit(caseId, 'ACTION_EXECUTED', 'EXECUTOR', 'IN_PROGRESS', finalStatus, {
      result: executionResult,
      action: diagnosis.recommendedAction,
      durationMs: Date.now() - startTs,
    });
    auditEvents.push('ACTION_EXECUTED');
  }

  logger.info('Recovery workflow complete', {
    caseId,
    component: 'WORKFLOW',
    durationMs: Date.now() - startTs,
    metadata: { status: finalStatus, amountRecovered },
  });

  return {
    caseId,
    caseNumber: recoveryCase.caseNumber,
    status: finalStatus,
    actionTaken: diagnosis.recommendedAction,
    policyDecision: 'APPROVED',
    amountRecovered,
    reasoning: diagnosis.reason,
    auditEvents,
  };
}
