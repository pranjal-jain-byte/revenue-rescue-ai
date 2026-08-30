import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    const recoveryCase = await prisma.recoveryCase.findUnique({ where: { id } });
    if (!recoveryCase) return NextResponse.json({ error: 'Case not found' }, { status: 404 });

    await prisma.recoveryCase.update({
      where: { id },
      data: { status: 'ESCALATED', requiresHumanApproval: true, lastActionAt: new Date() },
    });

    await prisma.auditEvent.create({
      data: {
        caseId: id,
        event: 'MANUAL_ESCALATION',
        agent: 'HUMAN',
        previousState: recoveryCase.status,
        newState: 'ESCALATED',
        metadata: JSON.stringify({ reason: 'Manually escalated via UI' }),
      },
    });

    return NextResponse.json({ success: true, status: 'ESCALATED' });
  } catch (err) {
    console.error('Escalate API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
