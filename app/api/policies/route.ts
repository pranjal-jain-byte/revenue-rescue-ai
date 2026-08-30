import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { invalidatePolicyCache } from '@/lib/agent/policy-engine';
import { z } from 'zod';

export async function GET() {
  try {
    const rules = await prisma.policyRule.findMany({ orderBy: { name: 'asc' } });
    return NextResponse.json({ rules });
  } catch (err) {
    console.error('Policies GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const updateSchema = z.object({
  value: z.string().min(1).optional(),
  isEnabled: z.boolean().optional(),
});

export async function PUT(request: NextRequest) {
  try {
    const { id, ...body } = await request.json() as { id: string; value?: string; isEnabled?: boolean };
    const data = updateSchema.parse(body);

    const rule = await prisma.policyRule.update({
      where: { id },
      data: {
        ...(data.value !== undefined ? { value: data.value } : {}),
        ...(data.isEnabled !== undefined ? { isEnabled: data.isEnabled } : {}),
      },
    });


    invalidatePolicyCache();

    await prisma.auditEvent.create({
      data: {
        event: 'POLICY_RULE_UPDATED',
        agent: 'ADMIN',
        metadata: JSON.stringify({ ruleKey: rule.ruleKey, newValue: data.value }),
      },
    });

    return NextResponse.json({ rule });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: err.issues }, { status: 400 });
    }
    console.error('Policy update error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
