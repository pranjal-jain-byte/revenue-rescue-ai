'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, User, CreditCard, Play, RefreshCw, UserCheck, Bot, Shield,
} from 'lucide-react';

import { CaseDetail, formatINR } from './types';
import { TimelineTab } from './components/timeline-tab';
import { GraphTab } from './components/graph-tab';
import { LabTab } from './components/lab-tab';

function DataGrid({ fields }: { fields: { label: string; value: string | number; mono?: boolean }[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {fields.map(f => (
        <div key={f.label}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {f.label}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: f.mono ? 'var(--font-mono)' : 'inherit', wordBreak: 'break-all' }}>
            {f.value}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'TIMELINE' | 'GRAPH' | 'LAB'>('OVERVIEW');
  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [actionResult, setActionResult] = useState<{ type: 'success' | 'error' | 'blocked'; message: string } | null>(null);

  const handleActionComplete = (result: { error?: string; policyDecision?: string; reasoning?: string; status?: string; amountRecovered?: number }) => {
    if (result.error) {
      setActionResult({ type: 'error', message: result.error });
    } else if (result.policyDecision === 'BLOCKED') {
      setActionResult({ type: 'blocked', message: result.reasoning ?? 'Blocked by policy engine.' });
    } else if (result.status === 'RECOVERED') {
      setActionResult({ type: 'success', message: `Recovery successful! ${formatINR(result.amountRecovered ?? 0)} recovered.` });
    } else {
      setActionResult({ type: 'error', message: `Action taken: ${result.status} — ${result.reasoning ?? ''}` });
    }
    void fetchCase();
  };

  const fetchCase = useCallback(async () => {
    try {
      const res = await fetch(`/api/recovery-cases/${params.id as string}`);
      const json = await res.json() as CaseDetail;
      setCaseData(json);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => { void fetchCase(); }, [fetchCase]);

  const handleRecover = async () => {
    setRecovering(true);
    setActionResult(null);
    try {
      const res = await fetch(`/api/recovery-cases/${params.id as string}/recover`, { method: 'POST' });
      const result = await res.json() as { status: string; policyDecision?: string; reasoning?: string; amountRecovered?: number; error?: string };
      handleActionComplete(result);
    } finally {
      setRecovering(false);
    }
  };

  const handleEscalate = async () => {
    setEscalating(true);
    try {
      await fetch(`/api/recovery-cases/${params.id as string}/escalate`, { method: 'POST' });
      void fetchCase();
    } finally {
      setEscalating(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <div className="skeleton" style={{ width: 200, height: 20, marginBottom: 24 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card" style={{ height: 150 }} />
          ))}
        </div>
      </div>
    );
  }

  if (!caseData) return <div style={{ padding: 32, color: 'var(--text-muted)' }}>Case not found.</div>;

  const latestDecision = caseData.decisions[caseData.decisions.length - 1];

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1300 }} className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => router.back()}>
            <ArrowLeft size={13} /> Back
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700 }}>
                Case {caseData.caseNumber}
              </h1>
              <span className={`badge badge-${caseData.status.toLowerCase().replace('_', '-')}`}>
                {caseData.status.replace('_', ' ')}
              </span>
              <span className={`badge badge-${caseData.riskLevel.toLowerCase()}`}>
                {caseData.riskLevel} RISK
              </span>
              {caseData.isSuspicious && (
                <span className="badge badge-critical">⚠ SUSPICIOUS</span>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {new Date(caseData.createdAt).toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          {!['RECOVERED', 'STOPPED', 'ESCALATED'].includes(caseData.status) && (
            <>
              <button className="btn btn-danger btn-sm" onClick={handleEscalate} disabled={escalating}>
                <UserCheck size={13} />
                {escalating ? 'Escalating...' : 'Escalate to Human'}
              </button>
              <button className="btn btn-green btn-sm" onClick={handleRecover} disabled={recovering}>
                <Play size={13} className={recovering ? 'animate-spin' : ''} />
                {recovering ? 'Running Agent...' : 'Run Recovery Agent'}
              </button>
            </>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => { setLoading(true); void fetchCase(); }}>
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Action Result Banner */}
      {actionResult && (
        <div style={{
          marginBottom: 20,
          padding: '14px 18px',
          background: actionResult.type === 'success' ? 'var(--accent-green-dim)' :
            actionResult.type === 'blocked' ? 'rgba(139,144,167,0.1)' : 'var(--accent-red-dim)',
          border: `1px solid ${actionResult.type === 'success' ? 'rgba(0,214,143,0.3)' :
            actionResult.type === 'blocked' ? 'rgba(139,144,167,0.2)' : 'rgba(255,71,87,0.3)'}`,
          borderRadius: 'var(--radius)',
          fontSize: 13,
          color: actionResult.type === 'success' ? 'var(--accent-green)' :
            actionResult.type === 'blocked' ? 'var(--text-secondary)' : 'var(--accent-red)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          {actionResult.type === 'blocked' && <Shield size={14} />}
          {actionResult.type === 'blocked' && (
            <span style={{ fontWeight: 600, marginRight: 6 }}>BLOCKED BY POLICY ENGINE —</span>
          )}
          {actionResult.message}
        </div>
      )}

      {/* Dense Context Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16, marginBottom: 24, padding: '16px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Case ID</div>
          <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--rzp-blue)' }}>{caseData.caseNumber}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Amount</div>
          <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{formatINR(caseData.amount)}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Event</div>
          <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{caseData.eventType.replace(/_/g, ' ')}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Status</div>
          <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{caseData.status.replace(/_/g, ' ')}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Recovery Prob.</div>
          <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{(caseData.recoveryProbability * 100).toFixed(0)}%</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Recommended Action</div>
          <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{latestDecision?.recommendedAction?.replace(/_/g, ' ') || 'None'}</div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
        {['OVERVIEW', 'TIMELINE', 'GRAPH', 'LAB'].map(tab => {
          const tabLabels: Record<string, string> = {
            'OVERVIEW': 'Overview',
            'TIMELINE': 'Investigation Timeline',
            'GRAPH': 'Decision Graph',
            'LAB': 'Reliability Lab'
          };
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as 'OVERVIEW' | 'TIMELINE' | 'GRAPH' | 'LAB')}
              style={{
                padding: '12px 0',
                fontSize: 13,
                fontWeight: 600,
                color: activeTab === tab ? 'var(--rzp-blue)' : 'var(--text-muted)',
                borderBottom: activeTab === tab ? '2px solid var(--rzp-blue)' : '2px solid transparent',
                background: 'transparent',
                borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}
            >
              {tabLabels[tab]}
            </button>
          );
        })}
      </div>

      {activeTab === 'TIMELINE' && <TimelineTab caseData={caseData} />}
      {activeTab === 'GRAPH' && <GraphTab caseData={caseData} />}
      {activeTab === 'LAB' && <LabTab caseData={caseData} onActionComplete={handleActionComplete} />}

      {activeTab === 'OVERVIEW' && (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Customer Context */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <User size={14} color="var(--text-muted)" />
              <div className="section-title" style={{ margin: 0 }}>Customer Context</div>
            </div>
            <DataGrid fields={[
              { label: 'Name', value: caseData.customer.name },
              { label: 'Customer ID', value: caseData.customer.externalId },
              { label: 'Email', value: caseData.customer.email },
              { label: 'Phone', value: caseData.customer.phone ?? '—' },
              { label: 'Lifetime Value', value: formatINR(caseData.customer.lifetimeValue), mono: true },
              { label: 'Merchant', value: caseData.merchant.name },
              { label: 'Successful Payments', value: String(caseData.customer.successfulPayments) },
              { label: 'Failed Payments', value: String(caseData.customer.failedPayments) },
              { label: 'Previous Recoveries', value: String(caseData.customer.previousRecoveries) },
              { label: 'Preferred Method', value: caseData.customer.preferredPaymentMethod ?? '—' },
            ]} />
            {caseData.customer.optedOutOfMarketing && (
              <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--accent-red-dim)', borderRadius: 6, fontSize: 12, color: 'var(--accent-red)' }}>
                Customer has opted out of marketing communications
              </div>
            )}
          </div>

          {/* Transaction Context */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <CreditCard size={14} color="var(--text-muted)" />
              <div className="section-title" style={{ margin: 0 }}>Transaction Context</div>
            </div>
            <DataGrid fields={[
              { label: 'Amount', value: formatINR(caseData.amount), mono: true },
              { label: 'Currency', value: caseData.currency },
              { label: 'Event Type', value: caseData.eventType.replace(/_/g, ' ') },
              { label: 'Payment Method', value: caseData.paymentMethod ?? '—' },
              { label: 'Failure Reason', value: caseData.failureReason?.replace(/_/g, ' ') ?? '—' },
              { label: 'Attempt Count', value: String(caseData.attemptCount) },
              { label: 'Order ID', value: caseData.orderId ?? '—', mono: true },
              { label: 'Payment ID', value: caseData.paymentId ?? '—', mono: true },
            ]} />
          </div>

          {/* Recovery Summary */}
          <div className="card">
            <div className="section-title" style={{ marginBottom: 14 }}>Recovery Summary</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div style={{ textAlign: 'center', padding: '12px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>At Risk</div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-red)' }}>
                  {formatINR(caseData.potentialRecovery)}
                </div>
              </div>
              <div style={{ textAlign: 'center', padding: '12px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Recovery Prob.</div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: caseData.recoveryProbability > 0.6 ? 'var(--accent-green)' : 'var(--accent-yellow)' }}>
                  {(caseData.recoveryProbability * 100).toFixed(0)}%
                </div>
              </div>
              <div style={{ textAlign: 'center', padding: '12px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Recovered</div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-green)' }}>
                  {formatINR(caseData.actualRecovery)}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Agent Analysis */}
          {latestDecision && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Bot size={14} color="var(--accent-purple)" />
                <div className="section-title" style={{ margin: 0 }}>Agent Analysis</div>
                <span style={{ marginLeft: 'auto', fontSize: 10, padding: '2px 7px', background: latestDecision.aiUsed && !latestDecision.aiFailed ? 'var(--accent-purple-dim)' : 'rgba(139,144,167,0.1)', borderRadius: 4, color: latestDecision.aiUsed && !latestDecision.aiFailed ? 'var(--accent-purple)' : 'var(--text-muted)', fontWeight: 600 }}>
                  {latestDecision.aiUsed && !latestDecision.aiFailed ? 'AI DIAGNOSIS' : 'RULE-BASED FALLBACK'}
                </span>
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Why is this revenue at risk?
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>
                  {latestDecision.rootCause ?? caseData.failureReason?.replace(/_/g, ' ') ?? 'Unknown failure reason.'}
                </div>
              </div>

              <div style={{ marginBottom: 14, padding: '12px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Historical Customer Behavior
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                  <div style={{ color: 'var(--accent-green)' }}>
                    {caseData.customer.successfulPayments} successful payments
                  </div>
                  <div style={{ color: caseData.customer.failedPayments > 0 ? 'var(--accent-red)' : 'var(--text-muted)' }}>
                    {caseData.customer.failedPayments} previous failure(s)
                  </div>
                  <div style={{ color: caseData.customer.previousRecoveries > 0 ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                    {caseData.customer.previousRecoveries} previous recovery(ies)
                  </div>
                </div>
              </div>

              {latestDecision.reasoning && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Agent Reasoning
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, fontStyle: 'italic' }}>
                    &quot;{latestDecision.reasoning}&quot;
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ padding: '10px', background: 'var(--bg-secondary)', borderRadius: 6 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>RECOMMENDED ACTION</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--rzp-blue)' }}>
                    {latestDecision.recommendedAction?.replace(/_/g, ' ') ?? '—'}
                  </div>
                </div>
                <div style={{ padding: '10px', background: 'var(--bg-secondary)', borderRadius: 6 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>CONFIDENCE</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: latestDecision.confidence === 'HIGH' ? 'var(--accent-green)' : latestDecision.confidence === 'MEDIUM' ? 'var(--accent-yellow)' : 'var(--accent-red)' }}>
                    {latestDecision.confidence ?? '—'}
                  </div>
                </div>
              </div>

              {latestDecision.aiFailed && (
                <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(255,107,53,0.08)', border: '1px solid rgba(255,107,53,0.2)', borderRadius: 6, fontSize: 11, color: 'var(--accent-orange)' }}>
                  AI diagnosis unavailable — deterministic fallback active. No financial action executed from AI output alone.
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          {caseData.actions.length > 0 && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Shield size={14} color="var(--text-muted)" />
                <div className="section-title" style={{ margin: 0 }}>Policy & Execution History</div>
              </div>
              {caseData.actions.map(action => (
                <div key={action.id} style={{
                  padding: '12px',
                  background: action.policyDecision === 'BLOCKED' ? 'rgba(255,71,87,0.05)' :
                    action.status === 'SUCCEEDED' ? 'rgba(0,214,143,0.05)' : 'var(--bg-secondary)',
                  border: `1px solid ${action.policyDecision === 'BLOCKED' ? 'rgba(255,71,87,0.15)' :
                    action.status === 'SUCCEEDED' ? 'rgba(0,214,143,0.15)' : 'var(--border)'}`,
                  borderRadius: 8,
                  marginBottom: 10,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{action.actionType.replace(/_/g, ' ')}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {action.policyDecision && (
                        <span className={`badge policy-${action.policyDecision.toLowerCase()}`} style={{ fontSize: 10 }}>
                          {action.policyDecision === 'BLOCKED' ? 'POLICY BLOCKED' : action.policyDecision === 'APPROVED' ? 'APPROVED' : 'ESCALATE'}
                        </span>
                      )}
                      <span className={`badge badge-${action.status.toLowerCase()}`}>{action.status}</span>
                    </div>
                  </div>
                  {action.policyReason && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                      Policy: {action.policyReason}
                    </div>
                  )}
                  {action.executionResult && (
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      {action.executionResult}
                    </div>
                  )}
                  {action.amountRecovered > 0 && (
                    <div style={{ marginTop: 6, fontSize: 12, fontWeight: 600, color: 'var(--accent-green)' }}>
                      Recovered: {formatINR(action.amountRecovered)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
