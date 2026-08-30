import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET() {
  try {
    const [
      totalCases,
      statusGroups,
      eventTypeGroups,
      escalations,
      recentAuditEvents,
      recentSimulation,
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
    ]);

    // Build accounting
    let totalAtRisk = 0;
    let totalRecovered = 0;
    let totalBlocked = 0;
    let successfulRecoveries = 0;
    let actionsBlocked = 0;

    for (const g of statusGroups) {
      const atRisk = g._sum.amount ?? 0;
      const recovered = g._sum.actualRecovery ?? 0;
      totalAtRisk += atRisk;

      if (g.status === 'RECOVERED') {
        totalRecovered += recovered;
        successfulRecoveries += g._count._all;
      }
      if (g.status === 'BLOCKED') {
        totalBlocked += atRisk;
        actionsBlocked += g._count._all;
      }
    }

    const recoveryRate = totalAtRisk > 0 ? totalRecovered / totalAtRisk : 0;
    const unrecoverable = totalAtRisk - totalRecovered - totalBlocked;

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
        totalAtRisk,
        totalRecovered,
        unrecoverable,
        recoveryRate,
        totalCases,
        successfulRecoveries,
        actionsBlocked,
        escalations,
        opportunityEstimate: totalAtRisk * 0.15, // estimated additional recoverable
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
    });
  } catch (err) {
    console.error('Dashboard API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
