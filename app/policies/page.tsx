'use client';

import { useEffect, useState } from 'react';
import { Shield, Save, CheckCircle2 } from 'lucide-react';

interface PolicyRule {
  id: string;
  name: string;
  description: string;
  ruleKey: string;
  value: string;
  dataType: string;
  isEnabled: boolean;
}

export default function PoliciesPage() {
  const [rules, setRules] = useState<PolicyRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});



  const fetchRules = async () => {
    const res = await fetch('/api/policies');
    const data = await res.json() as { rules: PolicyRule[] };
    setRules(data.rules);
    const vals: Record<string, string> = {};
    for (const r of data.rules) vals[r.id] = r.value;
    setEditValues(vals);
    setLoading(false);
  };

  useEffect(() => {
    const t = setTimeout(() => { void fetchRules(); }, 0);
    return () => clearTimeout(t);
  }, []);

  const saveRule = async (rule: PolicyRule) => {
    setSaving(rule.id);
    try {
      await fetch('/api/policies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rule.id, value: editValues[rule.id] ?? rule.value }),
      });
      setSaved(rule.id);
      setTimeout(() => setSaved(null), 2000);
      void fetchRules();
    } finally {
      setSaving(null);
    }
  };

  const toggleEnabled = async (rule: PolicyRule) => {
    await fetch('/api/policies', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: rule.id, value: rule.value, isEnabled: !rule.isEnabled }),
    });
    void fetchRules();
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900 }} className="animate-fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Policy Engine</h1>
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          Deterministic guardrails that control agent behavior. No LLM can bypass these rules.
        </div>
      </div>

      {/* Architecture note */}
      <div style={{
        marginBottom: 24,
        padding: '14px 18px',
        background: 'var(--rzp-blue-dim)',
        border: '1px solid rgba(45,104,255,0.2)',
        borderRadius: 'var(--radius)',
        fontSize: 12,
        color: 'var(--text-secondary)',
        lineHeight: 1.7,
      }}>
        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Shield size={14} /> Safety Architecture
        </div>
        The policy engine sits between the AI recommendation and the payment provider.
        Even if the AI recommends an action, these rules are evaluated deterministically first.
        A policy block cannot be bypassed by the LLM. All policy decisions are audit-logged.
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 100, borderRadius: 10 }} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rules.map(rule => (
            <div
              key={rule.id}
              className="card"
              style={{ opacity: rule.isEnabled ? 1 : 0.55 }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{rule.name}</div>
                    <code style={{ fontSize: 10 }}>{rule.ruleKey}</code>
                    {!rule.isEnabled && (
                      <span className="badge badge-stopped">DISABLED</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                    {rule.description}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, maxWidth: 200 }}>
                      {rule.dataType === 'boolean' ? (
                        <select
                          className="input"
                          value={editValues[rule.id] ?? rule.value}
                          onChange={e => setEditValues(v => ({ ...v, [rule.id]: e.target.value }))}
                          disabled={!rule.isEnabled}
                        >
                          <option value="true">true</option>
                          <option value="false">false</option>
                        </select>
                      ) : (
                        <input
                          className="input"
                          type="number"
                          step={rule.ruleKey.includes('PROBABILITY') ? '0.01' : '1'}
                          value={editValues[rule.id] ?? rule.value}
                          onChange={e => setEditValues(v => ({ ...v, [rule.id]: e.target.value }))}
                          disabled={!rule.isEnabled}
                        />
                      )}
                    </div>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => saveRule(rule)}
                      disabled={saving === rule.id || !rule.isEnabled}
                    >
                      {saved === rule.id ? (
                        <><CheckCircle2 size={12} /> Saved</>
                      ) : (
                        <><Save size={12} /> Save</>
                      )}
                    </button>
                  </div>
                </div>

                {/* Toggle */}
                <div>
                  <button
                    onClick={() => toggleEnabled(rule)}
                    style={{
                      width: 40,
                      height: 22,
                      borderRadius: 11,
                      border: 'none',
                      background: rule.isEnabled ? 'var(--accent-green)' : 'var(--border)',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'background 0.2s ease',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{
                      position: 'absolute',
                      top: 3,
                      left: rule.isEnabled ? 20 : 3,
                      width: 16,
                      height: 16,
                      borderRadius: 8,
                      background: '#fff',
                      transition: 'left 0.2s ease',
                    }} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
