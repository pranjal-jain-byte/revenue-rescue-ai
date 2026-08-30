import { useState } from 'react';
import { CaseDetail, formatINR } from '../types';

type Stage = 'DETECT' | 'DIAGNOSE' | 'PREDICT' | 'DECIDE' | 'POLICY' | 'EXECUTE' | 'OBSERVE';

const STAGES: { id: Stage; label: string; desc: string }[] = [
  { id: 'DETECT', label: 'Detect', desc: 'Identify revenue at risk' },
  { id: 'DIAGNOSE', label: 'Diagnose', desc: 'Analyze failure reason' },
  { id: 'PREDICT', label: 'Predict Recovery', desc: 'Score probability' },
  { id: 'DECIDE', label: 'Decide', desc: 'Recommend action' },
  { id: 'POLICY', label: 'Policy Gate', desc: 'Enforce safety limits' },
  { id: 'EXECUTE', label: 'Execute', desc: 'Perform recovery action' },
  { id: 'OBSERVE', label: 'Observe', desc: 'Track outcomes' },
];

export function GraphTab({ caseData }: { caseData: CaseDetail }) {
  const [selectedStage, setSelectedStage] = useState<Stage>('DETECT');
  const latestDecision = caseData.decisions[caseData.decisions.length - 1];
  const latestAction = caseData.actions[caseData.actions.length - 1];

  const renderStageDetails = () => {
    switch (selectedStage) {
      case 'DETECT':
        return (
          <div className="card">
            <div className="section-title">Detection Context</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <div className="text-muted" style={{ fontSize: 11, textTransform: 'uppercase' }}>Amount at Risk</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{formatINR(caseData.amount)}</div>
              </div>
              <div>
                <div className="text-muted" style={{ fontSize: 11, textTransform: 'uppercase' }}>Event Type</div>
                <div style={{ fontSize: 14 }}>{caseData.eventType.replace(/_/g, ' ')}</div>
              </div>
              <div>
                <div className="text-muted" style={{ fontSize: 11, textTransform: 'uppercase' }}>Customer Risk</div>
                <div style={{ fontSize: 14 }}>{caseData.riskLevel}</div>
              </div>
              <div>
                <div className="text-muted" style={{ fontSize: 11, textTransform: 'uppercase' }}>Failed Payments</div>
                <div style={{ fontSize: 14 }}>{caseData.customer.failedPayments}</div>
              </div>
            </div>
          </div>
        );
      case 'DIAGNOSE':
        if (!latestDecision) return <div className="card">No diagnosis available.</div>;
        return (
          <div className="card">
            <div className="section-title">AI Diagnosis</div>
            <div style={{ marginBottom: 16 }}>
              <div className="text-muted" style={{ fontSize: 11, textTransform: 'uppercase' }}>Root Cause</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{latestDecision.rootCause ?? 'Unknown'}</div>
            </div>
            {latestDecision.reasoning && (
              <div style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 8, fontStyle: 'italic', fontSize: 13, color: 'var(--text-secondary)' }}>
                &quot;{latestDecision.reasoning}&quot;
              </div>
            )}
            <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
              <span className={`badge ${latestDecision.aiUsed ? 'badge-success' : 'badge-warning'}`}>
                {latestDecision.aiUsed ? 'AI Engine Used' : 'Rule-based Fallback'}
              </span>
              {latestDecision.aiFailed && <span className="badge badge-critical">AI Failed</span>}
            </div>
          </div>
        );
      case 'PREDICT':
        if (!latestDecision) return <div className="card">No prediction available.</div>;
        return (
          <div className="card">
            <div className="section-title">Recovery Probability Scoring</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 16 }}>
              <div>
                <div className="text-muted" style={{ fontSize: 11, textTransform: 'uppercase' }}>Probability</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--rzp-blue)' }}>
                  {((latestDecision.recoveryProbability ?? caseData.recoveryProbability) * 100).toFixed(0)}%
                </div>
              </div>
              <div>
                <div className="text-muted" style={{ fontSize: 11, textTransform: 'uppercase' }}>Expected Recovery</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent-green)' }}>
                  {formatINR(caseData.potentialRecovery * (latestDecision.recoveryProbability ?? caseData.recoveryProbability))}
                </div>
              </div>
            </div>
          </div>
        );
      case 'DECIDE':
        if (!latestDecision) return <div className="card">No decision available.</div>;
        return (
          <div className="card">
            <div className="section-title">Agent Decision</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <div className="text-muted" style={{ fontSize: 11, textTransform: 'uppercase' }}>Recommended Action</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--rzp-blue)' }}>{latestDecision.recommendedAction?.replace(/_/g, ' ') ?? 'None'}</div>
              </div>
              <div>
                <div className="text-muted" style={{ fontSize: 11, textTransform: 'uppercase' }}>Confidence</div>
                <div style={{ fontSize: 14 }}>{latestDecision.confidence ?? 'Unknown'}</div>
              </div>
              <div>
                <div className="text-muted" style={{ fontSize: 11, textTransform: 'uppercase' }}>Requires Human Esc.</div>
                <div style={{ fontSize: 14 }}>{latestDecision.shouldEscalate ? 'Yes' : 'No'}</div>
              </div>
            </div>
          </div>
        );
      case 'POLICY':
        if (!latestAction && !latestDecision) return <div className="card">No policy evaluation available.</div>;
        return (
          <div className="card">
            <div className="section-title">Deterministic Policy Gate</div>
            <div style={{ marginBottom: 16 }}>
              <div className="text-muted" style={{ fontSize: 11, textTransform: 'uppercase' }}>Decision</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: latestAction?.policyDecision === 'BLOCKED' ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                {latestAction?.policyDecision ?? 'APPROVED'}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div className="text-muted" style={{ fontSize: 11, textTransform: 'uppercase', marginBottom: 8 }}>Safety Checks</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 6 }}>
                  <span>Retry Limit</span>
                  <span style={{ color: 'var(--accent-green)' }}>Pass ({caseData.attemptCount} / 3)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 6 }}>
                  <span>Customer Opt-out</span>
                  <span style={{ color: caseData.customer.optedOutOfMarketing ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                    {caseData.customer.optedOutOfMarketing ? 'Opted Out' : 'Pass'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 6 }}>
                  <span>Risk Level</span>
                  <span style={{ color: caseData.isSuspicious ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                    {caseData.isSuspicious ? 'Suspicious' : 'Pass'}
                  </span>
                </div>
              </div>
            </div>
            {latestAction?.policyReason && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                <strong>Reason:</strong> {latestAction.policyReason}
              </div>
            )}
          </div>
        );
      case 'EXECUTE':
        if (!latestAction) return <div className="card">No execution available.</div>;
        return (
          <div className="card">
            <div className="section-title">Execution</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <div className="text-muted" style={{ fontSize: 11, textTransform: 'uppercase' }}>Action Attempted</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{latestAction.actionType.replace(/_/g, ' ')}</div>
              </div>
              <div>
                <div className="text-muted" style={{ fontSize: 11, textTransform: 'uppercase' }}>Execution Status</div>
                <div style={{ fontSize: 14 }} className={`badge badge-${latestAction.status.toLowerCase()}`}>{latestAction.status}</div>
              </div>
            </div>
            <div style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
              {latestAction.executionResult ?? 'No execution result recorded.'}
            </div>
          </div>
        );
      case 'OBSERVE':
        return (
          <div className="card">
            <div className="section-title">Observation & Outcome</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <div className="text-muted" style={{ fontSize: 11, textTransform: 'uppercase' }}>Final Case Status</div>
                <div style={{ fontSize: 14 }} className={`badge badge-${caseData.status.toLowerCase().replace('_', '-')}`}>{caseData.status.replace('_', ' ')}</div>
              </div>
              <div>
                <div className="text-muted" style={{ fontSize: 11, textTransform: 'uppercase' }}>Amount Recovered</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: caseData.actualRecovery > 0 ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                  {formatINR(caseData.actualRecovery)}
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: 32 }}>
      {/* Interactive Pipeline */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {STAGES.map((stage, idx) => (
          <div key={stage.id} style={{ display: 'flex', alignItems: 'stretch' }}>
            <div style={{ width: 32, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ 
                width: 24, height: 24, borderRadius: 12, 
                background: selectedStage === stage.id ? 'var(--rzp-blue)' : 'var(--bg-secondary)',
                color: selectedStage === stage.id ? '#fff' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 600, zIndex: 2
              }}>
                {idx + 1}
              </div>
              {idx < STAGES.length - 1 && (
                <div style={{ width: 2, flex: 1, background: 'var(--border)', margin: '4px 0' }} />
              )}
            </div>
            <div 
              onClick={() => setSelectedStage(stage.id)}
              style={{ 
                flex: 1, padding: '12px 16px', marginLeft: 8,
                background: selectedStage === stage.id ? 'rgba(0,106,255,0.05)' : 'transparent',
                border: `1px solid ${selectedStage === stage.id ? 'var(--rzp-blue)' : 'transparent'}`,
                borderRadius: 8, cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: selectedStage === stage.id ? 'var(--rzp-blue)' : 'var(--text-primary)' }}>
                {stage.label}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {stage.desc}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Details Pane */}
      <div>
        <div style={{ position: 'sticky', top: 24 }}>
          {renderStageDetails()}
        </div>
      </div>
    </div>
  );
}
