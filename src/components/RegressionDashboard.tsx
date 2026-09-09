import { useState } from 'react';
import { Radio, ShieldCheck, Play } from 'lucide-react';

export function RegressionDashboard() {
  const [results, setResults] = useState<any[]>([]);
  const [running, setRunning] = useState(false);

  const triggerRegression = async () => {
    setRunning(true);
    try {
      const res = await fetch('/api/regression/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peripherals: [], processorName: 'Zynq-7000' })
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.results)) {
        setResults(data.results);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="bg-obsidian-100/50 border border-border-grid rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-text-primary text-sm font-semibold flex items-center gap-2">
          <Radio className="w-4 h-4 text-purple-400 animate-pulse" />
          AI Extraction Regression Testing Suite
        </h3>
        <span className="text-[10px] text-neon-cyan font-mono uppercase bg-neon-cyan/10 border border-neon-cyan/30 px-2 py-0.5 rounded flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5" /> Reference Suite Active
        </span>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center bg-obsidian-200/50 p-3.5 rounded-xl border border-border-grid">
          <div>
            <p className="text-xs font-semibold text-text-primary">Benchmark Validation Tests</p>
            <p className="text-[10px] text-text-muted mt-0.5">Run benchmark checks against Zynq, UltraScale, Versal, and NXP references.</p>
          </div>
          <button
            onClick={triggerRegression}
            disabled={running}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 hover:shadow-purple-500 text-text-primary font-bold text-xs rounded-lg flex items-center gap-1.5 transition-all"
          >
            {running ? 'Running Suite...' : <><Play className="w-3.5 h-3.5" /> Execute Test Suite</>}
          </button>
        </div>

        {results.length > 0 && (
          <div className="bg-obsidian border border-border-grid rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border-grid bg-obsidian-200/50 text-[10px] uppercase text-text-muted font-mono font-semibold">
                  <th className="px-4 py-2.5">Benchmark Target</th>
                  <th className="px-4 py-2.5">Extraction Accuracy</th>
                  <th className="px-4 py-2.5">DTS Compatible String</th>
                  <th className="px-4 py-2.5">TCL Generation</th>
                  <th className="px-4 py-2.5 text-right">Fidelity Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-grid font-mono">
                {results.map((r, idx) => (
                  <tr key={idx} className="hover:bg-obsidian-200/20 transition-colors">
                    <td className="px-4 py-3 font-semibold text-text-secondary">{r.testCase}</td>
                    <td className="px-4 py-3 text-neon-cyan">{r.extractionAccuracy}%</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                        r.dtsStatus === 'passed' ? 'bg-neon-emerald/10 text-neon-emerald' : 'bg-red-500/10 text-red-400'
                      }`}>
                        {r.dtsStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                        r.bspStatus === 'passed' ? 'bg-neon-emerald/10 text-neon-emerald' : 'bg-red-500/10 text-red-400'
                      }`}>
                        {r.bspStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-text-primary">{r.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
