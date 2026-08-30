export interface CaseDetail {
  id: string;
  caseNumber: string;
  eventType: string;
  amount: number;
  currency: string;
  failureReason: string | null;
  paymentMethod: string | null;
  orderId: string | null;
  paymentId: string | null;
  riskLevel: string;
  status: string;
  recoveryProbability: number;
  attemptCount: number;
  potentialRecovery: number;
  actualRecovery: number;
  isSuspicious: boolean;
  requiresHumanApproval: boolean;
  createdAt: string;
  recoveredAt: string | null;
  customer: {
    externalId: string;
    name: string;
    email: string;
    phone: string | null;
    lifetimeValue: number;
    successfulPayments: number;
    failedPayments: number;
    previousRecoveries: number;
    preferredPaymentMethod: string | null;
    optedOutOfMarketing: boolean;
  };
  merchant: { name: string; businessType: string };
  decisions: {
    id: string;
    step: string;
    rootCause: string | null;
    recoveryProbability: number | null;
    recommendedAction: string | null;
    confidence: string | null;
    reasoning: string | null;
    shouldEscalate: boolean;
    aiUsed: boolean;
    aiFailed: boolean;
    createdAt: string;
  }[];
  actions: {
    id: string;
    actionType: string;
    status: string;
    policyDecision: string | null;
    policyReason: string | null;
    executionResult: string | null;
    amountRecovered: number;
    createdAt: string;
  }[];
  auditEvents: {
    id: string;
    event: string;
    agent: string;
    previousState: string | null;
    newState: string | null;
    metadata: Record<string, unknown> | null;
    timestamp: string;
  }[];
}

export function formatINR(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}
