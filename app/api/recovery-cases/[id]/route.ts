import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    const recoveryCase = await prisma.recoveryCase.findUnique({
      where: { id },
      include: {
        customer: true,
        merchant: true,
        decisions: { orderBy: { createdAt: 'asc' } },
        actions: { orderBy: { createdAt: 'asc' } },
        auditEvents: { orderBy: { timestamp: 'asc' } },
      },
    });

    if (!recoveryCase) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Parse metadata from JSON strings (SQLite stores as text)
    const parsed = {
      ...recoveryCase,
      auditEvents: recoveryCase.auditEvents.map(e => ({
        ...e,
        metadata: e.metadata ? (typeof e.metadata === 'string' ? JSON.parse(e.metadata as string) : e.metadata) : null,
      })),
    };

    return NextResponse.json(parsed);

  } catch (err) {
    console.error('Case detail API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
