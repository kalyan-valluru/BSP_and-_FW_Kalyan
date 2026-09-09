/**
 * BenchmarkDashboard.tsx
 * Production-grade Hardware Benchmark & Continuous Evaluation Framework UI.
 * Tabs: Overview | Dataset | Evaluation | Readiness | Regression | Traceability
 */
import { useState, useEffect, useCallback } from 'react';
import {
  BarChart2, Database, FlaskConical, ShieldCheck, GitBranch,
  FileSearch, Play, Plus, Trash2, RefreshCw, Download,
  CheckCircle2, XCircle, AlertCircle,
  ChevronRight, Info, ArrowUpRight, ArrowDownRight,
  Eye, X, Activity
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, RadarChart,
  PolarGrid, PolarAngleAxis, Radar,
} from 'recharts';
import type {
  BenchmarkBoard, BenchmarkMetrics, BenchmarkRun, BenchmarkRunSummary,
  DashboardStats, RegressionReport, AddBoardForm,
} from '../types/benchmark';
import { METRIC_LABELS } from '../types/benchmark';

const VENDOR_LIST = [
  'AMD/Xilinx', 'NXP', 'STMicroelectronics', 'Texas Instruments',
  'Microchip', 'Intel FPGA', 'Raspberry Pi', 'Broadcom', 'Renesas', 'Infineon', 'Other',
];
const ARCH_LIST = [
  'Zynq-7000', 'Zynq UltraScale+', 'Versal', 'MicroBlaze',
  'i.MX 8', 'i.MX RT', 'STM32H7', 'STM32F4', 'AM335x', 'AM64x',
  'BCM2711', 'Cyclone V SoC', 'Stratix 10 SoC', 'PolarFire SoC', 'Other',
];

const READINESS_GATES = ['extraction', 'validation', 'compilation', 'simulation', 'deployment'] as const;
const GATE_LABELS: Record<string, string> = {
  extraction: 'Extraction Ready',
  validation: 'Validation Ready',
  compilation: 'Compilation Ready',
  simulation: 'Simulation Ready',
  deployment: 'Deployment Ready',
};

const TABS = [
  { id: 'overview', label: 'Overview', icon: BarChart2 },
  { id: 'dataset', label: 'Dataset', icon: Database },
  { id: 'evaluation', label: 'Evaluation', icon: FlaskConical },
  { id: 'readiness', label: 'Readiness', icon: Activity },
  { id: 'regression', label: 'Regression', icon: GitBranch },
  { id: 'traceability', label: 'Traceability', icon: FileSearch },
] as const;

type Tab = typeof TABS[number]['id'];

function metricColor(value: number, isHallucination = false): string {
  if (isHallucination) {
    return value < 5 ? 'text-neon-emerald' : value < 15 ? 'text-neon-amber' : 'text-red-400';
  }
  return value >= 85 ? 'text-neon-emerald' : value >= 60 ? 'text-neon-amber' : 'text-red-400';
}

function metricBg(value: number, isHallucination = false): string {
  if (isHallucination) {
    return value < 5 ? 'bg-neon-emerald/10' : value < 15 ? 'bg-neon-amber/10' : 'bg-red-500/10';
  }
  return value >= 85 ? 'bg-neon-emerald/10' : value >= 60 ? 'bg-neon-amber/10' : 'bg-red-500/10';
}

// ─── Add Board Modal ─────────────────────────────────────────────────────────

function AddBoardModal({ onClose, onAdd }: { onClose: () => void; onAdd: (form: AddBoardForm) => Promise<void> }) {
  const [form, setForm] = useState<AddBoardForm>({
    vendor: 'AMD/Xilinx', boardName: '', processor: '',
    architecture: 'Zynq-7000', sourceUrl: '', docVersion: '1.0', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!form.boardName.trim() || !form.processor.trim()) {
      setError('Board Name and Processor are required.');
      return;
    }
    setSaving(true);
    try {
      await onAdd(form);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to add board.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-obsidian-50 border border-border-grid rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-text-primary font-bold text-base flex items-center gap-2">
            <Plus className="w-4 h-4 text-neon-cyan" /> Add Benchmark Board
          </h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary p-1 rounded-lg hover:bg-obsidian-100 transition-colors"><X className="w-4 h-4" /></button>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
          </div>
        )}

        <div className="space-y-3.5">
          {[
            { label: 'Vendor', key: 'vendor', type: 'select', options: VENDOR_LIST },
            { label: 'Board Name', key: 'boardName', placeholder: 'e.g. ZedBoard' },
            { label: 'Processor', key: 'processor', placeholder: 'e.g. ARM Cortex-A9 (Zynq-7020)' },
            { label: 'Architecture', key: 'architecture', type: 'select', options: ARCH_LIST },
            { label: 'Source URL', key: 'sourceUrl', placeholder: 'https://...' },
            { label: 'Doc Version', key: 'docVersion', placeholder: '1.0' },
            { label: 'Notes', key: 'notes', placeholder: 'Optional reference notes', isTextarea: true },
          ].map(({ label, key, type, options, placeholder, isTextarea }) => (
            <div key={key} className="space-y-1.5">
              <label className="text-[11px] text-text-muted uppercase tracking-wide font-semibold">{label}</label>
              {type === 'select' && options ? (
                <select
                  value={(form as any)[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full bg-obsidian-100 border border-border-grid rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-neon-cyan/60"
                >
                  {options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : isTextarea ? (
                <textarea
                  value={(form as any)[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  rows={2}
                  placeholder={placeholder}
                  className="w-full bg-obsidian-100 border border-border-grid rounded-lg px-3 py-2 text-sm text-text-primary resize-none focus:outline-none focus:border-neon-cyan/60"
                />
              ) : (
                <input
                  value={(form as any)[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full bg-obsidian-100 border border-border-grid rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-neon-cyan/60"
                />
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-border-grid rounded-lg text-text-muted text-sm hover:border-neon-cyan/40 transition-colors">Cancel</button>
          <button
            onClick={handleSubmit} disabled={saving}
            className="flex-1 px-4 py-2 bg-neon-cyan text-obsidian font-bold text-sm rounded-lg hover:bg-neon-cyan/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Adding…' : 'Add Board'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({ label, value, unit = '', color = 'cyan', sub }: {
  label: string; value: string | number; unit?: string; color?: string; sub?: string;
}) {
  const colors: Record<string, string> = {
    cyan: 'text-neon-cyan border-neon-cyan/20 bg-neon-cyan/5',
    emerald: 'text-neon-emerald border-neon-emerald/20 bg-neon-emerald/5',
    amber: 'text-neon-amber border-neon-amber/20 bg-neon-amber/5',
    red: 'text-red-400 border-red-400/20 bg-red-500/5',
    purple: 'text-purple-400 border-purple-400/20 bg-purple-500/5',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color] || colors.cyan}`}>
      <p className="text-[10px] uppercase tracking-widest text-text-muted font-semibold mb-1">{label}</p>
      <p className={`text-2xl font-extrabold font-mono leading-none ${colors[color]?.split(' ')[0]}`}>
        {value}<span className="text-base ml-0.5 opacity-70">{unit}</span>
      </p>
      {sub && <p className="text-[10px] text-text-muted mt-1.5">{sub}</p>}
    </div>
  );
}

// ─── Readiness Gate ──────────────────────────────────────────────────────────

function ReadinessGate({ label, ready, score, isLast }: {
  label: string; ready: boolean; score: number; isLast: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <div className={`w-14 h-14 rounded-full border-2 flex items-center justify-center transition-all ${ready ? 'border-neon-emerald bg-neon-emerald/15 shadow-lg shadow-neon-emerald/20'
          : 'border-border-grid bg-obsidian-100/50'
        }`}>
        {ready
          ? <CheckCircle2 className="w-7 h-7 text-neon-emerald" />
          : <XCircle className="w-7 h-7 text-text-muted" />
        }
      </div>
      <p className={`text-[10px] font-semibold mt-2 text-center max-w-[72px] leading-tight ${ready ? 'text-neon-emerald' : 'text-text-muted'
        }`}>{label}</p>
      <p className={`text-[10px] font-mono mt-0.5 ${ready ? 'text-neon-emerald' : 'text-text-muted'}`}>
        {score.toFixed(0)}%
      </p>
      {!isLast && (
        <div className={`mt-1 w-px h-4 ${ready ? 'bg-neon-emerald/40' : 'bg-border-grid'}`} />
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface BenchmarkDashboardProps {
  onClose?: () => void;
  peripherals?: any[];
  generatedDts?: string;
  generatedTcl?: string;
  generatedBsp?: string;
  architecture?: string;
}

export function BenchmarkDashboard({
  onClose,
  peripherals = [],
  generatedDts = '',
  generatedTcl = '',
  generatedBsp = '',
  architecture = 'Zynq-7000',
}: BenchmarkDashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [history, setHistory] = useState<BenchmarkRunSummary[]>([]);
  const [latestRun, setLatestRun] = useState<BenchmarkRun | null>(null);
  const [regressions, setRegressions] = useState<RegressionReport | null>(null);
  const [readiness, setReadiness] = useState<any>(null);
  const [hallucinations, setHallucinations] = useState<any[]>([]);
  const [decisionLog, setDecisionLog] = useState<any[]>([]);
  const [buildVerification, setBuildVerification] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [vendorFilter, setVendorFilter] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [error, setError] = useState('');

  const BASE = 'http://13.233.63.82:3002';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, histRes] = await Promise.all([
        fetch(`${BASE}/api/benchmark/dashboard-stats`).then(r => r.json()),
        fetch(`${BASE}/api/benchmark/history`).then(r => r.json()),
      ]);
      if (statsRes.success) setStats(statsRes.stats);
      if (histRes.success) setHistory(histRes.history);
    } catch {
      setError('Could not connect to FastAPI server (port 3002).');
    } finally {
      setLoading(false);
    }
  }, []);

  const runBenchmark = async () => {
    setRunning(true);
    setError('');
    try {
      const res = await fetch(`${BASE}/api/benchmark/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extractedResults: null }),
      }).then(r => r.json());
      if (res.success) {
        setLatestRun(res.run);
        setRegressions(res.regressions);
        await load();
      }
    } catch (e: any) {
      setError(e.message || 'Benchmark run failed.');
    } finally {
      setRunning(false);
    }
  };

  const runVerification = async () => {
    setVerifying(true);
    try {
      const res = await fetch(`${BASE}/api/verify/artifacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dtsContent: generatedDts || null,
          tclContent: generatedTcl || null,
          bspContent: generatedBsp || null,
        }),
      }).then(r => r.json());
      if (res.success) setBuildVerification(res.verification);
    } catch (e: any) {
      setError('Artifact verification failed: ' + (e.message || ''));
    } finally {
      setVerifying(false);
    }
  };

  const runAnalysis = async () => {
    if (!peripherals.length) return;
    setAnalyzing(true);
    try {
      const [halluRes, traceRes, readRes] = await Promise.all([
        fetch(`${BASE}/api/traceability/scan-hallucinations`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ peripherals, architecture }),
        }).then(r => r.json()),
        fetch(`${BASE}/api/traceability/analyze`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ peripherals, architecture }),
        }).then(r => r.json()),
        fetch(`${BASE}/api/readiness/assess`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            peripherals,
            buildStatus: buildVerification?.summary?.dts_ok && buildVerification?.summary?.bsp_ok ? 'success' : 'idle',
            hallucinationFindings: [],
          }),
        }).then(r => r.json()),
      ]);
      if (halluRes.success) setHallucinations(halluRes.findings || []);
      if (traceRes.success) setDecisionLog(traceRes.decisionLog || []);
      if (readRes.success) setReadiness(readRes.readiness);
    } catch (e: any) {
      setError('Analysis failed: ' + (e.message || ''));
    } finally {
      setAnalyzing(false);
    }
  };

  const addBoard = async (form: AddBoardForm) => {
    const res = await fetch(`${BASE}/api/benchmark/add-board`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    }).then(r => r.json());
    if (!res.success) throw new Error(res.detail || 'Failed to add board');
    await load();
  };

  const removeBoard = async (id: string) => {
    if (!confirm('Remove this board from the benchmark dataset?')) return;
    const res = await fetch(`${BASE}/api/benchmark/remove-board/${id}`, { method: 'DELETE' }).then(r => r.json());
    if (res.success) await load();
  };

  const rebuildHkl = async (id: string) => {
    await fetch(`${BASE}/api/benchmark/rebuild-hkl/${id}`, { method: 'POST' });
    await load();
  };

  const exportCsv = () => {
    if (!latestRun?.board_results?.length) return;
    const headers = ['Board', 'Vendor', 'EQS', 'Processor%', 'Peripheral%', 'Address%', 'IRQ%', 'Driver%', 'DTS%', 'Hallucination%'];
    const rows = latestRun.board_results.map(r => [
      r.board_name, r.vendor, r.eqs,
      r.metrics.processor_detection, r.metrics.peripheral_detection,
      r.metrics.base_address_accuracy, r.metrics.irq_accuracy,
      r.metrics.driver_mapping, r.metrics.dts_accuracy,
      r.metrics.hallucination_rate,
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'benchmark_results.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => { load(); }, [load]);

  const boards = stats?.boards || [];
  const filteredBoards = vendorFilter === 'All'
    ? boards
    : boards.filter((b: BenchmarkBoard) => b.vendor === vendorFilter);

  const eqsTrend = stats?.eqs_trend || [];
  const radarData = stats?.latest_metrics
    ? Object.entries(METRIC_LABELS).slice(0, 10).map(([k, label]) => ({
      subject: label.replace(' Accuracy', '').replace(' Detection', '').replace(' Mapping', '').replace(' Generation', ''),
      value: k === 'hallucination_rate'
        ? Math.max(0, 100 - ((stats!.latest_metrics as any)[k] || 0))
        : ((stats!.latest_metrics as any)[k] || 0),
      fullMark: 100,
    }))
    : [];

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-obsidian overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3.5 border-b border-border-grid bg-obsidian-50/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center">
            <FlaskConical className="w-4.5 h-4.5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-text-primary font-bold text-[15px] leading-none">
              Hardware Benchmark & Evaluation Framework
            </h2>
            <p className="text-text-muted text-[11px] mt-0.5 font-mono">
              Production-grade Quality Assurance · {boards.length} boards · {stats?.vendors_covered || 0} vendors
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runBenchmark} disabled={running}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-lg transition-all disabled:opacity-50"
          >
            {running ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            {running ? 'Running…' : 'Run Benchmark'}
          </button>
          <button
            onClick={runVerification} disabled={verifying || (!generatedDts && !generatedTcl && !generatedBsp)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-neon-cyan/20 border border-neon-cyan/40 hover:bg-neon-cyan/30 text-neon-cyan font-bold text-xs rounded-lg transition-all disabled:opacity-40"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Verify Artifacts
          </button>
          <button
            onClick={runAnalysis} disabled={analyzing || !peripherals.length}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 text-blue-300 font-bold text-xs rounded-lg transition-all disabled:opacity-40"
          >
            <Eye className="w-3.5 h-3.5" />
            {analyzing ? 'Analyzing…' : 'Analyze'}
          </button>
          {onClose && (
            <button onClick={onClose} className="ml-2 p-2 rounded-lg bg-obsidian-100 border border-border-grid text-text-muted hover:text-text-primary hover:border-neon-cyan/40 transition-all">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-6 py-2 bg-red-500/10 border-b border-red-500/30 flex items-center gap-2 text-red-400 text-xs">
          <AlertCircle className="w-3.5 h-3.5" />{error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-3 h-3" /></button>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex items-center gap-0.5 px-6 py-2 border-b border-border-grid bg-obsidian-50/50 shrink-0 overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${activeTab === tab.id
                  ? 'bg-neon-cyan/15 border border-neon-cyan/40 text-neon-cyan'
                  : 'text-text-muted hover:text-text-secondary hover:bg-obsidian-100/50'
                }`}
            >
              <Icon className="w-3.5 h-3.5" />{tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-10 h-10 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-text-muted text-sm">Loading benchmark framework…</p>
            </div>
          </div>
        ) : (
          <>
            {/* ── OVERVIEW ──────────────────────────────────────────────── */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <KpiCard label="Total Boards" value={stats?.total_boards || 0} color="cyan" sub={`${stats?.vendors_covered || 0} vendors`} />
                  <KpiCard label="Verified" value={stats?.verified_boards || 0} color="emerald" sub={`${stats?.boards_pending || 0} pending`} />
                  <KpiCard label="Quality Score" value={(stats?.overall_eqs || 0).toFixed(1)} unit="%" color="purple" sub="Eng. Quality Score" />
                  <KpiCard label="Hallucinations" value={stats?.hallucination_count || 0} color={stats?.hallucination_count ? 'red' : 'emerald'} sub="detected fields" />
                  <KpiCard label="Total Runs" value={stats?.total_runs || 0} color="amber" sub="benchmark runs" />
                  <KpiCard label="Last Run" value={stats?.last_run_time ? new Date(stats.last_run_time).toLocaleDateString() : '—'} color="cyan" sub="date" />
                </div>

                {/* EQS Trend Chart */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-obsidian-100/50 border border-border-grid rounded-xl p-5">
                    <h4 className="text-text-primary text-sm font-semibold mb-4 flex items-center gap-2">
                      <BarChart2 className="w-4 h-4 text-neon-cyan" /> Engineering Quality Score — Trend
                    </h4>
                    {eqsTrend.length > 0 ? (
                      <ResponsiveContainer width="100%" height={160}>
                        <LineChart data={eqsTrend}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="run_time" tickFormatter={v => new Date(v).toLocaleDateString()} tick={{ fill: '#64748b', fontSize: 10 }} />
                          <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} />
                          <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }} formatter={(v: any) => [`${v}%`, 'EQS']} />
                          <Line type="monotone" dataKey="eqs" stroke="#00f5ff" strokeWidth={2} dot={{ fill: '#00f5ff', r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-40 flex items-center justify-center text-text-muted text-sm">Run benchmark to generate trend data</div>
                    )}
                  </div>

                  {/* Radar Chart */}
                  <div className="bg-obsidian-100/50 border border-border-grid rounded-xl p-5">
                    <h4 className="text-text-primary text-sm font-semibold mb-4 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-purple-400" /> Metric Accuracy Radar
                    </h4>
                    {radarData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={160}>
                        <RadarChart data={radarData}>
                          <PolarGrid stroke="#1e293b" />
                          <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 9 }} />
                          <Radar name="Accuracy" dataKey="value" stroke="#a855f7" fill="#a855f7" fillOpacity={0.25} />
                        </RadarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-40 flex items-center justify-center text-text-muted text-sm">Run benchmark to populate radar</div>
                    )}
                  </div>
                </div>

                {/* Build Verification Summary */}
                {buildVerification && (
                  <div className="bg-obsidian-100/50 border border-border-grid rounded-xl p-5">
                    <h4 className="text-text-primary text-sm font-semibold mb-4 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-neon-cyan" /> Artifact Verification Status
                    </h4>
                    <div className="grid grid-cols-3 gap-4">
                      {(['dts', 'tcl', 'bsp'] as const).map(art => {
                        const r = buildVerification?.artifacts?.[art];
                        if (!r) return <div key={art} className="text-text-muted text-xs text-center py-4">No {art.toUpperCase()} generated</div>;
                        return (
                          <div key={art} className={`rounded-xl border p-4 ${r.success ? 'border-neon-emerald/30 bg-neon-emerald/5' : 'border-red-500/30 bg-red-500/5'}`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-text-secondary uppercase">{art === 'dts' ? 'Linux DTS' : art === 'tcl' ? 'Vivado TCL' : 'Vitis BSP'}</span>
                              {r.success ? <CheckCircle2 className="w-4 h-4 text-neon-emerald" /> : <XCircle className="w-4 h-4 text-red-400" />}
                            </div>
                            <p className={`text-xs font-mono ${r.success ? 'text-neon-emerald' : 'text-red-400'}`}>
                              {r.success ? '✓ PASSED' : `✗ ${r.errors?.length || 0} error(s)`}
                            </p>
                            {r.warnings?.length > 0 && <p className="text-[10px] text-neon-amber mt-1">{r.warnings.length} warning(s)</p>}
                            {r.referenceComparison?.available && (
                              <p className="text-[10px] text-text-muted mt-1">
                                Ref match: {r.referenceComparison.accuracy}%
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── DATASET ───────────────────────────────────────────────── */}
            {activeTab === 'dataset' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <select
                    value={vendorFilter}
                    onChange={e => setVendorFilter(e.target.value)}
                    className="bg-obsidian-100 border border-border-grid rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-neon-cyan/60"
                  >
                    <option value="All">All Vendors</option>
                    {VENDOR_LIST.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <span className="text-text-muted text-xs">{filteredBoards.length} boards</span>
                  <div className="ml-auto flex gap-2">
                    <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border-grid rounded-lg text-text-muted hover:border-neon-cyan/40 hover:text-text-secondary transition-colors">
                      <RefreshCw className="w-3.5 h-3.5" /> Refresh
                    </button>
                    <button onClick={() => setShowAddModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-neon-cyan/15 border border-neon-cyan/40 rounded-lg text-neon-cyan font-semibold hover:bg-neon-cyan/25 transition-colors">
                      <Plus className="w-3.5 h-3.5" /> Add Board
                    </button>
                  </div>
                </div>

                <div className="bg-obsidian border border-border-grid rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border-grid bg-obsidian-100/50 text-[10px] uppercase tracking-wider text-text-muted font-semibold">
                        {['Vendor', 'Board Name', 'Processor', 'Architecture', 'Doc', 'Status', 'Source', 'Actions'].map(h => (
                          <th key={h} className="px-4 py-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-grid">
                      {filteredBoards.length === 0 ? (
                        <tr><td colSpan={8} className="px-4 py-8 text-center text-text-muted italic">No boards found</td></tr>
                      ) : filteredBoards.map((board: BenchmarkBoard) => (
                        <tr key={board.id} className="hover:bg-obsidian-100/20 transition-colors">
                          <td className="px-4 py-3 font-semibold text-text-secondary">{board.vendor}</td>
                          <td className="px-4 py-3 font-bold text-text-primary">{board.boardName}</td>
                          <td className="px-4 py-3 text-text-muted font-mono text-[11px]">{board.processor}</td>
                          <td className="px-4 py-3 text-neon-cyan font-mono text-[11px]">{board.architecture}</td>
                          <td className="px-4 py-3 text-text-muted">{board.docVersion}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${board.status === 'verified' ? 'bg-neon-emerald/10 text-neon-emerald' :
                                board.status === 'pending_review' ? 'bg-neon-amber/10 text-neon-amber' :
                                  board.status === 'synthetic' ? 'bg-blue-500/10 text-blue-300' :
                                    'bg-red-500/10 text-red-400'
                              }`}>{board.status}</span>
                          </td>
                          <td className="px-4 py-3">
                            {board.sourceUrl ? (
                              <a href={board.sourceUrl} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 text-neon-cyan text-[11px] hover:underline">
                                <ArrowUpRight className="w-3 h-3" /> Docs
                              </a>
                            ) : <span className="text-text-muted">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button onClick={() => rebuildHkl(board.id)}
                                className="px-2 py-1 bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[10px] font-bold rounded hover:bg-blue-500/25 transition-colors">
                                Rebuild
                              </button>
                              <button onClick={() => removeBoard(board.id)}
                                className="p-1 hover:bg-red-500/20 rounded text-text-muted hover:text-red-400 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── EVALUATION RESULTS ──────────────────────────────────── */}
            {activeTab === 'evaluation' && (
              <div className="space-y-4">
                {!latestRun ? (
                  <div className="flex flex-col items-center justify-center h-64 gap-4">
                    <FlaskConical className="w-12 h-12 text-text-muted/30" />
                    <p className="text-text-muted text-sm">No evaluation results yet.</p>
                    <button onClick={runBenchmark} disabled={running}
                      className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm rounded-lg transition-all">
                      <Play className="w-4 h-4" />
                      Run Benchmark Suite
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-text-secondary text-xs font-mono">Run: {latestRun.run_id}</p>
                        <p className="text-text-muted text-[10px]">{new Date(latestRun.run_time).toLocaleString()}</p>
                      </div>
                      <button onClick={exportCsv} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border-grid rounded-lg text-text-muted hover:border-neon-cyan/40 transition-colors">
                        <Download className="w-3.5 h-3.5" /> Export CSV
                      </button>
                    </div>

                    {/* Hallucination Alert */}
                    {latestRun.hallucination_count > 0 && (
                      <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-red-400 text-sm font-semibold">
                            {latestRun.hallucination_count} board(s) with high hallucination rate detected
                          </p>
                          <p className="text-red-300/70 text-xs mt-0.5">
                            Generated values not traceable to official documentation or HKL. Review driver names, base addresses and IRQ numbers.
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="bg-obsidian border border-border-grid rounded-xl overflow-hidden overflow-x-auto">
                      <table className="w-full text-left text-[11px] border-collapse min-w-max">
                        <thead>
                          <tr className="border-b border-border-grid bg-obsidian-100/50 text-[10px] uppercase text-text-muted font-mono font-semibold">
                            <th className="px-4 py-3 sticky left-0 bg-obsidian-100/50">Board</th>
                            <th className="px-4 py-3">EQS</th>
                            {Object.entries(METRIC_LABELS).map(([k, l]) => (
                              <th key={k} className="px-3 py-3 whitespace-nowrap">{l.replace(' Accuracy', '').replace(' Detection', '').replace(' Mapping', '')}</th>
                            ))}
                            <th className="px-4 py-3">Issues</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-grid font-mono">
                          {latestRun.board_results.map((r, i) => (
                            <tr key={i} className="hover:bg-obsidian-100/20 transition-colors">
                              <td className="px-4 py-3 sticky left-0 bg-obsidian">
                                <p className="font-semibold text-text-primary">{r.board_name}</p>
                                <p className="text-[10px] text-text-muted">{r.vendor}</p>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`font-extrabold ${metricColor(r.eqs)}`}>{r.eqs.toFixed(1)}%</span>
                              </td>
                              {(Object.keys(METRIC_LABELS) as (keyof BenchmarkMetrics)[]).map(mk => {
                                const isHallu = mk === 'hallucination_rate';
                                const v = r.metrics[mk];
                                return (
                                  <td key={mk} className="px-3 py-3">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${metricBg(v, isHallu)} ${metricColor(v, isHallu)}`}>
                                      {v.toFixed(0)}%
                                    </span>
                                  </td>
                                );
                              })}
                              <td className="px-4 py-3">
                                {r.issues.length > 0 ? (
                                  <span className="text-red-400 text-[10px]">{r.issues.length} issue(s)</span>
                                ) : <span className="text-neon-emerald text-[10px]">✓ Clean</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Suggestions panel */}
                    {latestRun.board_results.some(r => r.suggestions.length > 0) && (
                      <div className="bg-obsidian-100/50 border border-border-grid rounded-xl p-5 space-y-3">
                        <h4 className="text-text-primary text-sm font-semibold flex items-center gap-2">
                          <Info className="w-4 h-4 text-neon-amber" /> Deterministic Fix Suggestions
                          <span className="text-[10px] text-text-muted font-normal ml-1">(Apply to Knowledge Base — no LLM retraining)</span>
                        </h4>
                        {latestRun.board_results.filter(r => r.suggestions.length > 0).map(r => (
                          <div key={r.board_id} className="space-y-1.5">
                            <p className="text-xs font-semibold text-text-secondary">{r.board_name}</p>
                            {r.suggestions.map((s, i) => (
                              <div key={i} className="flex items-start gap-2 text-[11px] text-text-muted bg-obsidian-200/50 px-3 py-2 rounded-lg">
                                <ChevronRight className="w-3 h-3 text-neon-amber shrink-0 mt-0.5" />
                                <span>{s}</span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── READINESS ─────────────────────────────────────────────── */}
            {activeTab === 'readiness' && (
              <div className="space-y-6">
                {/* Build Verification Panel */}
                <div className="bg-obsidian-100/50 border border-border-grid rounded-xl p-5 space-y-4">
                  <h4 className="text-text-primary text-sm font-semibold flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-neon-cyan" /> Build Verification — DTS · TCL · BSP
                  </h4>
                  {buildVerification ? (
                    <div className="space-y-3">
                      {(['dts', 'tcl', 'bsp'] as const).map(art => {
                        const r = buildVerification?.artifacts?.[art];
                        if (!r) return null;
                        return (
                          <div key={art} className={`rounded-xl border p-4 ${r.success ? 'border-neon-emerald/30 bg-neon-emerald/5' : 'border-red-500/30 bg-red-500/5'}`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-bold text-text-primary">
                                {art === 'dts' ? 'Linux Device Tree (DTS)' : art === 'tcl' ? 'Vivado TCL Script' : 'Vitis BSP Header'}
                              </span>
                              {r.success ? <CheckCircle2 className="w-5 h-5 text-neon-emerald" /> : <XCircle className="w-5 h-5 text-red-400" />}
                            </div>
                            {r.errors?.length > 0 && (
                              <div className="space-y-1 mt-2">
                                {r.errors.map((e: string, i: number) => (
                                  <p key={i} className="text-[11px] text-red-300 font-mono bg-red-950/30 px-2 py-1 rounded">{e}</p>
                                ))}
                              </div>
                            )}
                            {r.warnings?.length > 0 && (
                              <div className="space-y-1 mt-2">
                                {r.warnings.map((w: string, i: number) => (
                                  <p key={i} className="text-[11px] text-neon-amber font-mono bg-neon-amber/5 px-2 py-1 rounded">{w}</p>
                                ))}
                              </div>
                            )}
                            {r.retryCount > 0 && (
                              <p className="text-[11px] text-blue-300 mt-2">
                                Auto-repair attempted: {r.retryCount} retry(s)
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-text-muted text-sm italic">No verification results. Click "Verify Artifacts" above.</p>
                  )}
                </div>

                {/* 5-Gate Readiness */}
                <div className="bg-obsidian-100/50 border border-border-grid rounded-xl p-5">
                  <h4 className="text-text-primary text-sm font-semibold mb-6 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-purple-400" /> Engineering Readiness Gates
                  </h4>
                  {readiness ? (
                    <>
                      <div className="flex items-start justify-center gap-0 overflow-x-auto pb-2">
                        {READINESS_GATES.map((gate, i) => {
                          const g = readiness.gates?.[gate];
                          return (
                            <div key={gate} className="flex items-center">
                              <ReadinessGate
                                label={GATE_LABELS[gate]}
                                ready={g?.ready || false}
                                score={g?.score || 0}
                                isLast={i === READINESS_GATES.length - 1}
                              />
                              {i < READINESS_GATES.length - 1 && (
                                <div className={`h-0.5 w-10 mx-1 mt-[-24px] ${g?.ready ? 'bg-neon-emerald/50' : 'bg-border-grid'}`} />
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Metrics grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
                        {[
                          { label: 'Address Resolution', val: readiness.metrics?.addressResolution || 0, suffix: '%' },
                          { label: 'IRQ Resolution', val: readiness.metrics?.irqResolution || 0, suffix: '%' },
                          { label: 'Driver Resolution', val: readiness.metrics?.driverResolution || 0, suffix: '%' },
                          { label: 'Pin Resolution', val: readiness.metrics?.pinResolution || 0, suffix: '%' },
                        ].map(({ label, val, suffix }) => (
                          <div key={label} className="bg-obsidian-200/50 rounded-xl p-3 border border-border-grid">
                            <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1">{label}</p>
                            <p className={`text-xl font-extrabold font-mono ${metricColor(val)}`}>{val.toFixed(0)}{suffix}</p>
                          </div>
                        ))}
                      </div>

                      {readiness.issues?.length > 0 && (
                        <div className="mt-4 space-y-2">
                          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Blocking Issues</p>
                          {readiness.issues.map((issue: string, i: number) => (
                            <div key={i} className="flex items-start gap-2 text-xs text-neon-amber bg-neon-amber/5 border border-neon-amber/20 rounded-lg px-3 py-2">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{issue}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-10">
                      <p className="text-text-muted text-sm mb-3">Load hardware configuration and click "Analyze" to assess readiness.</p>
                      <button onClick={runAnalysis} disabled={analyzing || !peripherals.length}
                        className="px-5 py-2 bg-purple-600/30 border border-purple-500/40 text-purple-300 text-sm font-bold rounded-lg hover:bg-purple-600/50 transition-colors disabled:opacity-40">
                        {analyzing ? 'Analyzing…' : 'Run Readiness Assessment'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Hallucination findings */}
                {hallucinations.length > 0 && (
                  <div className="bg-obsidian-100/50 border border-red-500/20 rounded-xl p-5 space-y-3">
                    <h4 className="text-text-primary text-sm font-semibold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400" />
                      Hallucination Findings ({hallucinations.length})
                    </h4>
                    <div className="space-y-2">
                      {hallucinations.map((h, i) => (
                        <div key={i} className={`rounded-lg border px-3 py-2.5 text-xs flex items-start gap-3 ${h.risk === 'high' ? 'border-red-500/30 bg-red-500/5' : 'border-neon-amber/30 bg-neon-amber/5'
                          }`}>
                          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded mt-0.5 ${h.risk === 'high' ? 'bg-red-500/20 text-red-400' : 'bg-neon-amber/20 text-neon-amber'
                            }`}>{h.risk}</span>
                          <div>
                            <p className="font-semibold text-text-primary">{h.peripheral} · {h.field}</p>
                            <p className="text-text-muted mt-0.5">{h.reason}</p>
                            <p className="text-neon-cyan mt-0.5">{h.suggestion}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── REGRESSION HISTORY ───────────────────────────────────── */}
            {activeTab === 'regression' && (
              <div className="space-y-4">
                {/* Current regression summary */}
                {regressions && (
                  <div className={`rounded-xl border p-4 ${regressions.has_regressions ? 'border-red-500/30 bg-red-500/5' : 'border-neon-emerald/30 bg-neon-emerald/5'
                    }`}>
                    <div className="flex items-center gap-3">
                      {regressions.has_regressions
                        ? <ArrowDownRight className="w-5 h-5 text-red-400" />
                        : <ArrowUpRight className="w-5 h-5 text-neon-emerald" />}
                      <div>
                        <p className={`text-sm font-bold ${regressions.has_regressions ? 'text-red-400' : 'text-neon-emerald'}`}>
                          {regressions.has_regressions
                            ? `${regressions.regressions.length} metric(s) regressed`
                            : 'No regressions detected'}
                        </p>
                        <p className="text-text-muted text-xs mt-0.5">
                          vs. previous run · EQS delta: {regressions.eqs_delta >= 0 ? '+' : ''}{regressions.eqs_delta?.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                    {regressions.regressions?.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        {regressions.regressions.map((r: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-red-300">
                            <ArrowDownRight className="w-3 h-3" />
                            <span>{(METRIC_LABELS as any)[r.metric] || r.metric}:</span>
                            <span className="font-mono">{r.delta >= 0 ? '+' : ''}{r.delta.toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {regressions.improvements?.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {regressions.improvements.map((r: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-neon-emerald">
                            <ArrowUpRight className="w-3 h-3" />
                            <span>{(METRIC_LABELS as any)[r.metric] || r.metric}:</span>
                            <span className="font-mono">{r.delta >= 0 ? '+' : ''}{r.delta.toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* History table */}
                <div className="bg-obsidian border border-border-grid rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border-grid bg-obsidian-100/50 text-[10px] uppercase text-text-muted font-semibold font-mono">
                        <th className="px-4 py-3">Run ID</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Boards</th>
                        <th className="px-4 py-3">Eng. Quality Score</th>
                        <th className="px-4 py-3">Hallucinations</th>
                        <th className="px-4 py-3">Processor%</th>
                        <th className="px-4 py-3">Address%</th>
                        <th className="px-4 py-3">Driver%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-grid font-mono">
                      {history.length === 0 ? (
                        <tr><td colSpan={8} className="px-4 py-8 text-center text-text-muted italic">No runs yet. Click "Run Benchmark" to start.</td></tr>
                      ) : history.map((run, i) => (
                        <tr key={run.run_id} className={`hover:bg-obsidian-100/20 transition-colors ${i === 0 ? 'bg-neon-cyan/3' : ''}`}>
                          <td className="px-4 py-3 text-neon-cyan text-[10px]">{run.run_id.split('_').slice(-1)[0]}</td>
                          <td className="px-4 py-3 text-text-muted">{new Date(run.run_time).toLocaleString()}</td>
                          <td className="px-4 py-3 text-text-secondary">{run.total_boards}</td>
                          <td className="px-4 py-3">
                            <span className={`font-extrabold ${metricColor(run.overall_eqs)}`}>{run.overall_eqs.toFixed(1)}%</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={run.hallucination_count > 0 ? 'text-red-400 font-bold' : 'text-neon-emerald'}>
                              {run.hallucination_count}
                            </span>
                          </td>
                          <td className="px-4 py-3"><span className={metricColor(run.aggregate_metrics?.processor_detection || 0)}>{(run.aggregate_metrics?.processor_detection || 0).toFixed(0)}%</span></td>
                          <td className="px-4 py-3"><span className={metricColor(run.aggregate_metrics?.base_address_accuracy || 0)}>{(run.aggregate_metrics?.base_address_accuracy || 0).toFixed(0)}%</span></td>
                          <td className="px-4 py-3"><span className={metricColor(run.aggregate_metrics?.driver_mapping || 0)}>{(run.aggregate_metrics?.driver_mapping || 0).toFixed(0)}%</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── TRACEABILITY ─────────────────────────────────────────── */}
            {activeTab === 'traceability' && (
              <div className="space-y-4">
                {decisionLog.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 gap-4">
                    <FileSearch className="w-12 h-12 text-text-muted/30" />
                    <p className="text-text-muted text-sm text-center max-w-sm">
                      No traceability data yet. Load hardware peripherals and click "Analyze" to generate per-field source traceability records.
                    </p>
                    <button onClick={runAnalysis} disabled={analyzing || !peripherals.length}
                      className="px-5 py-2 bg-blue-600/30 border border-blue-500/40 text-blue-300 text-sm font-bold rounded-lg hover:bg-blue-600/50 transition-colors disabled:opacity-40">
                      {analyzing ? 'Analyzing…' : 'Run Traceability Analysis'}
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Summary row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: 'Total Fields', val: decisionLog.length, color: 'cyan' as const },
                        { label: 'Resolved', val: decisionLog.filter((r: any) => r.resolved).length, color: 'emerald' as const },
                        { label: 'Unresolved', val: decisionLog.filter((r: any) => !r.resolved).length, color: 'red' as const },
                        { label: 'Avg Confidence', val: decisionLog.length ? `${(decisionLog.reduce((a: number, r: any) => a + r.confidence, 0) / decisionLog.length).toFixed(1)}%` : '—', color: 'purple' as const },
                      ].map(({ label, val, color }) => (
                        <KpiCard key={label} label={label} value={val} color={color} />
                      ))}
                    </div>

                    {/* Source usage bar chart */}
                    <div className="bg-obsidian-100/50 border border-border-grid rounded-xl p-5">
                      <h4 className="text-text-primary text-sm font-semibold mb-4">Source Distribution</h4>
                      {(() => {
                        const sourceCounts: Record<string, number> = {};
                        decisionLog.forEach((r: any) => { sourceCounts[r.source] = (sourceCounts[r.source] || 0) + 1; });
                        const data = Object.entries(sourceCounts).map(([name, count]) => ({ name, count }));
                        return (
                          <ResponsiveContainer width="100%" height={120}>
                            <BarChart data={data}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
                              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }} />
                              <Bar dataKey="count" fill="#00f5ff" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        );
                      })()}
                    </div>

                    {/* Decision log table */}
                    <div className="bg-obsidian border border-border-grid rounded-xl overflow-hidden">
                      <table className="w-full text-left text-[11px] border-collapse">
                        <thead>
                          <tr className="border-b border-border-grid bg-obsidian-100/50 text-[10px] uppercase text-text-muted font-semibold">
                            {['Peripheral', 'Field', 'Value', 'Source', 'Resolution Path', 'Page', 'Confidence', 'Risk'].map(h => (
                              <th key={h} className="px-4 py-3">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-grid font-mono">
                          {decisionLog.map((r: any, i: number) => (
                            <tr key={i} className={`hover:bg-obsidian-100/20 transition-colors ${!r.resolved ? 'bg-red-950/10' : ''}`}>
                              <td className="px-4 py-3 font-semibold text-text-secondary">{r.artifact}</td>
                              <td className="px-4 py-3 text-neon-cyan">{r.field}</td>
                              <td className="px-4 py-3 text-text-primary max-w-[120px] truncate" title={r.value}>{r.value}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${r.source === 'Knowledge Base' ? 'bg-neon-amber/10 text-neon-amber' :
                                    r.source === 'PDF' || r.source === 'Table' ? 'bg-neon-cyan/10 text-neon-cyan' :
                                      r.source === 'Vivado XSA' ? 'bg-purple-500/10 text-purple-300' :
                                        r.source === 'Unresolved' ? 'bg-red-500/10 text-red-400' :
                                          'bg-obsidian-200 text-text-muted'
                                  }`}>{r.source}</span>
                              </td>
                              <td className="px-4 py-3 text-text-muted text-[10px] max-w-[160px] truncate" title={r.reason}>{r.reason}</td>
                              <td className="px-4 py-3 text-text-muted">{r.page}</td>
                              <td className="px-4 py-3">
                                <span className={`font-bold ${r.confidence >= 85 ? 'text-neon-emerald' : r.confidence >= 60 ? 'text-neon-amber' : 'text-red-400'}`}>
                                  {r.confidence}%
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${r.hallucinationRisk === 'low' ? 'bg-neon-emerald/10 text-neon-emerald' :
                                    r.hallucinationRisk === 'medium' ? 'bg-neon-amber/10 text-neon-amber' :
                                      'bg-red-500/10 text-red-400'
                                  }`}>{r.hallucinationRisk}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Board Modal */}
      {showAddModal && (
        <AddBoardModal onClose={() => setShowAddModal(false)} onAdd={addBoard} />
      )}
    </div>
  );
}
