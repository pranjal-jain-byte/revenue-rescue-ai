import { useState } from 'react';
import { Shield, AlertTriangle, RefreshCw, Zap, ServerOff, Clock, Copy } from 'lucide-react';
import { CaseDetail } from '../types';

export function LabTab({ caseData, onActionComplete }: { caseData: CaseDetail, onActionComplete: (result: Record<string, unknown>) => void }) {
  const [running, setRunning] = useState<string | null>(null);

  const injectFailure = async (failureType: string) => {
    setRunning(failureType);
    try {
      const res = await fetch(`/api/recovery-cases/${caseData.id}/recover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ injectFailure: failureType }),
      });
      const result = await res.json();
      onActionComplete(result);
    } catch (err) {
      onActionComplete({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      setRunning(null);
    }
  };

  const tests = [
    {
      id: 'AI_UNAVAILABLE',
      icon: ServerOff,
      title: 'AI Service Unavailable',
      desc: 'Simulates the LLM endpoint timing out or returning 503.',
      expected: 'Deterministic fallback activated. Safe rules apply. Unsafe actions blocked.',
      color: 'var(--accent-orange)'
    },
    {
      id: 'INVALID_AI_RESPONSE',
      icon: AlertTriangle,
      title: 'Invalid AI Schema',
      desc: 'Simulates the LLM hallucinating or returning malformed JSON.',
      expected: 'Zod validation fails. Agent rejects output and safely falls back.',
      color: 'var(--accent-orange)'
    },
    {
      id: 'PAYMENT_TIMEOUT',
      icon: Clock,
      title: 'Payment Provider Timeout',
      desc: 'Simulates Razorpay API timeout during recovery execution.',
      expected: 'Idempotency lock applied. Action marked uncertain. Blind retries prevented.',
      color: 'var(--accent-red)'
    },
    {
      id: 'DUPLICATE_EVENT',
      icon: Copy,
      title: 'Duplicate Execution Event',
      desc: 'Simulates a race condition or double-click triggering recovery twice.',
      expected: 'System detects active execution/idempotency key and safely blocks duplicate.',
      color: 'var(--rzp-blue)'
    },
    {
      id: 'SUSPICIOUS_TRANSACTION',
      icon: Shield,
      title: 'Suspicious / High-Risk',
      desc: 'Injects risk flags indicating potential fraud before execution.',
      expected: 'Policy Engine intercepts execution, evaluates risk limits, and escalates.',
      color: 'var(--accent-purple)'
    }
  ];

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 32, padding: 16, background: 'rgba(255,107,53,0.05)', border: '1px solid rgba(255,107,53,0.2)', borderRadius: 8, display: 'flex', gap: 12 }}>
        <Zap size={20} color="var(--accent-orange)" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-orange)', marginBottom: 4 }}>Controlled Demo / Failure Testing</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            This reliability lab allows you to inject real-world system failures into the live recovery workflow. 
            The purpose is to demonstrate that <strong>AI failure must never become uncontrolled financial action.</strong>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {tests.map(test => {
          const Icon = test.icon;
          const isRunning = running === test.id;
          return (
            <div key={test.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ padding: 8, background: `${test.color}20`, borderRadius: 6, color: test.color }}>
                  <Icon size={16} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{test.title}</div>
              </div>
              
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, flex: 1 }}>
                {test.desc}
              </div>

              <div style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 6, marginBottom: 16, borderLeft: `2px solid ${test.color}` }}>
                <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>Expected Safe Behavior</div>
                <div style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 500 }}>{test.expected}</div>
              </div>

              <button 
                className="btn btn-secondary" 
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => injectFailure(test.id)}
                disabled={running !== null}
              >
                {isRunning ? (
                  <><RefreshCw size={14} className="animate-spin" /> Injecting...</>
                ) : (
                  <>Inject Failure & Run Agent</>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
