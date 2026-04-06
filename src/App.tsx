import { useState } from 'react';
import type { ScanInput, ScanResult, ScanResponse } from './types';

// ── Constants ─────────────────────────────────────────────────────────────────

const INDUSTRIES = [
  'Banking & Financial Services', 'Insurance', 'Healthcare & Life Sciences',
  'Retail & E-commerce', 'Telecommunications', 'Public Sector & Government',
  'Legal & Professional Services', 'Human Resources', 'Education',
  'Manufacturing & Supply Chain', 'Media & Entertainment', 'Other',
];

const DATA_TYPE_OPTIONS = [
  'Personal identifiable information (PII)',
  'Financial data',
  'Health / medical records',
  'Biometric data',
  'Employment records',
  'Criminal / legal records',
  'Behavioural / usage data',
  'Location data',
  'No personal data',
];

const DIM_META: { key: keyof ScanResult['scores']; label: string; article: string }[] = [
  { key: 'transparency',   label: 'Transparency',    article: 'Art. 13' },
  { key: 'accountability', label: 'Accountability',  article: 'Art. 17' },
  { key: 'dataGovernance', label: 'Data governance', article: 'Art. 10' },
  { key: 'humanOversight', label: 'Human oversight', article: 'Art. 14' },
  { key: 'riskManagement', label: 'Risk management', article: 'Art. 9'  },
];

const PRIORITY_COLOR: Record<string, string> = {
  Critical: 'var(--red)',
  High:     'var(--amber)',
  Medium:   'var(--blue)',
};

const SEVERITY_COLOR: Record<string, string> = {
  Critical: 'var(--red)',
  High:     'var(--amber)',
  Medium:   'var(--blue)',
  Low:      'var(--text-muted)',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function dimStatus(score: number): 'compliant' | 'warning' | 'failed' {
  if (score >= 14) return 'compliant';
  if (score >= 8)  return 'warning';
  return 'failed';
}

function dimBarColor(score: number): string {
  const s = dimStatus(score);
  if (s === 'compliant') return 'var(--green)';
  if (s === 'warning')   return 'var(--amber)';
  return 'var(--red)';
}

function tierBadgeClass(tier: string): string {
  const t = tier.toLowerCase();
  if (t === 'minimal')      return 'badge badge-minimal';
  if (t === 'limited')      return 'badge badge-limited';
  if (t === 'high')         return 'badge badge-high';
  if (t === 'unacceptable') return 'badge badge-unacceptable';
  return 'badge badge-limited';
}

function scoreColor(score: number): string {
  if (score >= 70) return 'var(--green)';
  if (score >= 45) return 'var(--amber)';
  return 'var(--red)';
}

// Score ring using SVG circle
function ScoreRing({ score }: { score: number }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = scoreColor(score);
  return (
    <div className="score-ring-wrap">
      <div className="score-ring">
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" stroke="var(--border)" strokeWidth="8" />
          <circle
            cx="50" cy="50" r={r} fill="none"
            stroke={color} strokeWidth="8"
            strokeDasharray={`${fill} ${circ}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="score-value">
          <span className="score-number" style={{ color }}>{score}</span>
          <span className="score-denom">/100</span>
        </div>
      </div>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
        Readiness score
      </span>
    </div>
  );
}

// ── Empty form state ──────────────────────────────────────────────────────────

const EMPTY: ScanInput = {
  systemName:    '',
  description:   '',
  deployment:    '',
  dataTypes:     [],
  decisionMaker: '',
  humanOverride: '',
  industry:      '',
};

// ── Main component ────────────────────────────────────────────────────────────

export default function App() {
  const [form,    setForm]    = useState<ScanInput>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<ScanResult | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  function setField<K extends keyof ScanInput>(key: K, value: ScanInput[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function toggleDataType(label: string) {
    setForm(f => ({
      ...f,
      dataTypes: f.dataTypes.includes(label)
        ? f.dataTypes.filter(d => d !== label)
        : [...f.dataTypes, label],
    }));
  }

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const res = await fetch('/api/scan', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      });

      const data: ScanResponse = await res.json();

      if (!data.success || !data.result) {
        setError(data.error ?? 'Scan failed. Please try again.');
      } else {
        setResult(data.result);
        // Scroll to results
        setTimeout(() => {
          document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setForm(EMPTY);
    setResult(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const formValid =
    form.systemName.trim() &&
    form.description.trim() &&
    form.deployment.trim() &&
    form.industry;

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 80 }}>

      {/* ── Header ── */}
      <header style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '16px 0',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 32, height: 32, background: 'var(--blue)',
            borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', lineHeight: 1.1 }}>
              The Ethical Auditor
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '.04em' }}>
              AI GOVERNANCE SCANNER
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="badge badge-limited" style={{ fontSize: 10 }}>EU AI Act</span>
            <span className="badge badge-minimal" style={{ fontSize: 10 }}>NIST AI RMF</span>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      {!result && (
        <div style={{
          background: 'linear-gradient(to bottom, #EFF6FF, var(--bg))',
          padding: '48px 0 32px',
          textAlign: 'center',
        }}>
          <div className="container">
            <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-.02em', marginBottom: 12 }}>
              Assess your AI system's governance readiness
            </h1>
            <p style={{ fontSize: 16, color: 'var(--text-muted)', maxWidth: 560, margin: '0 auto' }}>
              Get a structured readiness score, EU AI Act gap analysis, and prioritised
              remediation controls — powered by Gemma 4.
            </p>
          </div>
        </div>
      )}

      <div className="container" style={{ paddingTop: 32 }}>

        {/* ── Error banner ── */}
        {error && (
          <div className="alert alert-error" style={{ marginBottom: 24 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* ════════════════════════════════════
            RESULTS
        ════════════════════════════════════ */}
        {result && (
          <div id="results">

            {/* Risk tier alert for High / Unacceptable */}
            {(result.riskTier === 'High' || result.riskTier === 'Unacceptable') && (
              <div className="alert alert-warning" style={{ marginBottom: 24 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <div>
                  <strong>
                    {result.riskTier === 'Unacceptable'
                      ? 'Prohibited system detected under EU AI Act Article 5'
                      : 'High-risk AI system — mandatory compliance obligations apply'}
                  </strong>
                  <div style={{ marginTop: 4, fontSize: 13 }}>{result.riskRationale}</div>
                </div>
              </div>
            )}

            {/* Score overview card */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
                <ScoreRing score={result.readinessScore} />
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 18, fontWeight: 800 }}>{form.systemName}</span>
                    <span className={tierBadgeClass(result.riskTier)}>{result.riskTier} Risk</span>
                  </div>
                  <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 12 }}>
                    {result.executiveSummary}
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {result.euGaps.length} EU AI Act gap{result.euGaps.length !== 1 ? 's' : ''}
                    </span>
                    <span style={{ color: 'var(--border-md)' }}>·</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {result.nistGaps.length} NIST gap{result.nistGaps.length !== 1 ? 's' : ''}
                    </span>
                    <span style={{ color: 'var(--border-md)' }}>·</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {result.controls.length} recommended control{result.controls.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Dimension scores */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="section-title">Governance dimensions</div>
              <div className="dim-grid">
                {DIM_META.map(({ key, label, article }) => {
                  const score  = result.scores[key];
                  const status = dimStatus(score);
                  return (
                    <div key={key} className="dim-card">
                      <div className="dim-bar-wrap">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span className="dim-label">{label}</span>
                          <span className={`badge badge-${status}`}>{status.toUpperCase()}</span>
                        </div>
                        <div className="dim-bar-bg">
                          <div className="dim-bar-fill" style={{
                            width: `${(score / 20) * 100}%`,
                            background: dimBarColor(score),
                          }} />
                        </div>
                        <div className="dim-score-text">{score}/20 · {article}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* EU AI Act gaps */}
            {result.euGaps.length > 0 && (
              <div className="card" style={{ marginBottom: 20 }}>
                <div className="section-title">EU AI Act compliance gaps</div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="gap-table">
                    <thead>
                      <tr>
                        <th style={{ width: 110 }}>Article</th>
                        <th>Gap description</th>
                        <th style={{ width: 90 }}>Severity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.euGaps.map((g, i) => (
                        <tr key={i}>
                          <td>
                            <code style={{ fontFamily: 'var(--mono)', fontSize: 12, background: 'var(--bg)', padding: '2px 6px', borderRadius: 4 }}>
                              {g.article}
                            </code>
                          </td>
                          <td style={{ fontSize: 13 }}>{g.description}</td>
                          <td>
                            <span style={{
                              fontSize: 11, fontWeight: 700, color: SEVERITY_COLOR[g.severity] ?? 'var(--text-muted)',
                            }}>
                              {g.severity}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* NIST gaps */}
            {result.nistGaps.length > 0 && (
              <div className="card" style={{ marginBottom: 20 }}>
                <div className="section-title">NIST AI RMF gaps</div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="gap-table">
                    <thead>
                      <tr>
                        <th style={{ width: 100 }}>Function</th>
                        <th style={{ width: 120 }}>Subcategory</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.nistGaps.map((g, i) => (
                        <tr key={i}>
                          <td>
                            <span style={{
                              fontSize: 11, fontWeight: 700, color: 'var(--purple)',
                              background: '#F5F3FF', padding: '2px 8px',
                              borderRadius: 4, display: 'inline-block',
                            }}>
                              {g.function}
                            </span>
                          </td>
                          <td style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text-muted)' }}>
                            {g.subcategory}
                          </td>
                          <td style={{ fontSize: 13 }}>{g.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Recommended controls */}
            {result.controls.length > 0 && (
              <div className="card" style={{ marginBottom: 28 }}>
                <div className="section-title">Recommended controls</div>
                {result.controls.map((c, i) => (
                  <div key={i} className="control-item">
                    <div className="control-dot" style={{ background: PRIORITY_COLOR[c.priority] ?? 'var(--text-muted)' }} />
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 13 }}>{c.action}</span>
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      color: PRIORITY_COLOR[c.priority] ?? 'var(--text-muted)',
                      minWidth: 60, textAlign: 'right',
                    }}>
                      {c.priority}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Action bar */}
            <div style={{
              position: 'sticky', bottom: 0,
              background: 'var(--surface)', borderTop: '1px solid var(--border)',
              padding: '14px 0', marginLeft: -24, marginRight: -24, paddingLeft: 24, paddingRight: 24,
            }}>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="btn-ghost" onClick={handleReset}>
                  Scan another system
                </button>
                <button
                  className="btn-primary"
                  onClick={() => window.print()}
                >
                  Export report
                </button>
              </div>
            </div>

          </div>
        )}

        {/* ════════════════════════════════════
            FORM
        ════════════════════════════════════ */}
        {!result && (
          <form onSubmit={handleScan}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* System basics */}
              <div className="card">
                <div className="section-title" style={{ marginBottom: 20 }}>System details</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="field" style={{ gridColumn: '1 / -1' }}>
                    <label className="label">System name <span>*</span></label>
                    <input
                      className="input"
                      placeholder="e.g. Credit Risk Scoring Engine"
                      value={form.systemName}
                      onChange={e => setField('systemName', e.target.value)}
                      required
                    />
                  </div>
                  <div className="field" style={{ gridColumn: '1 / -1' }}>
                    <label className="label">Purpose and function <span>*</span></label>
                    <textarea
                      className="textarea"
                      placeholder="Describe what this AI system does, what decisions it makes or supports, and who it affects..."
                      value={form.description}
                      onChange={e => setField('description', e.target.value)}
                      required
                    />
                  </div>
                  <div className="field">
                    <label className="label">Industry <span>*</span></label>
                    <select
                      className="select"
                      value={form.industry}
                      onChange={e => setField('industry', e.target.value)}
                      required
                    >
                      <option value="">Select industry</option>
                      {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label className="label">Deployment context <span>*</span></label>
                    <input
                      className="input"
                      placeholder="e.g. Production — customer-facing web app"
                      value={form.deployment}
                      onChange={e => setField('deployment', e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Data and decision-making */}
              <div className="card">
                <div className="section-title" style={{ marginBottom: 20 }}>Data and decision-making</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="field">
                    <label className="label">Data types processed</label>
                    <p className="hint" style={{ marginBottom: 8 }}>Select all that apply</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {DATA_TYPE_OPTIONS.map(opt => {
                        const selected = form.dataTypes.includes(opt);
                        return (
                          <button
                            key={opt} type="button"
                            onClick={() => toggleDataType(opt)}
                            style={{
                              padding: '6px 12px', borderRadius: 99, fontSize: 12, fontWeight: 500,
                              cursor: 'pointer', transition: 'all .15s',
                              border: `1.5px solid ${selected ? 'var(--blue)' : 'var(--border)'}`,
                              background: selected ? 'var(--blue-light)' : 'var(--surface)',
                              color: selected ? 'var(--blue)' : 'var(--text-muted)',
                            }}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div className="field">
                      <label className="label">Decision maker</label>
                      <input
                        className="input"
                        placeholder="e.g. AI system alone / human with AI support"
                        value={form.decisionMaker}
                        onChange={e => setField('decisionMaker', e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label className="label">Human override capability</label>
                      <input
                        className="input"
                        placeholder="e.g. Yes — reviewer can reject any AI decision"
                        value={form.humanOverride}
                        onChange={e => setField('humanOverride', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingBottom: 8 }}>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setForm(EMPTY)}
                >
                  Clear form
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading || !formValid}
                >
                  {loading ? (
                    <><div className="spinner" /> Analysing with Gemma 4…</>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                      </svg>
                      Run governance scan
                    </>
                  )}
                </button>
              </div>

            </div>
          </form>
        )}

      </div>
    </div>
  );
}
