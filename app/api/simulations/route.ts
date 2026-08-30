import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { scoreRecoveryProbability } from '@/lib/agent/recovery-probability';
import { evaluatePolicySync } from '@/lib/agent/policy-engine';
import { validateAccounting } from '@/lib/utils/accounting';
import type { ActionType } from '@/lib/agent/policy-engine';


const BATCH_SIZE = 10;

function selectActionForCase(
  eventType: string,
  failureReason: string | null,
  recoveryProbability: number,
  attemptCount: number,
  amount: number,
  isSuspicious: boolean,
): ActionType {
  if (isSuspicious) return 'ESCALATE_TO_HUMAN';
  if (amount > 100000) return 'ESCALATE_TO_HUMAN';
  if (recoveryProbability < 0.20) return 'STOP_RECOVERY';
  if (attemptCount >= 2) return 'OFFER_ALTERNATE_PAYMENT_METHOD';
  if (failureReason === 'CARD_EXPIRED' || failureReason === 'INVALID_CVV') return 'OFFER_ALTERNATE_PAYMENT_METHOD';
  if (failureReason === 'TRANSACTION_NOT_PERMITTED' || failureReason === 'DO_NOT_HONOR') return 'ESCALATE_TO_HUMAN';
  if (eventType === 'CHECKOUT_ABANDONED') return 'SEND_CHECKOUT_RECOVERY_MESSAGE';
  if (recoveryProbability > 0.60) return 'RETRY_PAYMENT';
  if (failureReason === 'NETWORK_TIMEOUT') return 'RETRY_PAYMENT';
  return 'SEND_PAYMENT_REMINDER';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { caseCount?: number; name?: string };
    const caseCount = Math.min(Math.max(body.caseCount ?? 100, 10), 1000);
    const name = body.name ?? `Simulation ${new Date().toISOString().slice(0, 16)}`;

    // Create simulation run
    const simulation = await prisma.simulationRun.create({
      data: { name, totalCases: caseCount, status: 'RUNNING' },
    });

    // Run simulation asynchronously
    void runSimulation(simulation.id, caseCount);

    return NextResponse.json({ simulationId: simulation.id, status: 'RUNNING' });
  } catch (err) {
    console.error('Simulation start error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  const simulations = await prisma.simulationRun.findMany({
    orderBy: { startedAt: 'desc' },
    take: 10,
  });
  return NextResponse.json({ simulations });
}

async function runSimulation(simulationId: string, caseCount: number): Promise<void> {
  try {
    // Get policy rules
    const policyRules = await prisma.policyRule.findMany({ where: { isEnabled: true } });
    const rules: Record<string, string> = {};
    for (const r of policyRules) rules[r.ruleKey] = r.value;

    // Sample random cases
    const totalDbCases = await prisma.recoveryCase.count();
    const skip = Math.max(0, Math.floor(Math.random() * (totalDbCases - caseCount)));
    const cases = await prisma.recoveryCase.findMany({
      skip,
      take: caseCount,
      include: { customer: true },
    });

    let totalAtRisk = 0;
    let totalRecovered = 0;
    let totalBlocked = 0;
    let totalEscalated = 0;
    let actionsExecuted = 0;
    let actionsBlocked = 0;
    let escalations = 0;
    let totalRecoveryTimeMs = 0;

    const results = [];

    for (const c of cases) {
      const caseStartMs = Date.now();

      // Score recovery probability
      const score = scoreRecoveryProbability({
        failureReason: c.failureReason ?? 'UNKNOWN',
        paymentMethod: c.paymentMethod ?? 'UPI',
        successfulPayments: c.customer.successfulPayments,
        failedPayments: c.customer.failedPayments,
        previousRecoveries: c.customer.previousRecoveries,
        lifetimeValue: c.customer.lifetimeValue,
        amount: c.amount,
        attemptCount: c.attemptCount,
        eventType: c.eventType,
        isSuspicious: c.isSuspicious,
        customerOptedOut: c.customer.optedOutOfMarketing,
      });

      // Select action
      const action = selectActionForCase(
        c.eventType,
        c.failureReason,
        score.probability,
        c.attemptCount,
        c.amount,
        c.isSuspicious,
      );

      // Policy check
      const policyResult = evaluatePolicySync(action, {
        customerId: c.customerId,
        amount: c.amount,
        eventType: c.eventType,
        failureReason: c.failureReason,
        attemptCount: c.attemptCount,
        recoveryProbability: score.probability,
        isSuspicious: c.isSuspicious,
        customerOptedOut: c.customer.optedOutOfMarketing,
        dailyContactCount: 0,
        caseStatus: c.status,
      }, rules);

      let simStatus: string;
      let recovered = 0;

      if (policyResult.decision === 'BLOCKED') {
        simStatus = 'BLOCKED';
        actionsBlocked++;
        totalBlocked += c.amount;
      } else if (policyResult.decision === 'ESCALATE') {
        simStatus = 'ESCALATED';
        escalations++;
        totalEscalated += c.amount;
      } else {
        actionsExecuted++;
        // Simulate outcome based on action type and probability
        let successRate: number;
        if (action === 'RETRY_PAYMENT') successRate = score.probability * 0.9;
        else if (action === 'SEND_PAYMENT_REMINDER') successRate = score.probability * 0.5;
        else if (action === 'OFFER_ALTERNATE_PAYMENT_METHOD') successRate = score.probability * 0.4;
        else if (action === 'SEND_CHECKOUT_RECOVERY_MESSAGE') successRate = score.probability * 0.45;
        else if (action === 'STOP_RECOVERY') successRate = 0;
        else successRate = 0;

        if (Math.random() < successRate) {
          simStatus = 'RECOVERED';
          recovered = c.amount;
          totalRecovered += recovered;
        } else {
          simStatus = 'FAILED';
        }
      }

      totalAtRisk += c.amount;
      const recoveryTimeMs = Date.now() - caseStartMs;
      totalRecoveryTimeMs += recoveryTimeMs;

      results.push({
        simulationId,
        caseId: c.id,
        caseNumber: c.caseNumber,
        eventType: c.eventType,
        amount: c.amount,
        recovered,
        status: simStatus,
        actionTaken: action,
        policyDecision: policyResult.decision,
        recoveryTimeMs,
      });

      // Insert in batches
      if (results.length >= BATCH_SIZE) {
        await prisma.simulationResult.createMany({ data: results.splice(0, BATCH_SIZE) });
        await prisma.simulationRun.update({
          where: { id: simulationId },
          data: { processedCases: { increment: BATCH_SIZE } },
        });
      }
    }

    // Insert remaining results
    if (results.length > 0) {
      await prisma.simulationResult.createMany({ data: results });
    }

    // Validate accounting
    const accounting = {
      totalAtRisk,
      recoveredViaRetry: 0,
      recoveredViaReminder: 0,
      recoveredViaAlternate: 0,
      recoveredViaOther: totalRecovered,
      totalRecovered,
      escalated: totalEscalated,
      blocked: totalBlocked,
      unrecovered: totalAtRisk - totalRecovered - totalBlocked - totalEscalated,
      recoveryRate: totalAtRisk > 0 ? totalRecovered / totalAtRisk : 0,
    };

    const validation = validateAccounting(accounting);
    if (!validation.valid) {
      console.error('Simulation accounting errors:', validation.errors);
    }

    const recoveryRate = totalAtRisk > 0 ? totalRecovered / totalAtRisk : 0;

    await prisma.simulationRun.update({
      where: { id: simulationId },
      data: {
        processedCases: caseCount,
        totalAtRisk,
        totalRecovered,
        totalUnrecovered: totalAtRisk - totalRecovered - totalBlocked - totalEscalated,
        totalBlocked,
        totalEscalated,
        actionsExecuted,
        actionsBlocked,
        escalations,
        recoveryRate,
        avgRecoveryTimeMs: cases.length > 0 ? totalRecoveryTimeMs / cases.length : 0,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
  } catch (err) {
    console.error('Simulation error:', err);
    await prisma.simulationRun.update({
      where: { id: simulationId },
      data: { status: 'FAILED' },
    }).catch(() => null);
  }
}
