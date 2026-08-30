'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  ArrowRight, RefreshCw, Zap
} from 'lucide-react';

interface DashboardData {
  kpis: {
    totalAtRisk: number;
    totalRecovered: number;
    unrecoverable: number;
    recoveryRate: number;
    totalCases: number;
    successfulRecoveries: number;
    actionsBlocked: number;
    escalations: number;
    opportunityEstimate: number;
  };
  byStatus: { status: string; count: number; amount: number; recovered: number }[];
  byEventType: { eventType: string; count: number; atRisk: number; recovered: number }[];
  timeSeries: { date: string; atRisk: number; recovered: number; cases: number }[];
  recentAuditEvents: {
    id: string;
    event: string;
    agent: string;
    caseNumber?: string;
    amount?: number;
    timestamp: string;
    metadata?: Record<string, unknown>;
  }[];
  lastSimulation: {
    id: string;
    totalCases: number;
    recovered: number;
    atRisk: number;
    recoveryRate: number;
    completedAt: string;
  } | null;
}

function formatINR(amount: number): string {
  if (amount >= 1_00_000) return `₹${(amount / 1_00_000).toFixed(2)}L`;
  if (amount >= 1_000) return `₹${(amount / 1_000).toFixed(1)}K`;
  return `₹${amount.toFixed(0)}`;
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  PAYMENT_FAILED: '#3d7eff',
  CHECKOUT_ABANDONED: '#a855f7',
  SUBSCRIPTION_FAILED: '#ffa502',
  INVOICE_OVERDUE: '#ff4757',
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  PAYMENT_FAILED: 'Payment Failed',
  CHECKOUT_ABANDONED: 'Checkout Abandoned',
  SUBSCRIPTION_FAILED: 'Subscription Failed',
  INVOICE_OVERDUE: 'Invoice Overdue',
};

const AUDIT_EVENT_COLORS: Record<string, string> = {
  RECOVERY_SUCCESS: 'var(--accent-green)',
  POLICY_BLOCKED: 'var(--accent-red)',
  POLICY_APPROVED: 'var(--rzp-blue)',
  CASE_ESCALATED: 'var(--accent-yellow)',
  DIAGNOSIS_COMPLETE: 'var(--accent-purple)',
  AI_FALLBACK_ACTIVATED: 'var(--accent-orange)',
};

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { color: string; name: string; value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: '10px 14px',
      fontSize: 12,
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: {formatINR(p.value)}
        </div>
      ))}
    </div>
  );
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/dashboard');
      const json = await res.json() as DashboardData;
      setData(json);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => { void fetchData(); }, 0);
    return () => clearTimeout(t);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    void fetchData();
  };

  if (loading) {
    return (
      <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="skeleton" style={{ width: 200, height: 24, marginBottom: 8 }} />
            <div className="skeleton" style={{ width: 300, height: 16 }} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[...Array(8)].map((_, i) => (
            <div key={i} className="kpi-card" style={{ height: 100 }}>
              <div className="skeleton" style={{ width: 80, height: 12, marginBottom: 12 }} />
              <div className="skeleton" style={{ width: 120, height: 28 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return <div style={{ padding: 32, color: 'var(--text-muted)' }}>Failed to load dashboard.</div>;

  const { kpis } = data;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400 }} className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            Revenue Recovery Dashboard
          </h1>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
            Monitor revenue-at-risk, recovery performance, policy decisions, and escalations.
            <span style={{ padding: '2px 8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>
              DEMO ENVIRONMENT
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          <Link href="/simulation" className="btn btn-primary btn-sm">
            <Zap size={12} />
            Run Simulation
          </Link>
        </div>
      </div>

      {/* Primary KPI Row — Revenue Recovered is the hero metric */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }} className="kpi-grid">
        {/* PRIMARY HERO METRIC */}
        <div className="kpi-card" style={{ gridColumn: 'span 1' }}>
          <div className="kpi-label">Revenue Recovered</div>
          <div className="kpi-value" style={{ color: 'var(--accent-green)' }}>
            {formatINR(kpis.totalRecovered)}
          </div>
          <div style={{ marginTop: 10 }}>
            <div className="progress-bar">
              <div
                className="progress-fill progress-fill-green"
                style={{ width: `${(kpis.recoveryRate * 100).toFixed(1)}%` }}
              />
            </div>
            <div className="kpi-sublabel" style={{ marginTop: 4 }}>
              {(kpis.recoveryRate * 100).toFixed(1)}% recovery rate
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Revenue at Risk</div>
          <div className="kpi-value">{formatINR(kpis.totalAtRisk)}</div>
          <div className="kpi-sublabel">{kpis.totalCases.toLocaleString()} cases</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Successful Recoveries</div>
          <div className="kpi-value">{kpis.successfulRecoveries.toLocaleString()}</div>
          <div className="kpi-sublabel">cases resolved</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Unrecoverable</div>
          <div className="kpi-value">{formatINR(kpis.unrecoverable)}</div>
          <div className="kpi-sublabel">not recovered</div>
        </div>
      </div>

      {/* Secondary KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        <div className="kpi-card">
          <div className="kpi-label">Cases Analyzed</div>
          <div className="kpi-value-sm">{kpis.totalCases.toLocaleString()}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Actions Blocked</div>
          <div className="kpi-value-sm" style={{ color: 'var(--accent-red)' }}>
            {kpis.actionsBlocked.toLocaleString()}
          </div>
          <div className="kpi-sublabel">by policy engine</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Human Escalations</div>
          <div className="kpi-value-sm" style={{ color: 'var(--accent-yellow)' }}>
            {kpis.escalations.toLocaleString()}
          </div>
          <div className="kpi-sublabel">requiring review</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Opportunity Estimate</div>
          <div className="kpi-value-sm" style={{ color: 'var(--accent-orange)' }}>
            {formatINR(kpis.opportunityEstimate)}
          </div>
          <div className="kpi-sublabel">additional recoverable</div>
        </div>
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Revenue Trend Chart */}
        <div className="card">
          <div className="section-header">
            <div className="section-title">Revenue Recovery Trend (14 Days)</div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data.timeSeries} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="atRiskGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ff4757" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#ff4757" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="recoveredGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00d68f" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#00d68f" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={formatINR} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="atRisk" stroke="#ff4757" strokeWidth={1.5} fill="url(#atRiskGrad)" name="At Risk" />
              <Area type="monotone" dataKey="recovered" stroke="#00d68f" strokeWidth={1.5} fill="url(#recoveredGrad)" name="Recovered" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* By Event Type Pie */}
        <div className="card">
          <div className="section-header">
            <div className="section-title">By Event Type</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.byEventType.map(et => (
              <div key={et.eventType} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: EVENT_TYPE_COLORS[et.eventType] ?? '#555',
                  flexShrink: 0,
                }} />
                <div style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)', minWidth: 0 }}>
                  {EVENT_TYPE_LABELS[et.eventType] ?? et.eventType}
                </div>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  {et.count}
                </div>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-green)' }}>
                  {formatINR(et.recovered)}
                </div>
              </div>
            ))}
          </div>

          <hr />

          {/* Status Breakdown */}
          <div className="section-title" style={{ marginBottom: 10 }}>By Status</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.byStatus.map(s => (
              <div key={s.status} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <span
                  className={`badge badge-${s.status.toLowerCase().replace('_', '-')}`}
                  style={{ minWidth: 90, justifyContent: 'center' }}
                >
                  {s.status}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>{s.count}</span>
                <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>
                  {formatINR(s.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row: Event Type Bar + Recent Audit */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Recovered by Event Type Bar */}
        <div className="card">
          <div className="section-header">
            <div className="section-title">Recovery by Event Type</div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.byEventType} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="eventType"
                tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
                tickFormatter={k => EVENT_TYPE_LABELS[k]?.split(' ')[0] ?? k}
              />
              <YAxis tick={{ fontSize: 9, fill: 'var(--text-muted)' }} tickFormatter={formatINR} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="atRisk" fill="rgba(255,71,87,0.3)" name="At Risk" radius={[2, 2, 0, 0]} />
              <Bar dataKey="recovered" fill="var(--accent-green)" name="Recovered" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Audit Events */}
        <div className="card">
          <div className="section-header">
            <div className="section-title">Recent Activity</div>
            <Link href="/audit" style={{ fontSize: 11, color: 'var(--rzp-blue)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              View all <ArrowRight size={10} />
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {data.recentAuditEvents.slice(0, 8).map((ev, i) => (
              <div
                key={ev.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 0',
                  borderBottom: i < 7 ? '1px solid var(--border-subtle)' : 'none',
                }}
              >
                <div style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  background: AUDIT_EVENT_COLORS[ev.event] ?? 'var(--text-muted)',
                  flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ev.event.replace(/_/g, ' ')}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {ev.caseNumber ? `Case ${ev.caseNumber}` : ev.agent}
                    {ev.amount ? ` · ${formatINR(ev.amount)}` : ''}
                  </div>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
                  {new Date(ev.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Last Simulation Banner */}
      {data.lastSimulation && (
        <div style={{
          marginTop: 20,
          padding: '12px 16px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                Last Simulation: {data.lastSimulation.totalCases} cases processed
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 12 }}>
                {formatINR(data.lastSimulation.recovered)} recovered of {formatINR(data.lastSimulation.atRisk)} at risk
                · {(data.lastSimulation.recoveryRate * 100).toFixed(1)}% rate
              </span>
            </div>
          </div>
          <Link href="/simulation" className="btn btn-secondary btn-sm">
            New Simulation <ArrowRight size={12} />
          </Link>
        </div>
      )}
    </div>
  );
}
