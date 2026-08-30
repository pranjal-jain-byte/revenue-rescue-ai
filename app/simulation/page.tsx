'use client';

import { useState, useEffect, useRef } from 'react';
import { Play, CheckCircle2, Loader, AlertTriangle, TrendingUp, Shield } from 'lucide-react';

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

export default function SimulationPage() {
  const [simSize, setSimSize] = useState(100);
  const [simName, setSimName] = useState('');
  const [running, setRunning] = useState(false);

  const [simulation, setSimulation] = useState<SimulationRun | null>(null);
  const [currentStep, setCurrentStep] = useState(-1);
  const [pastSimulations, setPastSimulations] = useState<SimulationRun[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);



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

    // Animate steps
    for (let i = 0; i < AGENT_STEPS.length - 1; i++) {
      await new Promise(r => setTimeout(r, 400 + i * 200));
      setCurrentStep(i + 1);
    }

    const name = simName || `Simulation ${new Date().toLocaleTimeString('en-IN')}`;
    const res = await fetch('/api/simulations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseCount: simSize, name }),
    });
    const { simulationId: id } = await res.json() as { simulationId: string };

    // Poll for completion
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

  const progressPct = simulation
    ? Math.min(100, (simulation.processedCases / simulation.totalCases) * 100)
    : currentStep >= 0
    ? (currentStep / AGENT_STEPS.length) * 50
    : 0;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900 }} className="animate-fade-in">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Recovery Simulation</h1>
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          Run the autonomous agent over a batch of cases and measure actual revenue recovered.
        </div>
      </div>

      {/* Configuration Card */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="section-title" style={{ marginBottom: 16 }}>Configure Simulation</div>

        <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          {[100, 500, 1000].map(n => (
            <button
              key={n}
              className={`btn ${simSize === n ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: '1 1 100px' }}
              onClick={() => setSimSize(n)}
              disabled={running}
            >
              {n} cases
            </button>
          ))}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
            Simulation Name (optional)
          </label>
          <input
            className="input"
            placeholder={`e.g. Demo Run ${simSize} Cases`}
            value={simName}
            onChange={e => setSimName(e.target.value)}
            disabled={running}
            style={{ maxWidth: 360 }}
          />
        </div>

        <button
          className="btn btn-green btn-lg"
          onClick={startSimulation}
          disabled={running}
          style={{ minWidth: 200 }}
        >
          {running ? (
            <><Loader size={16} className="animate-spin" /> Running Agent...</>
          ) : (
            <><Play size={16} /> Run Recovery Simulation</>
          )}
        </button>
      </div>

      {/* Agent Progress */}
      {(running || simulation) && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="section-title" style={{ marginBottom: 16 }}>Agent Workflow Progress</div>

          {/* Progress bar */}
          <div className="progress-bar" style={{ marginBottom: 16, height: 6 }}>
            <div
              className="progress-fill progress-fill-green"
              style={{ width: `${progressPct}%`, transition: 'width 0.5s ease' }}
            />
          </div>

          {simulation && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              Processed {simulation.processedCases.toLocaleString()} / {simulation.totalCases.toLocaleString()} cases
              {simulation.status === 'COMPLETED' && ' · ✅ Completed'}
              {simulation.status === 'FAILED' && ' · ❌ Failed'}
            </div>
          )}

          {/* Step-by-step animation */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {AGENT_STEPS.map((step, i) => {
              const done = simulation?.status === 'COMPLETED' || i < currentStep;
              const active = i === currentStep && running;
              return (
                <div
                  key={step.key}
                  className={`sim-step ${active ? 'sim-step-active' : done ? 'sim-step-done' : ''}`}
                >
                  <div style={{ width: 20, flexShrink: 0 }}>
                    {done ? (
                      <CheckCircle2 size={14} color="var(--accent-green)" />
                    ) : active ? (
                      <Loader size={14} className="animate-spin" color="var(--rzp-blue)" />
                    ) : (
                      <div style={{ width: 14, height: 14, borderRadius: 7, border: '1px solid var(--border)' }} />
                    )}
                  </div>
                  <span style={{ fontSize: 12 }}>{step.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Results */}
      {simulation?.status === 'COMPLETED' && (
        <div className="card animate-fade-in" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <CheckCircle2 size={18} color="var(--accent-green)" />
            <div style={{ fontSize: 16, fontWeight: 700 }}>Simulation Complete</div>
          </div>

          {/* Hero result */}
          <div style={{
            padding: '20px',
            background: 'var(--accent-green-dim)',
            border: '1px solid rgba(0,214,143,0.2)',
            borderRadius: 'var(--radius)',
            marginBottom: 20,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>REVENUE RECOVERED</div>
            <div style={{ fontSize: 40, fontWeight: 800, color: 'var(--accent-green)', fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em' }}>
              {formatINR(simulation.totalRecovered)}
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 6 }}>
              {(simulation.recoveryRate * 100).toFixed(1)}% recovery rate
              · {simulation.totalCases.toLocaleString()} cases processed
            </div>
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { label: 'Actions Executed', value: simulation.actionsExecuted.toLocaleString() },
              { label: 'Actions Blocked', value: simulation.actionsBlocked.toLocaleString(), color: 'var(--accent-red)' },
              { label: 'Escalations', value: simulation.escalations.toLocaleString(), color: 'var(--accent-yellow)' },
              { label: 'Avg Recovery Time', value: `${simulation.avgRecoveryTimeMs.toFixed(0)}ms` },
            ].map(stat => (
              <div key={stat.label} style={{ padding: '10px', background: 'var(--bg-secondary)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>{stat.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: stat.color ?? 'var(--text-primary)' }}>{stat.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past Simulations */}
      {pastSimulations.length > 0 && (
        <div className="card">
          <div className="section-title" style={{ marginBottom: 14 }}>Past Simulations</div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Cases</th>
                  <th>At Risk</th>
                  <th>Recovered</th>
                  <th>Rate</th>
                  <th>Blocked</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {pastSimulations.map(sim => (
                  <tr key={sim.id}>
                    <td style={{ fontSize: 12 }}>{sim.name}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{sim.totalCases}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-red)' }}>{formatINR(sim.totalAtRisk)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-green)' }}>{formatINR(sim.totalRecovered)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{(sim.recoveryRate * 100).toFixed(1)}%</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-red)' }}>{sim.actionsBlocked}</td>
                    <td>
                      <span className={`badge ${sim.status === 'COMPLETED' ? 'badge-recovered' : sim.status === 'FAILED' ? 'badge-failed' : 'badge-in-progress'}`}>
                        {sim.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {new Date(sim.startedAt).toLocaleDateString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
