import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { calculateBatchMetricsFromGroups } from '@/lib/utils/evaluation';

export async function GET() {
  try {
    const [
      totalCases,
      statusGroups,
      eventTypeGroups,
      escalations,
      recentAuditEvents,
      recentSimulation,
      recentCasesTable,
    ] = await Promise.all([
      prisma.recoveryCase.count(),
      prisma.recoveryCase.groupBy({
        by: ['status'],
        _count: { _all: true },
        _sum: { amount: true, actualRecovery: true },
      }),
      prisma.recoveryCase.groupBy({
        by: ['eventType'],
        _count: { _all: true },
        _sum: { amount: true, actualRecovery: true },
      }),
      prisma.recoveryCase.count({ where: { status: 'ESCALATED' } }),
      prisma.auditEvent.findMany({
        orderBy: { timestamp: 'desc' },
        take: 10,
        include: { case: { select: { caseNumber: true, amount: true } } },
      }),
      prisma.simulationRun.findFirst({
        orderBy: { startedAt: 'desc' },
        where: { status: 'COMPLETED' },
      }),
      prisma.recoveryCase.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          caseNumber: true,
          eventType: true,
          amount: true,
          recoveryProbability: true,
          status: true,
          decisions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { recommendedAction: true },
          }
        },
      }),
    ]);

    // Build accounting using the shared evaluation module
    const metrics = calculateBatchMetricsFromGroups(statusGroups);

    // Recovery by event type
    const byEventType = eventTypeGroups.map(g => ({
      eventType: g.eventType,
      count: g._count._all,
      atRisk: g._sum.amount ?? 0,
      recovered: g._sum.actualRecovery ?? 0,
    }));

    // Time series: cases by day (last 14 days)
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);
    const recentCases = await prisma.recoveryCase.findMany({
      where: { createdAt: { gte: cutoff } },
      select: { createdAt: true, status: true, actualRecovery: true, amount: true },
      orderBy: { createdAt: 'asc' },
    });

    const dayMap: Record<string, { date: string; atRisk: number; recovered: number; cases: number }> = {};
    for (const c of recentCases) {
      const day = c.createdAt.toISOString().slice(0, 10);
      if (!dayMap[day]) dayMap[day] = { date: day, atRisk: 0, recovered: 0, cases: 0 };
      dayMap[day].atRisk += c.amount;
      dayMap[day].recovered += c.actualRecovery;
      dayMap[day].cases++;
    }
    const timeSeries = Object.values(dayMap);

    return NextResponse.json({
      kpis: {
        totalAtRisk: metrics.totalAtRisk,
        totalRecovered: metrics.totalRecovered,
        unrecoverable: metrics.unrecoverable,
        recoveryRate: metrics.recoveryRate,
        totalCases,
        successfulRecoveries: metrics.successfulRecoveries,
        actionsBlocked: metrics.blockedActions,
        escalations: metrics.escalatedCases,
        opportunityEstimate: metrics.totalAtRisk * 0.15, // estimated additional recoverable
      },
      byStatus: statusGroups.map(g => ({
        status: g.status,
        count: g._count._all,
        amount: g._sum.amount ?? 0,
        recovered: g._sum.actualRecovery ?? 0,
      })),
      byEventType,
      timeSeries,
      recentAuditEvents: recentAuditEvents.map(e => ({
        id: e.id,
        event: e.event,
        agent: e.agent,
        caseNumber: e.case?.caseNumber,
        amount: e.case?.amount,
        timestamp: e.timestamp,
        metadata: e.metadata ? (typeof e.metadata === 'string' ? JSON.parse(e.metadata as string) : e.metadata) : {},
      })),
      lastSimulation: recentSimulation ? {
        id: recentSimulation.id,
        totalCases: recentSimulation.totalCases,
        recovered: recentSimulation.totalRecovered,
        atRisk: recentSimulation.totalAtRisk,
        recoveryRate: recentSimulation.recoveryRate,
        completedAt: recentSimulation.completedAt,
      } : null,
      recentCasesTable: recentCasesTable.map(c => ({
        id: c.id,
        caseNumber: c.caseNumber,
        eventType: c.eventType,
        amount: c.amount,
        recoveryProbability: c.recoveryProbability,
        status: c.status,
        recommendedAction: c.decisions[0]?.recommendedAction ?? null,
      })),
    });
  } catch (err) {
    console.error('Dashboard API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
