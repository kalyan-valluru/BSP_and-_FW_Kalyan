import { PlayCircle, ShieldAlert, CheckCircle2, Monitor, Server } from 'lucide-react';

interface SimulationStatusProps {
  hasPeripherals: boolean;
  compilationSuccess: boolean;
}

export function SimulationStatus({ hasPeripherals, compilationSuccess }: SimulationStatusProps) {
  return (
    <div className="bg-obsidian-50/50 border border-border-grid rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-text-primary text-sm font-semibold flex items-center gap-2">
          <PlayCircle className="w-4 h-4 text-neon-cyan" />
          EDA Simulation & Verification Status
        </h3>
        <span className="text-[10px] text-text-muted font-mono uppercase bg-obsidian-200 px-2 py-0.5 rounded">
          Virtual Loop Verification
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Behavioral Simulation */}
        <div className="bg-obsidian border border-border-grid rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono text-text-muted uppercase">Behavioral Sim</span>
              <Monitor className="w-4 h-4 text-neon-cyan" />
            </div>
            <p className="text-text-primary text-sm font-bold">Vivado XSIM</p>
            <p className="text-text-muted text-[11px] mt-1 leading-relaxed">
              Verify functional behavior of AXI master register writes.
            </p>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs">
            {hasPeripherals ? (
              <span className="text-neon-emerald flex items-center gap-1 font-mono font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> READY
              </span>
            ) : (
              <span className="text-text-muted flex items-center gap-1 font-mono">
                <ShieldAlert className="w-3.5 h-3.5" /> IDLE
              </span>
            )}
          </div>
        </div>

        {/* Timing Simulation */}
        <div className="bg-obsidian border border-border-grid rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono text-text-muted uppercase">Timing Sim</span>
              <Monitor className="w-4 h-4 text-neon-cyan" />
            </div>
            <p className="text-text-primary text-sm font-bold">Post-Synthesis Timing</p>
            <p className="text-text-muted text-[11px] mt-1 leading-relaxed">
              Analyze propagation delays and setup/hold bounds.
            </p>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs">
            {compilationSuccess ? (
              <span className="text-neon-emerald flex items-center gap-1 font-mono font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> STABLE (0ns Slack)
              </span>
            ) : (
              <span className="text-text-muted flex items-center gap-1 font-mono">
                <ShieldAlert className="w-3.5 h-3.5" /> UNVERIFIED
              </span>
            )}
          </div>
        </div>

        {/* XSIM Simulator status */}
        <div className="bg-obsidian border border-border-grid rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono text-text-muted uppercase">Co-Simulation</span>
              <Server className="w-4 h-4 text-neon-cyan" />
            </div>
            <p className="text-text-primary text-sm font-bold">QEMU CPU Emulation</p>
            <p className="text-text-muted text-[11px] mt-1 leading-relaxed">
              Boot system firmware using CPU models mapped to custom RTL.
            </p>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs">
            {compilationSuccess ? (
              <span className="text-neon-emerald flex items-center gap-1 font-mono font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> EMULATOR CONFIGURED
              </span>
            ) : (
              <span className="text-text-muted flex items-center gap-1 font-mono">
                <ShieldAlert className="w-3.5 h-3.5" /> WAITING FOR ELF
              </span>
            )}
          </div>
        </div>

        {/* Hardware loop status */}
        <div className="bg-obsidian border border-border-grid rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono text-text-muted uppercase">Verification Loop</span>
              <Server className="w-4 h-4 text-neon-cyan" />
            </div>
            <p className="text-text-primary text-sm font-bold">Model-In-The-Loop</p>
            <p className="text-text-muted text-[11px] mt-1 leading-relaxed">
              Interactive test bench mapping registers dynamically.
            </p>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs">
            {hasPeripherals ? (
              <span className="text-neon-emerald flex items-center gap-1 font-mono font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> COMPATIBLE
              </span>
            ) : (
              <span className="text-text-muted flex items-center gap-1 font-mono">
                <ShieldAlert className="w-3.5 h-3.5" /> NO MAP TARGET
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
