import { NextRequest, NextResponse } from 'next/server';
import { runRecoveryWorkflow } from '@/lib/agent/workflow';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    
    // Parse injectFailure from request body if available
    let injectFailure: string | undefined;
    try {
      const body = await _req.json();
      injectFailure = body.injectFailure;
    } catch {
      // Body might be empty or invalid json, ignore
    }

    const result = await runRecoveryWorkflow(id, injectFailure);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Recover API error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
