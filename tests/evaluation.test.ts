import { calculateBatchMetricsFromGroups, StatusGroup } from '../lib/utils/evaluation';

describe('Evaluation Metrics', () => {
  it('should correctly calculate recovery rate and totals', () => {
    const mockGroups: StatusGroup[] = [
      { status: 'RECOVERED', _count: { _all: 300 }, _sum: { amount: 3000, actualRecovery: 3000 } },
      { status: 'FAILED', _count: { _all: 100 }, _sum: { amount: 1000, actualRecovery: 0 } },
      { status: 'ESCALATED', _count: { _all: 50 }, _sum: { amount: 500, actualRecovery: 0 } },
      { status: 'BLOCKED', _count: { _all: 50 }, _sum: { amount: 500, actualRecovery: 0 } },
    ];

    const metrics = calculateBatchMetricsFromGroups(mockGroups);

    expect(metrics.totalCases).toBe(500);
    expect(metrics.totalAtRisk).toBe(5000);
    expect(metrics.totalRecovered).toBe(3000);
    expect(metrics.recoveryRate).toBe(0.6); // 3000 / 5000
    expect(metrics.successfulRecoveries).toBe(3000 / 10); // 300 (using the mock counts)
    expect(metrics.escalatedCases).toBe(50);
    expect(metrics.blockedActions).toBe(50);
    expect(metrics.failedStoppedCases).toBe(100);
    expect(metrics.unrecoverable).toBe(1500); // 5000 - 3000 - 500 (blocked)
  });

  it('should handle zero cases', () => {
    const mockGroups: StatusGroup[] = [];

    const metrics = calculateBatchMetricsFromGroups(mockGroups);

    expect(metrics.totalCases).toBe(0);
    expect(metrics.totalAtRisk).toBe(0);
    expect(metrics.totalRecovered).toBe(0);
    expect(metrics.recoveryRate).toBe(0);
  });

  it('should handle missing sum data gracefully', () => {
    const mockGroups: StatusGroup[] = [
      { status: 'RECOVERED', _count: { _all: 10 }, _sum: { amount: null, actualRecovery: null } },
    ];

    const metrics = calculateBatchMetricsFromGroups(mockGroups);

    expect(metrics.totalCases).toBe(10);
    expect(metrics.totalAtRisk).toBe(0);
    expect(metrics.totalRecovered).toBe(0);
  });
});
