export interface StatusGroup {
  status: string;
  _count: { _all: number };
  _sum: { amount: number | null; actualRecovery: number | null };
}

export function calculateBatchMetricsFromGroups(statusGroups: StatusGroup[]) {
  let totalCases = 0;
  let totalAtRisk = 0;
  let totalRecovered = 0;
  let successfulRecoveries = 0;
  let escalatedCases = 0;
  let blockedActions = 0;
  let failedStoppedCases = 0;
  let totalBlockedAmount = 0;

  for (const g of statusGroups) {
    const count = g._count._all;
    const amount = g._sum.amount ?? 0;
    const recovered = g._sum.actualRecovery ?? 0;
    
    totalCases += count;
    totalAtRisk += amount;
    
    if (g.status === 'RECOVERED') {
      totalRecovered += recovered;
      successfulRecoveries += count;
    }
    if (g.status === 'ESCALATED') {
      escalatedCases += count;
    }
    if (g.status === 'BLOCKED') {
      blockedActions += count;
      totalBlockedAmount += amount;
    }
    if (g.status === 'FAILED' || g.status === 'STOPPED') {
      failedStoppedCases += count;
    }
  }

  const recoveryRate = totalAtRisk > 0 ? totalRecovered / totalAtRisk : 0;
  
  return {
    totalCases,
    totalAtRisk,
    totalRecovered,
    recoveryRate,
    successfulRecoveries,
    escalatedCases,
    blockedActions,
    failedStoppedCases,
    unrecoverable: totalAtRisk - totalRecovered - totalBlockedAmount,
  };
}
