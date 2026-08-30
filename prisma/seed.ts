import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

const MERCHANTS = [
  { name: 'TechMart India', email: 'merchant@techmart.in', businessType: 'E-Commerce' },
  { name: 'ZenFit Studios', email: 'billing@zenfit.io', businessType: 'SaaS' },
  { name: 'QuickDeliver', email: 'finance@quickdeliver.in', businessType: 'Logistics' },
  { name: 'EduLeap', email: 'accounts@eduleap.in', businessType: 'EdTech' },
  { name: 'HealthFirst', email: 'billing@healthfirst.in', businessType: 'HealthTech' },
];

const CUSTOMER_NAMES = [
  'Arjun Sharma', 'Priya Patel', 'Rahul Gupta', 'Anita Singh', 'Vikram Nair',
  'Deepika Reddy', 'Sanjay Kumar', 'Meena Iyer', 'Rajesh Menon', 'Sunita Rao',
  'Amit Verma', 'Kavita Joshi', 'Nikhil Mehta', 'Pooja Agarwal', 'Suresh Pillai',
  'Lata Bose', 'Manish Tiwari', 'Neha Kapoor', 'Ravi Choudhary', 'Suman Das',
  'Kiran Khanna', 'Dinesh Yadav', 'Anjali Mishra', 'Tarun Saxena', 'Geeta Nanda',
  'Mohan Srivastava', 'Rekha Trivedi', 'Shyam Dixit', 'Usha Pandey', 'Vinod Shah',
];

const FAILURE_REASONS = [
  'INSUFFICIENT_BALANCE', 'BANK_DECLINED', 'AUTHENTICATION_FAILED',
  'CARD_EXPIRED', 'NETWORK_TIMEOUT', 'CARD_LIMIT_EXCEEDED',
  'INVALID_CVV', 'DO_NOT_HONOR', 'TRANSACTION_NOT_PERMITTED', 'CHECKOUT_ABANDONED',
];

const PAYMENT_METHODS = ['UPI', 'CREDIT_CARD', 'DEBIT_CARD', 'NET_BANKING', 'WALLET', 'EMI'];

function randomChoice<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randomInt(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomFloat(min: number, max: number): number { return parseFloat((Math.random() * (max - min) + min).toFixed(2)); }
function randomDate(daysBack: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - randomInt(0, daysBack));
  date.setHours(randomInt(0, 23), randomInt(0, 59), randomInt(0, 59));
  return date;
}

function generateCaseNumber(): string { return `RR-${String(Math.floor(Math.random() * 90000) + 10000)}`; }

function computeRiskLevel(amount: number, failureReason: string, retries: number): string {
  if (amount > 100000 || failureReason === 'TRANSACTION_NOT_PERMITTED') return 'CRITICAL';
  if (amount > 50000 || retries >= 2) return 'HIGH';
  if (amount > 10000) return 'MEDIUM';
  return 'LOW';
}

function computeRecoveryProbability(
  failureReason: string, paymentMethod: string, successfulPayments: number,
  failedPayments: number, amount: number, retryCount: number, previousRecoveries: number,
): number {
  const goodReasons: Record<string, number> = {
    INSUFFICIENT_BALANCE: 0.7, NETWORK_TIMEOUT: 0.85, AUTHENTICATION_FAILED: 0.65,
    CHECKOUT_ABANDONED: 0.55, BANK_DECLINED: 0.45, CARD_LIMIT_EXCEEDED: 0.4,
    CARD_EXPIRED: 0.3, INVALID_CVV: 0.35, DO_NOT_HONOR: 0.25, TRANSACTION_NOT_PERMITTED: 0.15,
  };
  let score = goodReasons[failureReason] ?? 0.5;
  if (paymentMethod === 'UPI') score += 0.05;
  const successRate = successfulPayments / (successfulPayments + failedPayments + 1);
  score += (successRate - 0.5) * 0.2;
  if (previousRecoveries > 0) score += Math.min(previousRecoveries * 0.05, 0.15);
  if (amount > 100000) score -= 0.25;
  else if (amount > 50000) score -= 0.15;
  else if (amount > 10000) score -= 0.05;
  score -= retryCount * 0.1;
  return Math.max(0.05, Math.min(0.97, parseFloat(score.toFixed(4))));
}

async function main() {
  console.log('🌱 Starting seed...');

  await prisma.simulationResult.deleteMany();
  await prisma.simulationRun.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.recoveryAction.deleteMany();
  await prisma.agentDecision.deleteMany();
  await prisma.recoveryCase.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.merchant.deleteMany();
  await prisma.policyRule.deleteMany();

  console.log('Creating merchants...');
  const merchants = await Promise.all(MERCHANTS.map(m => prisma.merchant.create({ data: m })));

  console.log('Creating policy rules...');
  await prisma.policyRule.createMany({
    data: [
      { name: 'Max Retry Attempts', description: 'Maximum payment retry attempts per case', ruleKey: 'MAX_RETRY_ATTEMPTS', value: '2', dataType: 'number' },
      { name: 'High Value Threshold', description: 'Cases above this amount require human approval', ruleKey: 'HIGH_VALUE_THRESHOLD', value: '50000', dataType: 'number' },
      { name: 'Min Recovery Probability', description: 'Do not attempt recovery below this probability', ruleKey: 'MIN_RECOVERY_PROBABILITY', value: '0.20', dataType: 'number' },
      { name: 'Max Daily Contacts', description: 'Maximum contacts per customer per day', ruleKey: 'MAX_DAILY_CONTACTS', value: '3', dataType: 'number' },
      { name: 'Max Discount Percent', description: 'Maximum discount percentage for offers', ruleKey: 'MAX_DISCOUNT_PERCENT', value: '15', dataType: 'number' },
      { name: 'Suspicious Auto Block', description: 'Block recovery for suspicious transactions', ruleKey: 'SUSPICIOUS_AUTO_BLOCK', value: 'true', dataType: 'boolean' },
      { name: 'Require Audit Log', description: 'All financial actions must audit-log', ruleKey: 'REQUIRE_AUDIT_LOG', value: 'true', dataType: 'boolean' },
      { name: 'Customer Opt-Out Respected', description: 'Never contact opted-out customers', ruleKey: 'RESPECT_OPT_OUT', value: 'true', dataType: 'boolean' },
      { name: 'Max Escalation Value', description: 'Auto-escalate cases above this value', ruleKey: 'MAX_ESCALATION_VALUE', value: '100000', dataType: 'number' },
      { name: 'Recovery Window Hours', description: 'Stop recovery attempts after this many hours', ruleKey: 'RECOVERY_WINDOW_HOURS', value: '72', dataType: 'number' },
    ],
  });

  console.log('Creating 120 customers...');
  const customers: Array<{
    id: string; merchantId: string; successfulPayments: number;
    failedPayments: number; previousRecoveries: number; optedOutOfMarketing: boolean;
  }> = [];

  for (let i = 0; i < 120; i++) {
    const nameParts = CUSTOMER_NAMES[i % CUSTOMER_NAMES.length];
    const name = i >= CUSTOMER_NAMES.length ? `${nameParts} ${Math.floor(i / CUSTOMER_NAMES.length) + 1}` : nameParts;
    const merchant = randomChoice(merchants);
    const successfulPayments = randomInt(0, 30);
    const failedPayments = randomInt(0, 8);
    const previousRecoveries = randomInt(0, Math.min(5, failedPayments));
    const optedOutOfMarketing = Math.random() < 0.08;

    const customer = await prisma.customer.create({
      data: {
        externalId: `CUST-${uuidv4().slice(0, 8).toUpperCase()}`,
        name,
        email: `${name.toLowerCase().replace(/ /g, '.')}${i}@example.com`,
        phone: `+91 ${randomInt(70000, 99999)} ${randomInt(10000, 99999)}`,
        lifetimeValue: randomFloat(500, 500000),
        successfulPayments,
        failedPayments,
        previousRecoveries,
        preferredPaymentMethod: randomChoice(PAYMENT_METHODS),
        optedOutOfMarketing,
        riskScore: randomFloat(0, 1),
        merchantId: merchant.id,
      },
    });
    customers.push({ id: customer.id, merchantId: merchant.id, successfulPayments, failedPayments, previousRecoveries, optedOutOfMarketing });
  }

  console.log('Creating 1000 recovery cases...');
  const distributions = [
    { eventType: 'PAYMENT_FAILED', weight: 0.40 },
    { eventType: 'CHECKOUT_ABANDONED', weight: 0.30 },
    { eventType: 'SUBSCRIPTION_FAILED', weight: 0.18 },
    { eventType: 'INVOICE_OVERDUE', weight: 0.12 },
  ];

  const usedCaseNumbers = new Set<string>();
  const TOTAL = 1000;
  const BATCH = 50;
  const batch = [];

  for (let i = 0; i < TOTAL; i++) {
    const rand = Math.random();
    let cumWeight = 0;
    let eventType = 'PAYMENT_FAILED';
    for (const d of distributions) {
      cumWeight += d.weight;
      if (rand < cumWeight) { eventType = d.eventType; break; }
    }

    const customer = randomChoice(customers);
    const merchant = merchants.find(m => m.id === customer.merchantId) ?? merchants[0];
    const paymentMethod = randomChoice(PAYMENT_METHODS);
    const failureReason = eventType === 'CHECKOUT_ABANDONED'
      ? 'CHECKOUT_ABANDONED'
      : randomChoice(FAILURE_REASONS.filter(r => r !== 'CHECKOUT_ABANDONED'));

    const amount = (() => {
      const r = Math.random();
      if (r < 0.05) return randomFloat(100000, 500000);
      if (r < 0.15) return randomFloat(50000, 100000);
      if (r < 0.45) return randomFloat(10000, 50000);
      return randomFloat(500, 10000);
    })();

    const retryCount = randomInt(0, 3);
    const isSuspicious = Math.random() < 0.04;
    const recoveryProb = computeRecoveryProbability(
      failureReason, paymentMethod, customer.successfulPayments,
      customer.failedPayments, amount, retryCount, customer.previousRecoveries,
    );
    const riskLevel = computeRiskLevel(amount, failureReason, retryCount);
    const requiresHumanApproval = amount > 50000 || isSuspicious;

    let status: string;
    let actualRecovery = 0;

    if (isSuspicious) {
      status = 'ESCALATED';
    } else if (retryCount >= 2) {
      status = Math.random() < 0.3 ? 'RECOVERED' : 'STOPPED';
    } else if (recoveryProb > 0.6) {
      const recovered = Math.random() < recoveryProb;
      status = recovered ? 'RECOVERED' : 'FAILED';
      if (recovered) actualRecovery = amount;
    } else if (recoveryProb < 0.2) {
      status = 'STOPPED';
    } else {
      const statuses = ['OPEN', 'IN_PROGRESS', 'RECOVERED', 'FAILED', 'BLOCKED'];
      const weights = [0.15, 0.20, 0.30, 0.20, 0.15];
      let cumW = 0; const r = Math.random(); status = 'OPEN';
      for (let si = 0; si < statuses.length; si++) {
        cumW += weights[si];
        if (r < cumW) { status = statuses[si]; break; }
      }
      if (status === 'RECOVERED') actualRecovery = amount;
    }

    let caseNumber: string;
    do { caseNumber = generateCaseNumber(); } while (usedCaseNumbers.has(caseNumber));
    usedCaseNumbers.add(caseNumber);

    const createdAt = randomDate(30);
    batch.push({
      caseNumber, customerId: customer.id, merchantId: merchant.id, eventType,
      amount, currency: 'INR', failureReason, paymentMethod,
      orderId: `ORD-${uuidv4().slice(0, 8).toUpperCase()}`,
      paymentId: eventType !== 'CHECKOUT_ABANDONED' ? `pay_${uuidv4().replace(/-/g, '').slice(0, 14)}` : null,
      riskLevel, status, recoveryProbability: recoveryProb, attemptCount: retryCount,
      potentialRecovery: amount, actualRecovery, isSuspicious, requiresHumanApproval,
      lastActionAt: retryCount > 0 ? randomDate(7) : null,
      recoveredAt: status === 'RECOVERED' ? randomDate(7) : null,
      createdAt, updatedAt: createdAt,
    });

    if (batch.length === BATCH || i === TOTAL - 1) {
      await prisma.recoveryCase.createMany({ data: [...batch] });
      process.stdout.write(`\r  ${Math.min(i + 1, TOTAL)}/${TOTAL} cases`);
      batch.length = 0;
    }
  }
  console.log('\n');

  // Seed audit trail for a demo case
  console.log('Creating demo audit trail...');
  const demoCase = await prisma.recoveryCase.findFirst({
    where: { status: 'RECOVERED', eventType: 'PAYMENT_FAILED' },
    orderBy: { createdAt: 'desc' },
  });

  if (demoCase) {
    const base = new Date(demoCase.createdAt);
    const auditEvents = [
      { event: 'REVENUE_DETECTED', agent: 'DETECTOR', metadata: { amount: demoCase.amount, eventType: demoCase.eventType }, prevState: null, nextState: 'OPEN', s: 0 },
      { event: 'CASE_CLASSIFIED', agent: 'CLASSIFIER', metadata: { riskLevel: demoCase.riskLevel }, prevState: 'OPEN', nextState: 'OPEN', s: 1 },
      { event: 'RECOVERY_SCORED', agent: 'SCORER', metadata: { probability: demoCase.recoveryProbability }, prevState: 'OPEN', nextState: 'IN_PROGRESS', s: 2 },
      { event: 'DIAGNOSIS_COMPLETE', agent: 'AI_DIAGNOSIS', metadata: { rootCause: demoCase.failureReason, confidence: 'HIGH', aiUsed: true }, prevState: 'IN_PROGRESS', nextState: 'IN_PROGRESS', s: 3 },
      { event: 'POLICY_APPROVED', agent: 'POLICY_ENGINE', metadata: { decision: 'APPROVED', action: 'RETRY_PAYMENT' }, prevState: 'IN_PROGRESS', nextState: 'IN_PROGRESS', s: 4 },
      { event: 'ACTION_EXECUTING', agent: 'EXECUTOR', metadata: { action: 'RETRY_PAYMENT', provider: 'MOCK' }, prevState: 'IN_PROGRESS', nextState: 'IN_PROGRESS', s: 5 },
      { event: 'RECOVERY_SUCCESS', agent: 'EXECUTOR', metadata: { amountRecovered: demoCase.amount, action: 'RETRY_PAYMENT' }, prevState: 'IN_PROGRESS', nextState: 'RECOVERED', s: 6 },
    ];
    for (const ev of auditEvents) {
      await prisma.auditEvent.create({
        data: {
          caseId: demoCase.id, event: ev.event, agent: ev.agent,
          previousState: ev.prevState, newState: ev.nextState,
          metadata: JSON.stringify(ev.metadata),
          timestamp: new Date(base.getTime() + ev.s * 1000),
        },
      });
    }
  }

  // Seed a blocked case audit
  const blockedCase = await prisma.recoveryCase.findFirst({ where: { status: 'BLOCKED' } });
  if (blockedCase) {
    const base = new Date(blockedCase.createdAt);
    const blockEvents = [
      { event: 'REVENUE_DETECTED', agent: 'DETECTOR', metadata: { amount: blockedCase.amount }, prevState: null, nextState: 'OPEN', s: 0 },
      { event: 'DIAGNOSIS_COMPLETE', agent: 'AI_DIAGNOSIS', metadata: { rootCause: blockedCase.failureReason }, prevState: 'OPEN', nextState: 'IN_PROGRESS', s: 2 },
      { event: 'POLICY_BLOCKED', agent: 'POLICY_ENGINE', metadata: { decision: 'BLOCKED', reason: 'Maximum retry attempts exceeded', rule: 'MAX_RETRY_ATTEMPTS' }, prevState: 'IN_PROGRESS', nextState: 'BLOCKED', s: 3 },
      { event: 'ACTION_BLOCKED', agent: 'POLICY_ENGINE', metadata: { blockedAction: 'RETRY_PAYMENT', rule: 'MAX_RETRY_ATTEMPTS' }, prevState: 'IN_PROGRESS', nextState: 'BLOCKED', s: 4 },
    ];
    for (const ev of blockEvents) {
      await prisma.auditEvent.create({
        data: {
          caseId: blockedCase.id, event: ev.event, agent: ev.agent,
          previousState: ev.prevState, newState: ev.nextState,
          metadata: JSON.stringify(ev.metadata),
          timestamp: new Date(base.getTime() + ev.s * 1000),
        },
      });
    }
  }

  const allCases = await prisma.recoveryCase.groupBy({
    by: ['status'],
    _count: { _all: true },
    _sum: { amount: true, actualRecovery: true },
  });

  const totalAtRisk = allCases.reduce((s, g) => s + (g._sum.amount ?? 0), 0);
  const totalRecovered = allCases.filter(g => g.status === 'RECOVERED').reduce((s, g) => s + (g._sum.actualRecovery ?? 0), 0);

  console.log('✅ Seed complete!\n');
  console.log(`Total revenue at risk: ₹${(totalAtRisk / 100000).toFixed(2)}L`);
  console.log(`Total recovered:       ₹${(totalRecovered / 100000).toFixed(2)}L`);
  console.log(`Recovery rate:         ${(totalRecovered / totalAtRisk * 100).toFixed(1)}%`);
  console.log('\nCases by status:');
  for (const g of allCases) {
    console.log(`  ${g.status.padEnd(14)} ${String(g._count._all).padStart(5)} cases | ₹${((g._sum.amount ?? 0) / 100000).toFixed(2)}L`);
  }
}

main()
  .catch(e => { console.error('Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
