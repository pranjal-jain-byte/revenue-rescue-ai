import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const simulation = await prisma.simulationRun.findUnique({
      where: { id },
      include: {
        results: {
          orderBy: { createdAt: 'asc' },
          take: 200,
        },
      },
    });

    if (!simulation) return NextResponse.json({ error: 'Simulation not found' }, { status: 404 });

    return NextResponse.json(simulation);
  } catch (err) {
    console.error('Simulation detail error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    
    // First check if it exists
    const simulation = await prisma.simulationRun.findUnique({
      where: { id }
    });
    
    if (!simulation) {
      return NextResponse.json({ error: 'Simulation not found' }, { status: 404 });
    }

    // Use transaction to ensure safe deletion of results then run
    await prisma.$transaction([
      prisma.simulationResult.deleteMany({
        where: { simulationId: id }
      }),
      prisma.simulationRun.delete({
        where: { id }
      })
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Simulation delete error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
