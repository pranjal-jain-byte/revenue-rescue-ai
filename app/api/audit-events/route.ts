import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  try {
    const limit = parseInt(request.nextUrl.searchParams.get('limit') ?? '50');
    const caseId = request.nextUrl.searchParams.get('caseId');

    const where = caseId ? { caseId } : {};

    const events = await prisma.auditEvent.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: Math.min(limit, 200),
      include: {
        case: {
          select: {
            caseNumber: true,
            amount: true,
            eventType: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json({
      events: events.map(e => ({
        ...e,
        metadata: e.metadata ? (typeof e.metadata === 'string' ? JSON.parse(e.metadata as string) : e.metadata) : null,
      })),
    });
  } catch (err) {
    console.error('Audit events error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
