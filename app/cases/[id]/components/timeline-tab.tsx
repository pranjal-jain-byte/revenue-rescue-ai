import { CaseDetail, formatINR } from '../types';

const AUDIT_DOT_CLASS: Record<string, string> = {
  RECOVERY_SUCCESS: 'timeline-dot-success',
  POLICY_BLOCKED: 'timeline-dot-blocked',
  ACTION_BLOCKED: 'timeline-dot-blocked',
  CASE_ESCALATED: 'timeline-dot-escalated',
  DIAGNOSIS_COMPLETE: 'timeline-dot-ai',
  AI_FALLBACK_ACTIVATED: 'timeline-dot-escalated',
  POLICY_APPROVED: 'timeline-dot-info',
  REVENUE_DETECTED: 'timeline-dot-info',
};

export function TimelineTab({ caseData }: { caseData: CaseDetail }) {
  if (caseData.auditEvents.length === 0) {
    return (
      <div className="empty-state" style={{ padding: '64px 0' }}>
        <div style={{ fontSize: 14 }}>No audit events yet. Run the recovery agent to begin.</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Investigation Timeline</div>
      <div className="timeline" style={{ marginLeft: 8 }}>
        {caseData.auditEvents.map(ev => (
          <div key={ev.id} className="timeline-item" style={{ marginBottom: 32, paddingBottom: 0 }}>
            <div className={`timeline-dot ${AUDIT_DOT_CLASS[ev.event] ?? ''}`} style={{ width: 14, height: 14, left: -6 }} />
            
            <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {ev.event.replace(/_/g, ' ')}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    {new Date(ev.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    <span style={{ margin: '0 8px' }}>•</span>
                    <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>Agent: {ev.agent}</span>
                  </div>
                </div>
                {ev.newState && (
                  <div className={`badge badge-${ev.newState.toLowerCase()}`} style={{ fontSize: 10 }}>
                    {ev.previousState && ev.previousState !== ev.newState ? `${ev.previousState} → ` : ''}
                    {ev.newState}
                  </div>
                )}
              </div>

              {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  {Object.entries(ev.metadata).map(([k, v]) => (
                    <div key={k} style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.1)', borderRadius: 6 }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                        {k.replace(/([A-Z])/g, ' $1')}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, wordBreak: 'break-word' }}>
                        {k.toLowerCase().includes('amount') && typeof v === 'number' ? formatINR(v) :
                          typeof v === 'object' ? JSON.stringify(v) : String(v)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
