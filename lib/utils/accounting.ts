/**
 * Revenue Accounting Utilities
 * Handles consistent money math for the recovery pipeline.
 * All amounts are in INR paise internally, displayed as rupees.
 */

export interface RevenueAccounting {
  totalAtRisk: number;
  recoveredViaRetry: number;
  recoveredViaReminder: number;
  recoveredViaAlternate: number;
  recoveredViaOther: number;
  totalRecovered: number;
  escalated: number;
  blocked: number;
  unrecovered: number;
  recoveryRate: number;
}

export function buildAccounting(results: Array<{
  amount: number;
  recovered: number;
  status: string;
  actionTaken: string | null | undefined;
}>): RevenueAccounting {
  let totalAtRisk = 0;
  let recoveredViaRetry = 0;
  let recoveredViaReminder = 0;
  let recoveredViaAlternate = 0;
  let recoveredViaOther = 0;
  let escalated = 0;
  let blocked = 0;
  let unrecovered = 0;

  for (const r of results) {
    totalAtRisk += r.amount;

    if (r.status === 'RECOVERED') {
      if (r.actionTaken === 'RETRY_PAYMENT') recoveredViaRetry += r.recovered;
      else if (r.actionTaken === 'SEND_PAYMENT_REMINDER') recoveredViaReminder += r.recovered;
      else if (r.actionTaken === 'OFFER_ALTERNATE_PAYMENT_METHOD') recoveredViaAlternate += r.recovered;
      else recoveredViaOther += r.recovered;
    } else if (r.status === 'ESCALATED') {
      escalated += r.amount;
    } else if (r.status === 'BLOCKED') {
      blocked += r.amount;
    } else {
      unrecovered += r.amount;
    }
  }

  const totalRecovered = recoveredViaRetry + recoveredViaReminder + recoveredViaAlternate + recoveredViaOther;

  // Invariant: totalRecovered MUST NOT exceed totalAtRisk
  const safeRecovered = Math.min(totalRecovered, totalAtRisk);

  const recoveryRate = totalAtRisk > 0 ? safeRecovered / totalAtRisk : 0;

  return {
    totalAtRisk,
    recoveredViaRetry,
    recoveredViaReminder,
    recoveredViaAlternate,
    recoveredViaOther,
    totalRecovered: safeRecovered,
    escalated,
    blocked,
    unrecovered,
    recoveryRate,
  };
}

/**
 * Format amount as Indian Rupees
 */
export function formatINR(amount: number): string {
  if (amount >= 10_00_000) {
    return `₹${(amount / 1_00_000).toFixed(2)}L`;
  }
  if (amount >= 1_000) {
    return `₹${(amount / 1_000).toFixed(1)}K`;
  }
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export function formatINRFull(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/**
 * Validate that recovered revenue is internally consistent
 */
export function validateAccounting(accounting: RevenueAccounting): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (accounting.totalRecovered > accounting.totalAtRisk) {
    errors.push(`ACCOUNTING_ERROR: Recovered (${accounting.totalRecovered}) exceeds at-risk (${accounting.totalAtRisk})`);
  }

  if (accounting.recoveryRate < 0 || accounting.recoveryRate > 1) {
    errors.push(`ACCOUNTING_ERROR: Recovery rate ${accounting.recoveryRate} out of range [0,1]`);
  }

  const sumParts = accounting.recoveredViaRetry + accounting.recoveredViaReminder +
    accounting.recoveredViaAlternate + accounting.recoveredViaOther;
  if (Math.abs(sumParts - accounting.totalRecovered) > 1) {
    errors.push(`ACCOUNTING_ERROR: Recovery parts sum ${sumParts} ≠ totalRecovered ${accounting.totalRecovered}`);
  }

  return { valid: errors.length === 0, errors };
}
