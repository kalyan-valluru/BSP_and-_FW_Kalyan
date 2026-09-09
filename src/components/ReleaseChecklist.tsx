import { useState } from 'react';
import { ShieldAlert, CheckSquare, Square, Rocket } from 'lucide-react';

export function ReleaseChecklist() {
  const [checks, setChecks] = useState<Record<string, boolean>>({
    extraction: true,
    validation: true,
    bsp: true,
    dts: true,
    tcl: true,
    vitis: true,
    compilation: false,
    report: false,
    pdf: false,
    unit: true,
    integration: false,
    perf: true
  });

  const [productionReady, setProductionReady] = useState(false);

  const toggleCheck = (key: string) => {
    const updated = { ...checks, [key]: !checks[key] };
    setChecks(updated);
    
    // If all checks are checked, enable release
    const allChecked = Object.values(updated).every(val => val === true);
    setProductionReady(allChecked);
  };

  const listItems = [
    { key: 'extraction', label: 'Hardware extraction matches source schematic PDF' },
    { key: 'validation', label: 'Peripheral config validation rules pass with 0 errors' },
    { key: 'bsp', label: 'Bare Metal Standalone driver files successfully generated' },
    { key: 'dts', label: 'Device Tree DTS matching target compatible registers built' },
    { key: 'tcl', label: 'Vivado TCL block design generation script synthesized' },
    { key: 'vitis', label: 'Vitis Platform platform.spr descriptor generated' },
    { key: 'compilation', label: 'Vitis Compiler toolchain executes clean (firmware.elf generated)' },
    { key: 'report', label: 'Explainability Decision Log and Report cached' },
    { key: 'pdf', label: 'Formal Engineering Report PDF generated' },
    { key: 'unit', label: 'All frontend and backend unit tests pass in CI environment' },
    { key: 'integration', label: 'Multi-agent coordination system integration tests pass' },
    { key: 'perf', label: 'Processing latency benchmarks within target threshold' }
  ];

  return (
    <div className="bg-obsidian-100/50 border border-border-grid rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-text-primary text-sm font-semibold flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-red-500 animate-pulse" />
          Production Release Acceptance Checklist
        </h3>
        <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${
          productionReady ? 'bg-neon-emerald/10 border-neon-emerald/30 text-neon-emerald' : 'bg-neon-amber/10 border-neon-amber/30 text-neon-amber'
        }`}>
          {productionReady ? 'Release Approved' : 'Release Pending'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {listItems.map((item) => (
          <button
            key={item.key}
            onClick={() => toggleCheck(item.key)}
            className="flex items-start gap-3 p-3 rounded-lg border border-border-grid bg-obsidian text-left hover:bg-obsidian-200/50 transition-colors"
          >
            {checks[item.key] ? (
              <CheckSquare className="w-4 h-4 text-neon-emerald shrink-0 mt-0.5" />
            ) : (
              <Square className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
            )}
            <span className={`text-xs ${checks[item.key] ? 'text-text-primary font-medium' : 'text-text-muted'}`}>
              {item.label}
            </span>
          </button>
        ))}
      </div>

      <div className="pt-3 border-t border-border-grid flex justify-between items-center">
        <p className="text-[10px] text-text-muted font-mono">
          * Release requires 100% compliance matching AMD design rules.
        </p>
        <button
          disabled={!productionReady}
          className={`px-5 py-2.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all ${
            productionReady
              ? 'bg-gradient-to-r from-neon-emerald to-neon-cyan hover:shadow-neon-emerald text-obsidian cursor-pointer'
              : 'bg-obsidian-200 text-text-muted cursor-not-allowed'
          }`}
        >
          <Rocket className="w-3.5 h-3.5" /> Approve Production Build
        </button>
      </div>
    </div>
  );
}
