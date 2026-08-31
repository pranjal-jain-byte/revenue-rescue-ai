import { prisma } from '../lib/db/prisma';
import { calculateBatchMetricsFromGroups } from '../lib/utils/evaluation';

async function main() {
  console.log('Fetching synthetic dataset...');
  const totalCases = await prisma.recoveryCase.count();
  
  if (totalCases === 0) {
    console.log('No cases found. Please run the seed script first.');
    return;
  }

  const statusGroups = await prisma.recoveryCase.groupBy({
    by: ['status'],
    _count: { _all: true },
    _sum: { amount: true, actualRecovery: true },
  });

  const metrics = calculateBatchMetricsFromGroups(statusGroups);

  const formatINR = (amount: number) => `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  const formatPercent = (rate: number) => `${(rate * 100).toFixed(1)}%`;

  console.log('\n========================================');
  console.log('RevenueRescue AI — Batch Evaluation');
  console.log('========================================\n');
  
  console.log('Dataset:             Synthetic');
  console.log(`Cases evaluated:     ${totalCases.toLocaleString('en-IN')}\n`);
  
  console.log(`Revenue at risk:     ${formatINR(metrics.totalAtRisk)}`);
  console.log(`Revenue recovered:   ${formatINR(metrics.totalRecovered)}`);
  console.log(`Recovery rate:       ${formatPercent(metrics.recoveryRate)}\n`);
  
  console.log(`Recovered:           ${metrics.successfulRecoveries.toLocaleString('en-IN')}`);
  console.log(`Escalated:           ${metrics.escalatedCases.toLocaleString('en-IN')}`);
  console.log(`Blocked:             ${metrics.blockedActions.toLocaleString('en-IN')}`);
  console.log(`Stopped/Failed:      ${metrics.failedStoppedCases.toLocaleString('en-IN')}\n`);
  
  console.log('Evaluation completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
