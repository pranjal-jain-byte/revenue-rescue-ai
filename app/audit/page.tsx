'use client';

import { useEffect, useState, useCallback } from 'react';
import { ScrollText, RefreshCw } from 'lucide-react';

interface AuditEvent {
  id: string;
  event: string;
  agent: string;
  caseNumber?: string;
  amount?: number;
  eventType?: string;
  status?: string;
  timestamp: string;
  previousState: string | null;
  newState: string | null;
  metadata: Record<string, unknown> | null;
  case?: {
    caseNumber: string;
    amount: number;
    eventType: string;
    status: string;
  } | null;
}

const EVENT_COLORS: Record<string, string> = {
  RECOVERY_SUCCESS: 'var(--accent-green)',
  POLICY_BLOCKED: 'var(--accent-red)',
  ACTION_BLOCKED: 'var(--accent-red)',
  POLICY_APPROVED: 'var(--rzp-blue)',
  CASE_ESCALATED: 'var(--accent-yellow)',
  MANUAL_ESCALATION: 'var(--accent-yellow)',
  DIAGNOSIS_COMPLETE: 'var(--accent-purple)',
  AI_FALLBACK_ACTIVATED: 'var(--accent-orange)',
  REVENUE_DETECTED: 'var(--rzp-blue)',
  CASE_CLASSIFIED: 'var(--text-secondary)',
  RECOVERY_SCORED: 'var(--text-secondary)',
  ACTION_EXECUTING: 'var(--accent-purple)',
  ACTION_EXECUTED: 'var(--text-secondary)',
  POLICY_RULE_UPDATED: 'var(--accent-yellow)',
};

const AGENT_BADGES: Record<string, { label: string; color: string }> = {
  DETECTOR: { label: 'DETECTOR', color: 'var(--rzp-blue)' },
  CLASSIFIER: { label: 'CLASSIFIER', color: 'var(--text-secondary)' },
  AI_DIAGNOSIS: { label: 'AI', color: 'var(--accent-purple)' },
  SCORER: { label: 'SCORER', color: 'var(--text-secondary)' },
  POLICY_ENGINE: { label: 'POLICY', color: 'var(--accent-yellow)' },
  EXECUTOR: { label: 'EXECUTOR', color: 'var(--accent-green)' },
  SYSTEM: { label: 'SYSTEM', color: 'var(--text-muted)' },
  HUMAN: { label: 'HUMAN', color: 'var(--accent-orange)' },
  ADMIN: { label: 'ADMIN', color: 'var(--accent-orange)' },
  WORKFLOW: { label: 'WORKFLOW', color: 'var(--rzp-blue)' },
};

function formatINR(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [limit, setLimit] = useState(100);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(`/api/audit-events?limit=${limit}`);
      const data = await res.json() as { events: AuditEvent[] };
      setEvents(data.events);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [limit]);

  useEffect(() => { void fetchEvents(); }, [fetchEvents]);

  const handleRefresh = () => { setRefreshing(true); void fetchEvents(); };

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100 }} className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Audit Trail</h1>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            Every agent decision, policy check, and financial action is recorded here.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <select className="input" style={{ width: 120 }} value={limit} onChange={e => setLimit(Number(e.target.value))}>
            <option value={50}>50 events</option>
            <option value={100}>100 events</option>
            <option value={200}>200 events</option>
          </select>
          <button className="btn btn-secondary btn-sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...Array(8)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 64, borderRadius: 8 }} />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-state-icon"><ScrollText size={32} /></div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>No audit events yet</div>
          <div style={{ fontSize: 12 }}>Run the recovery agent on a case to generate audit events.</div>
        </div>
      ) : (
        <div className="timeline">
          {events.map(ev => {
            const color = EVENT_COLORS[ev.event] ?? 'var(--text-muted)';
            const agentBadge = AGENT_BADGES[ev.agent] ?? { label: ev.agent, color: 'var(--text-muted)' };
            const dotClass = ['RECOVERY_SUCCESS'].includes(ev.event) ? 'timeline-dot-success' :
              ['POLICY_BLOCKED', 'ACTION_BLOCKED'].includes(ev.event) ? 'timeline-dot-blocked' :
              ['CASE_ESCALATED', 'MANUAL_ESCALATION', 'AI_FALLBACK_ACTIVATED'].includes(ev.event) ? 'timeline-dot-escalated' :
              ['DIAGNOSIS_COMPLETE', 'ACTION_EXECUTING'].includes(ev.event) ? 'timeline-dot-ai' :
              'timeline-dot-info';

            return (
              <div key={ev.id} className="timeline-item animate-slide-in">
                <div className={`timeline-dot ${dotClass}`} />
                <div style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '12px 16px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color }}>{ev.event.replace(/_/g, ' ')}</span>
                      <span style={{
                        fontSize: 9,
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: 3,
                        background: 'var(--bg-elevated)',
                        color: agentBadge.color,
                        letterSpacing: '0.05em',
                      }}>
                        {agentBadge.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {new Date(ev.timestamp).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: 'short' })}
                    </div>
                  </div>

                  {ev.case && (
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, display: 'flex', gap: 10 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--rzp-blue)' }}>
                        {ev.case.caseNumber}
                      </span>
                      <span>{formatINR(ev.case.amount)}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{ev.case.eventType.replace(/_/g, ' ')}</span>
                    </div>
                  )}

                  {ev.previousState && ev.newState && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                      State: <span style={{ color: 'var(--text-secondary)' }}>{ev.previousState}</span>
                      {' → '}
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{ev.newState}</span>
                    </div>
                  )}

                  {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {Object.entries(ev.metadata).slice(0, 4).map(([k, v]) => (
                        <span key={k} style={{
                          fontSize: 10,
                          padding: '1px 7px',
                          background: 'var(--bg-secondary)',
                          borderRadius: 4,
                          border: '1px solid var(--border)',
                          color: 'var(--text-muted)',
                        }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{k}:</span>{' '}
                          {typeof v === 'object' ? JSON.stringify(v).slice(0, 40) : String(v).slice(0, 60)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
