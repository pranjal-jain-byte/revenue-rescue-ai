'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Search, ChevronUp, ChevronDown, ArrowRight, AlertTriangle } from 'lucide-react';

interface Case {
  id: string;
  caseNumber: string;
  customer: string;
  merchant: string;
  amount: number;
  currency: string;
  eventType: string;
  failureReason: string | null;
  riskLevel: string;
  status: string;
  recoveryProbability: number;
  potentialRecovery: number;
  actualRecovery: number;
  attemptCount: number;
  lastAction: string | null;
  lastActionAt: string | null;
  isSuspicious: boolean;
  requiresHumanApproval: boolean;
  createdAt: string;
}

interface CasesResponse {
  cases: Case[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

function formatINR(amount: number): string {
  if (amount >= 1_00_000) return `₹${(amount / 1_00_000).toFixed(2)}L`;
  if (amount >= 1_000) return `₹${(amount / 1_000).toFixed(1)}K`;
  return `₹${amount.toFixed(0)}`;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  PAYMENT_FAILED: 'Payment Failed',
  CHECKOUT_ABANDONED: 'Checkout Abandoned',
  SUBSCRIPTION_FAILED: 'Subscription Failed',
  INVOICE_OVERDUE: 'Invoice Overdue',
};

const ACTION_LABELS: Record<string, string> = {
  RETRY_PAYMENT: 'Retry',
  SEND_PAYMENT_REMINDER: 'Reminder',
  OFFER_ALTERNATE_PAYMENT_METHOD: 'Alt. Method',
  SEND_CHECKOUT_RECOVERY_MESSAGE: 'Cart Recovery',
  ESCALATE_TO_HUMAN: 'Escalated',
  STOP_RECOVERY: 'Stopped',
};

function ProbabilityBar({ value }: { value: number }) {
  const pct = (value * 100).toFixed(0);
  const color = value > 0.6 ? 'var(--accent-green)' : value > 0.35 ? 'var(--accent-yellow)' : 'var(--accent-red)';
  return (
    <div className="prob-bar-container" style={{ minWidth: 80 }}>
      <div className="prob-bar">
        <div className="prob-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color, flexShrink: 0 }}>{pct}%</span>
    </div>
  );
}

function SortIcon({ col, sortBy, sortOrder }: { col: string, sortBy: string, sortOrder: 'asc' | 'desc' }) {
  if (sortBy !== col) return null;
  return sortOrder === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />;
}

export default function CasesPage() {
  const [data, setData] = useState<CasesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    eventType: '',
    status: '',
    riskLevel: '',
    minAmount: '',
  });
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '25',
        sortBy,
        sortOrder,
        ...(search ? { search } : {}),
        ...(filters.eventType ? { eventType: filters.eventType } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.riskLevel ? { riskLevel: filters.riskLevel } : {}),
        ...(filters.minAmount ? { minAmount: filters.minAmount } : {}),
      });
      const res = await fetch(`/api/recovery-cases?${params}`);
      const json = await res.json() as CasesResponse;
      setData(json);
    } finally {
      setLoading(false);
    }
  }, [page, sortBy, sortOrder, search, filters]);

  useEffect(() => {
    const t = setTimeout(() => { void fetchCases(); }, 0);
    return () => clearTimeout(t);
  }, [fetchCases]);

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortOrder('desc');
    }
  };

  return (
    <div style={{ padding: '28px 32px' }} className="animate-fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
          Revenue at Risk
        </h1>
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          {data?.pagination.total.toLocaleString()} cases detected · Click any row to investigate
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '0 0 220px' }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="input"
            placeholder="Search cases, customers..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ paddingLeft: 30 }}
          />
        </div>

        <select className="input" style={{ flex: '0 0 160px' }} value={filters.eventType}
          onChange={e => { setFilters(f => ({ ...f, eventType: e.target.value })); setPage(1); }}>
          <option value="">All Event Types</option>
          <option value="PAYMENT_FAILED">Payment Failed</option>
          <option value="CHECKOUT_ABANDONED">Checkout Abandoned</option>
          <option value="SUBSCRIPTION_FAILED">Subscription Failed</option>
          <option value="INVOICE_OVERDUE">Invoice Overdue</option>
        </select>

        <select className="input" style={{ flex: '0 0 130px' }} value={filters.status}
          onChange={e => { setFilters(f => ({ ...f, status: e.target.value })); setPage(1); }}>
          <option value="">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="RECOVERED">Recovered</option>
          <option value="FAILED">Failed</option>
          <option value="ESCALATED">Escalated</option>
          <option value="BLOCKED">Blocked</option>
          <option value="STOPPED">Stopped</option>
        </select>

        <select className="input" style={{ flex: '0 0 120px' }} value={filters.riskLevel}
          onChange={e => { setFilters(f => ({ ...f, riskLevel: e.target.value })); setPage(1); }}>
          <option value="">All Risk Levels</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>

        <select className="input" style={{ flex: '0 0 140px' }} value={filters.minAmount}
          onChange={e => { setFilters(f => ({ ...f, minAmount: e.target.value })); setPage(1); }}>
          <option value="">All Amounts</option>
          <option value="1000">₹1,000+</option>
          <option value="10000">₹10,000+</option>
          <option value="50000">₹50,000+</option>
          <option value="100000">₹1L+</option>
        </select>

        {(search || filters.eventType || filters.status || filters.riskLevel || filters.minAmount) && (
          <button className="btn btn-secondary btn-sm" onClick={() => {
            setSearch('');
            setFilters({ eventType: '', status: '', riskLevel: '', minAmount: '' });
            setPage(1);
          }}>
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th onClick={() => handleSort('caseNumber')}>Case <SortIcon col="caseNumber" sortBy={sortBy} sortOrder={sortOrder} /></th>
              <th>Customer</th>
              <th>Merchant</th>
              <th onClick={() => handleSort('amount')}>Amount <SortIcon col="amount" sortBy={sortBy} sortOrder={sortOrder} /></th>
              <th>Event</th>
              <th>Failure Reason</th>
              <th onClick={() => handleSort('riskLevel')}>Risk <SortIcon col="riskLevel" sortBy={sortBy} sortOrder={sortOrder} /></th>
              <th onClick={() => handleSort('recoveryProbability')}>Recovery Prob. <SortIcon col="recoveryProbability" sortBy={sortBy} sortOrder={sortOrder} /></th>
              <th>Status</th>
              <th>Attempts</th>
              <th>Last Action</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(10)].map((_, i) => (
                <tr key={i}>
                  {[...Array(12)].map((__, j) => (
                    <td key={j}><div className="skeleton" style={{ height: 14, width: '80%' }} /></td>
                  ))}
                </tr>
              ))
            ) : data?.cases.length === 0 ? (
              <tr>
                <td colSpan={12}>
                  <div className="empty-state">
                    <div className="empty-state-icon">🔍</div>
                    <div>No cases match your filters</div>
                  </div>
                </td>
              </tr>
            ) : data?.cases.map(c => (
              <tr key={c.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {c.isSuspicious && <AlertTriangle size={11} color="var(--accent-red)" />}
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--rzp-blue)' }}>
                      {c.caseNumber}
                    </span>
                  </div>
                </td>
                <td>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{c.customer}</div>
                </td>
                <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{c.merchant}</td>
                <td>
                  <span className="amount">{formatINR(c.amount)}</span>
                </td>
                <td>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    {EVENT_TYPE_LABELS[c.eventType] ?? c.eventType}
                  </span>
                </td>
                <td style={{ maxWidth: 140 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {c.failureReason?.replace(/_/g, ' ') ?? '—'}
                  </span>
                </td>
                <td>
                  <span className={`badge badge-${c.riskLevel.toLowerCase()}`}>{c.riskLevel}</span>
                </td>
                <td>
                  <ProbabilityBar value={c.recoveryProbability} />
                </td>
                <td>
                  <span className={`badge badge-${c.status.toLowerCase().replace('_', '-')}`}>
                    {c.status.replace('_', ' ')}
                  </span>
                </td>
                <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                  {c.attemptCount}
                </td>
                <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {c.lastAction ? (ACTION_LABELS[c.lastAction] ?? c.lastAction) : '—'}
                </td>
                <td>
                  <Link
                    href={`/cases/${c.id}`}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11 }}
                  >
                    Investigate <ArrowRight size={10} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.pagination.pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Showing {((page - 1) * 25) + 1}–{Math.min(page * 25, data.pagination.total)} of {data.pagination.total.toLocaleString()} cases
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              Previous
            </button>
            <span style={{ padding: '5px 10px', fontSize: 12, color: 'var(--text-muted)' }}>
              {page} / {data.pagination.pages}
            </span>
            <button className="btn btn-secondary btn-sm" disabled={page >= data.pagination.pages} onClick={() => setPage(p => p + 1)}>
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
