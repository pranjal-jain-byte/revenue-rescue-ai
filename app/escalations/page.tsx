'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { UserCheck, AlertTriangle, ArrowRight } from 'lucide-react';

interface EscalatedCase {
  id: string;
  caseNumber: string;
  customer: string;
  merchant: string;
  amount: number;
  eventType: string;
  failureReason: string | null;
  riskLevel: string;
  requiresHumanApproval: boolean;
  isSuspicious: boolean;
  createdAt: string;
  lastActionAt: string | null;
}

function formatINR(amount: number): string {
  if (amount >= 1_00_000) return `₹${(amount / 1_00_000).toFixed(2)}L`;
  if (amount >= 1_000) return `₹${(amount / 1_000).toFixed(1)}K`;
  return `₹${amount.toFixed(0)}`;
}

export default function EscalationsPage() {
  const [cases, setCases] = useState<EscalatedCase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch('/api/recovery-cases?status=ESCALATED&limit=50')
      .then(r => r.json())
      .then((data: { cases: EscalatedCase[] }) => { setCases(data.cases); setLoading(false); });
  }, []);

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100 }} className="animate-fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Human Escalation Queue</h1>
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          Cases that require manual review: high-value, suspicious, or low-confidence recoveries.
        </div>
      </div>

      {!loading && cases.length > 0 && (
        <div style={{ marginBottom: 20, padding: '12px 16px', background: 'var(--accent-yellow-dim)', border: '1px solid rgba(255,165,2,0.2)', borderRadius: 8, fontSize: 13, color: 'var(--accent-yellow)' }}>
          ⚠ {cases.length} case{cases.length !== 1 ? 's' : ''} require human review.
          Total value: {formatINR(cases.reduce((s, c) => s + c.amount, 0))}
        </div>
      )}

      {loading ? (
        <div className="skeleton" style={{ height: 300, borderRadius: 10 }} />
      ) : cases.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-state-icon"><UserCheck size={32} /></div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>No escalations pending</div>
          <div style={{ fontSize: 12 }}>All cases are being handled by the agent automatically.</div>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Case</th>
                <th>Customer</th>
                <th>Merchant</th>
                <th>Amount</th>
                <th>Event</th>
                <th>Reason for Escalation</th>
                <th>Risk</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cases.map(c => (
                <tr key={c.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {c.isSuspicious && <AlertTriangle size={11} color="var(--accent-red)" />}
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--rzp-blue)' }}>
                        {c.caseNumber}
                      </span>
                    </div>
                  </td>
                  <td style={{ fontSize: 13, fontWeight: 500 }}>{c.customer}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.merchant}</td>
                  <td>
                    <span className="amount" style={{ color: c.amount > 50000 ? 'var(--accent-orange)' : 'var(--text-primary)' }}>
                      {formatINR(c.amount)}
                    </span>
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {c.eventType.replace(/_/g, ' ')}
                  </td>
                  <td>
                    <div style={{ fontSize: 11 }}>
                      {c.isSuspicious && (
                        <span className="badge badge-critical">Suspicious Transaction</span>
                      )}
                      {c.amount > 100000 && (
                        <span className="badge badge-critical">Exceeds Auto-Escalation Threshold</span>
                      )}
                      {c.amount > 50000 && c.amount <= 100000 && (
                        <span className="badge badge-high">High Value — Requires Approval</span>
                      )}
                      {!c.isSuspicious && c.amount <= 50000 && (
                        <span className="badge badge-medium">Policy Escalation</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className={`badge badge-${c.riskLevel.toLowerCase()}`}>{c.riskLevel}</span>
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {new Date(c.createdAt).toLocaleDateString('en-IN')}
                  </td>
                  <td>
                    <Link href={`/cases/${c.id}`} className="btn btn-secondary btn-sm" style={{ fontSize: 11 }}>
                      Review <ArrowRight size={10} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
