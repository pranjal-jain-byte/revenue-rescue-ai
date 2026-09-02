'use client';

import { useState, useEffect, useRef } from 'react';
import { Play, CheckCircle2, Loader, AlertTriangle, TrendingUp, Shield, MoreVertical, Trash2, FileText, SplitSquareHorizontal, X } from 'lucide-react';

interface SimulationRun {
  id: string;
  name: string;
  totalCases: number;
  processedCases: number;
  totalAtRisk: number;
  totalRecovered: number;
  totalUnrecovered: number;
  totalBlocked: number;
  totalEscalated: number;
  actionsExecuted: number;
  actionsBlocked: number;
  escalations: number;
  recoveryRate: number;
  avgRecoveryTimeMs: number;
  status: string;
  startedAt: string;
  completedAt: string | null;
  batchId?: string;
  policyVersion?: string;
  policyHash?: string;
  policySnapshot?: string;
  previousPolicyVersion?: string;
  policyChanges?: string;
}

function formatINR(amount: number): string {
  if (amount >= 1_00_000) return `₹${(amount / 1_00_000).toFixed(2)}L`;
  if (amount >= 1_000) return `₹${(amount / 1_000).toFixed(1)}K`;
  return `₹${amount.toFixed(0)}`;
}

const AGENT_STEPS = [
  { key: 'detect', label: 'Detecting revenue at risk...', icon: AlertTriangle },
  { key: 'classify', label: 'Classifying cases...', icon: TrendingUp },
  { key: 'diagnose', label: 'Diagnosing failures...', icon: Play },
  { key: 'score', label: 'Scoring recovery probability...', icon: TrendingUp },
  { key: 'policy', label: 'Checking policy guardrails...', icon: Shield },
  { key: 'execute', label: 'Executing recoveries...', icon: Play },
  { key: 'audit', label: 'Logging audit trail...', icon: CheckCircle2 },
  { key: 'calculate', label: 'Calculating recovered revenue...', icon: TrendingUp },
];

export default function BatchEvaluationPage() {
  const [simSize, setSimSize] = useState(100);
  const [simName, setSimName] = useState('');
  const [reuseBatchId, setReuseBatchId] = useState<string>('');
  const [running, setRunning] = useState(false);

  const [simulation, setSimulation] = useState<SimulationRun | null>(null);
  const [currentStep, setCurrentStep] = useState(-1);
  const [pastSimulations, setPastSimulations] = useState<SimulationRun[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [viewDetailsModal, setViewDetailsModal] = useState<SimulationRun | null>(null);
  const [deleteModal, setDeleteModal] = useState<SimulationRun | null>(null);
  const [compareModal, setCompareModal] = useState<[SimulationRun, SimulationRun] | null>(null);
  const [compareSelectId, setCompareSelectId] = useState<string>('');
  const [compareTarget, setCompareTarget] = useState<SimulationRun | null>(null);

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const loadPastSimulations = async () => {
    const res = await fetch('/api/simulations');
    const data = await res.json() as { simulations: SimulationRun[] };
    setPastSimulations(data.simulations);
  };

  useEffect(() => {
    const t = setTimeout(() => { void loadPastSimulations(); }, 0);
    return () => {
      clearTimeout(t);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const startSimulation = async () => {
    setRunning(true);
    setSimulation(null);
    setCurrentStep(0);

    for (let i = 0; i < AGENT_STEPS.length - 1; i++) {
      await new Promise(r => setTimeout(r, 400 + i * 200));
      setCurrentStep(i + 1);
    }

    const name = simName || `Evaluation ${new Date().toLocaleTimeString('en-IN')}`;
    const payload: any = { caseCount: simSize, name };
    if (reuseBatchId) payload.reuseBatchId = reuseBatchId;

    const res = await fetch('/api/simulations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const { simulationId: id } = await res.json() as { simulationId: string };

    pollRef.current = setInterval(async () => {
      const simRes = await fetch(`/api/simulations/${id}`);
      const sim = await simRes.json() as SimulationRun;
      setSimulation(sim);

      if (sim.status === 'COMPLETED' || sim.status === 'FAILED') {
        if (pollRef.current) clearInterval(pollRef.current);
        setCurrentStep(AGENT_STEPS.length);
        setRunning(false);
        void loadPastSimulations();
      }
    }, 1000);
  };

  const deleteSimulation = async (id: string) => {
    await fetch(`/api/simulations/${id}`, { method: 'DELETE' });
    setDeleteModal(null);
    void loadPastSimulations();
  };

  const progressPct = simulation
    ? Math.min(100, (simulation.processedCases / simulation.totalCases) * 100)
    : currentStep >= 0
    ? (currentStep / AGENT_STEPS.length) * 50
    : 0;

  // Extract unique batches for reuse dropdown
  const uniqueBatches = Array.from(new Set(pastSimulations.map(s => s.batchId).filter(Boolean))) as string[];

  const formatPolicyChanges = (sim: SimulationRun) => {
    if (!sim.policyVersion) return null;
    if (!sim.policyChanges || sim.policyChanges === '{}') return 'Baseline';
    
    try {
      const changes = JSON.parse(sim.policyChanges);
      const keys = Object.keys(changes);
      if (keys.length === 0) return 'Baseline';
      return `+${keys.length} change${keys.length > 1 ? 's' : ''}`;
    } catch {
      return 'Baseline';
    }
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1000 }} className="animate-fade-in">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Batch Evaluation</h1>
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          Compare recovery strategies across controlled synthetic cases.
        </div>
      </div>

      {/* Configuration Card */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="section-title" style={{ marginBottom: 16 }}>Configure Evaluation</div>

        <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          {[100, 500, 1000].map(n => (
            <button
              key={n}
              className={`btn ${simSize === n && !reuseBatchId ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: '1 1 100px' }}
              onClick={() => { setSimSize(n); setReuseBatchId(''); }}
              disabled={running}
            >
              {n} cases
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 20, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              Evaluation Name (optional)
            </label>
            <input
              className="input"
              placeholder={`e.g. V2 Evaluation`}
              value={simName}
              onChange={e => setSimName(e.target.value)}
              disabled={running}
              style={{ width: '100%' }}
            />
          </div>
          
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              Reuse Same Batch (optional)
            </label>
            <select
              className="input"
              value={reuseBatchId}
              onChange={e => setReuseBatchId(e.target.value)}
              disabled={running}
              style={{ width: '100%' }}
            >
              <option value="">No - Random new cases</option>
              {uniqueBatches.map(b => (
                <option key={b} value={b}>Batch {b}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          className="btn btn-green btn-lg"
          onClick={startSimulation}
          disabled={running}
          style={{ minWidth: 200 }}
        >
          {running ? (
            <><Loader size={16} className="animate-spin" /> Running Evaluation...</>
          ) : (
            <><Play size={16} /> Run Batch Evaluation</>
          )}
        </button>
      </div>

      {/* Progress & Results Code omitted for brevity, reusing exactly the same */}
      {(running || simulation?.id) && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="section-title" style={{ marginBottom: 16 }}>Agent Workflow Progress</div>
          <div className="progress-bar" style={{ marginBottom: 16, height: 6 }}>
            <div
              className="progress-fill progress-fill-green"
              style={{ width: `${progressPct}%`, transition: 'width 0.5s ease' }}
            />
          </div>
          {simulation && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              Processed {(simulation.processedCases ?? 0).toLocaleString()} / {(simulation.totalCases ?? 0).toLocaleString()} cases
              {simulation.status === 'COMPLETED' && ' · ✅ Completed'}
              {simulation.status === 'FAILED' && ' · ❌ Failed'}
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {simulation?.status === 'COMPLETED' && (
        <div className="card animate-fade-in" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <CheckCircle2 size={18} color="var(--accent-green)" />
            <div style={{ fontSize: 16, fontWeight: 700 }}>Evaluation Complete</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total at Risk', value: formatINR(simulation.totalAtRisk), color: 'var(--accent-red)' },
              { label: 'Recovered', value: formatINR(simulation.totalRecovered), color: 'var(--accent-green)' },
              { label: 'Unrecovered', value: formatINR(simulation.totalUnrecovered), color: 'var(--text-muted)' },
              { label: 'Escalated', value: formatINR(simulation.totalEscalated), color: 'var(--accent-yellow)' },
            ].map(stat => (
              <div key={stat.label} style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{stat.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)', color: stat.color }}>{stat.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past Evaluations Table */}
      {pastSimulations.length > 0 && (
        <div className="card">
          <div className="section-title" style={{ marginBottom: 14 }}>Past Evaluations</div>
          <div className="table-container" style={{ overflow: 'visible' }}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Cases</th>
                  <th>Policy</th>
                  <th>At Risk</th>
                  <th>Recovered</th>
                  <th>Rate</th>
                  <th>Blocked</th>
                  <th>Batch</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pastSimulations.map(sim => (
                  <tr key={sim.id}>
                    <td style={{ fontSize: 12 }}>{sim.name}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{sim.totalCases}</td>
                    <td>
                      {sim.policyVersion ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{sim.policyVersion}</span>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatPolicyChanges(sim)}</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Legacy</span>
                      )}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-red)' }}>{formatINR(sim.totalAtRisk)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-green)' }}>{formatINR(sim.totalRecovered)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{(sim.recoveryRate * 100).toFixed(1)}%</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-red)' }}>{sim.actionsBlocked}</td>
                    <td>
                       {sim.batchId ? <span className="badge badge-secondary" style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>{sim.batchId}</span> : '-'}
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {new Date(sim.startedAt).toLocaleDateString('en-IN')}
                    </td>
                    <td style={{ position: 'relative' }}>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '4px', height: 'auto', minHeight: 'unset' }}
                        onClick={() => setOpenDropdown(openDropdown === sim.id ? null : sim.id)}
                      >
                        <MoreVertical size={14} />
                      </button>
                      
                      {openDropdown === sim.id && (
                        <>
                          <div 
                            style={{ position: 'fixed', inset: 0, zIndex: 9 }} 
                            onClick={() => setOpenDropdown(null)}
                          />
                          <div style={{ 
                            position: 'absolute', right: 0, top: '100%', marginTop: 4, 
                            background: 'var(--bg)', border: '1px solid var(--border)', 
                            borderRadius: 6, padding: 4, zIndex: 10, width: 140,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                          }}>
                            <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 2, padding: '6px 8px', border: 'none' }} onClick={() => { setViewDetailsModal(sim); setOpenDropdown(null); }}>
                              <FileText size={14} /> View Details
                            </button>
                            <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 2, padding: '6px 8px', border: 'none' }} onClick={() => { setCompareTarget(sim); setOpenDropdown(null); }}>
                              <SplitSquareHorizontal size={14} /> Compare
                            </button>
                            <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'flex-start', padding: '6px 8px', border: 'none', color: 'var(--accent-red)' }} onClick={() => { setDeleteModal(sim); setOpenDropdown(null); }}>
                              <Trash2 size={14} /> Delete
                            </button>
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card animate-fade-in" style={{ width: 400 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Delete this evaluation?</h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.5 }}>
              This will permanently remove evaluation result <strong>{deleteModal.name}</strong> and its associated simulation data. 
              Active policies and real recovery cases will not be affected. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setDeleteModal(null)}>Cancel</button>
              <button className="btn btn-red" onClick={() => void deleteSimulation(deleteModal.id)}>Delete Evaluation</button>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {viewDetailsModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="card animate-fade-in" style={{ width: 600, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600 }}>Evaluation Details</h2>
              <button className="btn btn-secondary" style={{ padding: 4 }} onClick={() => setViewDetailsModal(null)}><X size={16}/></button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Policy Version</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{viewDetailsModal.policyVersion || 'Legacy'}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Evaluation Batch</div>
                <div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{viewDetailsModal.batchId || 'N/A'} ({viewDetailsModal.totalCases} cases)</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Recovery Rate</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-green)' }}>{(viewDetailsModal.recoveryRate * 100).toFixed(1)}%</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Revenue Recovered</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-green)' }}>{formatINR(viewDetailsModal.totalRecovered)}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Escalations</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-yellow)' }}>{viewDetailsModal.escalations}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Blocked Actions</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-red)' }}>{viewDetailsModal.actionsBlocked}</div>
              </div>
            </div>

            <div className="section-title" style={{ marginBottom: 12 }}>Policy Changes</div>
            {viewDetailsModal.previousPolicyVersion ? (
              <div style={{ fontSize: 13, marginBottom: 12 }}>
                Compared with: <strong>{viewDetailsModal.previousPolicyVersion}</strong>
              </div>
            ) : null}
            
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 16 }}>
              {viewDetailsModal.policyChanges && viewDetailsModal.policyChanges !== '{}' ? (
                <table style={{ width: '100%', fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                      <th style={{ paddingBottom: 8 }}>Parameter</th>
                      <th style={{ paddingBottom: 8 }}>Previous</th>
                      <th style={{ paddingBottom: 8 }}>New</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(JSON.parse(viewDetailsModal.policyChanges)).map(([key, diff]: [string, any]) => (
                      <tr key={key}>
                        <td style={{ fontFamily: 'var(--font-mono)', padding: '4px 0' }}>{key}</td>
                        <td style={{ padding: '4px 0', color: 'var(--accent-red)' }}>{diff.previous ?? 'None'}</td>
                        <td style={{ padding: '4px 0', color: 'var(--accent-green)' }}>{diff.new ?? 'None'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No changes from baseline (Baseline configuration).
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Compare Setup Modal */}
      {compareTarget && !compareModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="card animate-fade-in" style={{ width: 400 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Compare Evaluation</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              Select another evaluation to compare against <strong>{compareTarget.name}</strong>.
            </p>
            <select 
              className="input" 
              style={{ width: '100%', marginBottom: 20 }}
              value={compareSelectId}
              onChange={e => setCompareSelectId(e.target.value)}
            >
              <option value="">Select an evaluation...</option>
              {pastSimulations.filter(s => s.id !== compareTarget.id).map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.policyVersion || 'Legacy'}, Batch {s.batchId || 'N/A'})</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => { setCompareTarget(null); setCompareSelectId(''); }}>Cancel</button>
              <button 
                className="btn btn-primary" 
                disabled={!compareSelectId}
                onClick={() => {
                  const other = pastSimulations.find(s => s.id === compareSelectId);
                  if (other) setCompareModal([compareTarget, other]);
                }}
              >
                Compare
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compare Result Modal */}
      {compareModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="card animate-fade-in" style={{ width: 700, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600 }}>Compare Evaluations</h2>
              <button className="btn btn-secondary" style={{ padding: 4 }} onClick={() => { setCompareModal(null); setCompareTarget(null); setCompareSelectId(''); }}><X size={16}/></button>
            </div>

            {compareModal[0].batchId && compareModal[0].batchId === compareModal[1].batchId ? (
              <div style={{ background: 'var(--accent-green-dim)', border: '1px solid var(--accent-green)', padding: 12, borderRadius: 8, marginBottom: 20, fontSize: 13, color: 'var(--accent-green)' }}>
                <strong>Same Batch:</strong> Controlled comparison: same case set, different policy.
              </div>
            ) : (
              <div style={{ background: 'rgba(255,170,0,0.1)', border: '1px solid var(--accent-yellow)', padding: 12, borderRadius: 8, marginBottom: 20, fontSize: 13, color: 'var(--accent-yellow)' }}>
                <strong>Different Batch:</strong> These evaluations used different case sets; metric differences may reflect both policy and dataset differences.
              </div>
            )}

            <table style={{ width: '100%', fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '8px 0', width: '30%' }}>Metric</th>
                  <th style={{ padding: '8px 0', width: '35%' }}>{compareModal[0].name} ({compareModal[0].policyVersion || 'Legacy'})</th>
                  <th style={{ padding: '8px 0', width: '35%' }}>{compareModal[1].name} ({compareModal[1].policyVersion || 'Legacy'})</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 0', color: 'var(--text-muted)' }}>Cases</td>
                  <td style={{ padding: '12px 0' }}>{compareModal[0].totalCases.toLocaleString()}</td>
                  <td style={{ padding: '12px 0' }}>{compareModal[1].totalCases.toLocaleString()}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 0', color: 'var(--text-muted)' }}>Revenue at risk</td>
                  <td style={{ padding: '12px 0' }}>{formatINR(compareModal[0].totalAtRisk)}</td>
                  <td style={{ padding: '12px 0' }}>{formatINR(compareModal[1].totalAtRisk)}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 0', color: 'var(--text-muted)' }}>Revenue recovered</td>
                  <td style={{ padding: '12px 0', color: 'var(--accent-green)', fontWeight: 600 }}>{formatINR(compareModal[0].totalRecovered)}</td>
                  <td style={{ padding: '12px 0', color: 'var(--accent-green)', fontWeight: 600 }}>
                    {formatINR(compareModal[1].totalRecovered)}
                    <span style={{ fontSize: 11, marginLeft: 8, color: compareModal[1].totalRecovered >= compareModal[0].totalRecovered ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                      ({compareModal[1].totalRecovered >= compareModal[0].totalRecovered ? '+' : ''}{formatINR(compareModal[1].totalRecovered - compareModal[0].totalRecovered)})
                    </span>
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 0', color: 'var(--text-muted)' }}>Recovery rate</td>
                  <td style={{ padding: '12px 0' }}>{(compareModal[0].recoveryRate * 100).toFixed(1)}%</td>
                  <td style={{ padding: '12px 0' }}>
                    {(compareModal[1].recoveryRate * 100).toFixed(1)}%
                    <span style={{ fontSize: 11, marginLeft: 8, color: compareModal[1].recoveryRate >= compareModal[0].recoveryRate ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                      ({compareModal[1].recoveryRate >= compareModal[0].recoveryRate ? '+' : ''}{((compareModal[1].recoveryRate - compareModal[0].recoveryRate)*100).toFixed(1)} pp)
                    </span>
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 0', color: 'var(--text-muted)' }}>Escalations</td>
                  <td style={{ padding: '12px 0', color: 'var(--accent-yellow)' }}>{compareModal[0].escalations}</td>
                  <td style={{ padding: '12px 0', color: 'var(--accent-yellow)' }}>
                    {compareModal[1].escalations}
                    <span style={{ fontSize: 11, marginLeft: 8, color: 'var(--text-muted)' }}>
                      ({compareModal[1].escalations >= compareModal[0].escalations ? '+' : ''}{compareModal[1].escalations - compareModal[0].escalations})
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '12px 0', color: 'var(--text-muted)' }}>Blocked actions</td>
                  <td style={{ padding: '12px 0', color: 'var(--accent-red)' }}>{compareModal[0].actionsBlocked}</td>
                  <td style={{ padding: '12px 0', color: 'var(--accent-red)' }}>
                    {compareModal[1].actionsBlocked}
                    <span style={{ fontSize: 11, marginLeft: 8, color: 'var(--text-muted)' }}>
                      ({compareModal[1].actionsBlocked >= compareModal[0].actionsBlocked ? '+' : ''}{compareModal[1].actionsBlocked - compareModal[0].actionsBlocked})
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
