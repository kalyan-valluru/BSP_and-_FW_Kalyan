import { FileText, Cpu, Settings, ShieldCheck } from 'lucide-react';
import type { DecisionLogEntry } from '../types';

interface DecisionLogProps {
  entries?: DecisionLogEntry[];
}

export function DecisionLog({ entries = [] }: DecisionLogProps) {
  const getIcon = (source: string) => {
    switch (source) {
      case 'PDF': return <FileText className="w-3.5 h-3.5 text-neon-cyan" />;
      case 'Knowledge Base': return <Settings className="w-3.5 h-3.5 text-neon-amber" />;
      case 'AI Inference': return <Cpu className="w-3.5 h-3.5 text-purple-400" />;
      default: return <ShieldCheck className="w-3.5 h-3.5 text-neon-emerald" />;
    }
  };

  return (
    <div className="bg-obsidian-100/50 border border-border-grid rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border-grid bg-obsidian-100/50">
        <h3 className="text-text-primary text-sm font-semibold">Engineering Decision Log</h3>
        <p className="text-text-muted text-xs mt-1">Traceability and explainability records for every generation step</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border-grid bg-obsidian-200/50 text-[10px] uppercase tracking-wider text-text-muted font-semibold">
              <th className="px-5 py-3">Artifact / Target</th>
              <th className="px-5 py-3">Property</th>
              <th className="px-5 py-3">Assigned Value</th>
              <th className="px-5 py-3">Source Origin</th>
              <th className="px-5 py-3">Engineering Rationale</th>
              <th className="px-5 py-3 text-right">Page</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-grid text-xs">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-text-muted italic">
                  No decision log entries compiled yet.
                </td>
              </tr>
            ) : (
              entries.map((entry, idx) => (
                <tr key={idx} className="hover:bg-obsidian-200/20 transition-colors">
                  <td className="px-5 py-3.5 font-semibold text-text-secondary">{entry.artifact}</td>
                  <td className="px-5 py-3.5 font-mono text-neon-cyan">{entry.field}</td>
                  <td className="px-5 py-3.5 font-mono text-text-primary">{entry.value}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5 font-medium text-text-secondary">
                      {getIcon(entry.source)}
                      <span>{entry.source}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-text-muted max-w-sm truncate hover:text-clip hover:whitespace-normal">
                    {entry.reason}
                  </td>
                  <td className="px-5 py-3.5 text-right text-text-muted font-mono">{entry.page || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
