import { useState } from 'react';
import { Target, Terminal, Play, CheckCircle2, AlertCircle } from 'lucide-react';

export function HilController() {
  const [board, setBoard] = useState('ZedBoard');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runTest = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/hil/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ board })
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.result);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-obsidian-100/50 border border-border-grid rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-text-primary text-sm font-semibold flex items-center gap-2">
          <Target className="w-4 h-4 text-neon-amber animate-pulse" />
          Hardware-in-the-Loop Validation Suite
        </h3>
        <span className="text-[10px] text-neon-cyan font-mono uppercase bg-neon-cyan/10 border border-neon-cyan/30 px-2 py-0.5 rounded flex items-center gap-1">
          <Terminal className="w-3.5 h-3.5" /> JTAG Core Online
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Board selection */}
        <div className="bg-obsidian border border-border-grid rounded-xl p-4 flex flex-col justify-between">
          <div className="space-y-3">
            <label className="text-xs font-semibold text-text-secondary uppercase">Select Target Board</label>
            <select
              value={board}
              onChange={(e) => setBoard(e.target.value)}
              className="w-full bg-obsidian-200 border border-border-grid text-text-primary text-xs rounded-lg p-2.5 outline-none font-mono focus:border-neon-cyan"
            >
              {['ZedBoard', 'PYNQ-Z2', 'Kria KV260', 'ZCU102', 'Raspberry Pi'].map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <p className="text-[10px] text-text-muted leading-relaxed">
              Triggers firmware programming over Digilent FTDI JTAG interface and verifies core boot sequence via UART.
            </p>
          </div>

          <button
            onClick={runTest}
            disabled={loading}
            className="w-full mt-4 bg-gradient-to-r from-neon-amber to-orange-500 hover:shadow-neon-amber text-obsidian font-bold text-xs py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all"
          >
            {loading ? 'Executing Flash JTAG...' : <><Play className="w-4 h-4" /> Run HIL Verification</>}
          </button>
        </div>

        {/* Output logs */}
        <div className="lg:col-span-2 bg-obsidian border border-border-grid rounded-xl p-4 flex flex-col min-h-[220px]">
          <div className="flex items-center justify-between border-b border-border-grid pb-2 mb-3 text-xs">
            <span className="font-semibold text-text-secondary uppercase">JTAG / UART Flash Telemetry Output</span>
            {result && (
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1 ${
                result.status === 'passed' ? 'bg-neon-emerald/20 text-neon-emerald' : 'bg-red-500/20 text-red-400'
              }`}>
                {result.status === 'passed' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                {result.status}
              </span>
            )}
          </div>
          <div className="flex-1 bg-obsidian-200 rounded-lg p-3 font-mono text-[11px] text-neon-emerald overflow-y-auto max-h-[160px] whitespace-pre">
            {loading ? (
              <div className="flex items-center justify-center h-full text-text-muted animate-pulse">Running hardware-in-the-loop test...</div>
            ) : result ? (
              result.uartLog
            ) : (
              <span className="text-text-muted italic">Click Run to program selected hardware and capture console log output.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
