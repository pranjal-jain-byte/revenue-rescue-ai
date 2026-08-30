import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  eventType: z.string().optional(),
  status: z.string().optional(),
  riskLevel: z.string().optional(),
  minAmount: z.coerce.number().optional(),
  maxAmount: z.coerce.number().optional(),
  minProbability: z.coerce.number().optional(),
  search: z.string().optional(),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export async function GET(request: NextRequest) {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams);
    const query = querySchema.parse(params);

    const where: Record<string, unknown> = {};
    if (query.eventType) where.eventType = query.eventType;
    if (query.status) where.status = query.status;
    if (query.riskLevel) where.riskLevel = query.riskLevel;
    if (query.minAmount || query.maxAmount) {
      where.amount = {
        ...(query.minAmount ? { gte: query.minAmount } : {}),
        ...(query.maxAmount ? { lte: query.maxAmount } : {}),
      };
    }
    if (query.minProbability) where.recoveryProbability = { gte: query.minProbability };
    if (query.search) {
      where.OR = [
        { caseNumber: { contains: query.search } },
        { customer: { name: { contains: query.search } } },
        { failureReason: { contains: query.search } },
      ];
    }

    const [cases, total] = await Promise.all([
      prisma.recoveryCase.findMany({
        where,
        include: {
          customer: { select: { name: true, email: true, lifetimeValue: true } },
          merchant: { select: { name: true } },
          actions: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { [query.sortBy]: query.sortOrder },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.recoveryCase.count({ where }),
    ]);

    return NextResponse.json({
      cases: cases.map(c => ({
        id: c.id,
        caseNumber: c.caseNumber,
        customer: c.customer.name,
        customerEmail: c.customer.email,
        merchant: c.merchant.name,
        amount: c.amount,
        currency: c.currency,
        eventType: c.eventType,
        failureReason: c.failureReason,
        riskLevel: c.riskLevel,
        status: c.status,
        recoveryProbability: c.recoveryProbability,
        potentialRecovery: c.potentialRecovery,
        actualRecovery: c.actualRecovery,
        attemptCount: c.attemptCount,
        lastAction: c.actions[0]?.actionType ?? null,
        lastActionAt: c.lastActionAt,
        isSuspicious: c.isSuspicious,
        requiresHumanApproval: c.requiresHumanApproval,
        createdAt: c.createdAt,
      })),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit),
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid query parameters', details: err.issues }, { status: 400 });
    }
    console.error('Cases API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
