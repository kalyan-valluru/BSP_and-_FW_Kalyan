import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import type { ValidationReport } from '../types';

interface ValidationMatrixProps {
  report?: ValidationReport;
}

export function ValidationMatrix({ report }: ValidationMatrixProps) {
  const checks = report?.checks || [];

  const getStatusIcon = (passed: boolean, severity: string) => {
    if (passed) return <CheckCircle2 className="w-4 h-4 text-neon-emerald" />;
    if (severity.toLowerCase() === 'critical' || severity.toLowerCase() === 'error') return <XCircle className="w-4 h-4 text-red-500" />;
    return <AlertTriangle className="w-4 h-4 text-neon-amber" />;
  };

  const getTierLabel = (id: string) => {
    if (id.startsWith('V001') || id.startsWith('V002') || id.startsWith('V003') || id.startsWith('V006') || id.startsWith('V010')) {
      return 'Hardware Extraction';
    }
    if (id.startsWith('V008')) {
      return 'BSP Validation';
    }
    if (id.startsWith('V005')) {
      return 'Linux DTS Validation';
    }
    return 'System Core';
  };

  return (
    <div className="bg-obsidian-100/50 border border-border-grid rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border-grid bg-obsidian-100/50">
        <h3 className="text-text-primary text-sm font-semibold">Engineering Validation Matrix</h3>
        <p className="text-text-muted text-xs mt-1">Multi-tier hardware design compliance verification matrix</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border-grid bg-obsidian-200/50 text-[10px] uppercase tracking-wider text-text-muted font-semibold">
              <th className="px-5 py-3">Validation Category</th>
              <th className="px-5 py-3">Verification Rule</th>
              <th className="px-5 py-3">Severity</th>
              <th className="px-5 py-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-grid text-xs">
            {checks.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-6 text-center text-text-muted italic">
                  Run pipeline to perform validation matrix scan.
                </td>
              </tr>
            ) : (
              checks.map((check: any) => (
                <tr key={check.id} className="hover:bg-obsidian-200/20 transition-colors">
                  <td className="px-5 py-3.5 font-semibold text-text-secondary">{getTierLabel(check.id)}</td>
                  <td className="px-5 py-3.5">
                    <div className="text-text-primary font-medium">{check.name}</div>
                    <div className="text-text-muted text-[10px] mt-0.5">{check.detail}</div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                      check.severity.toLowerCase() === 'critical' || check.severity.toLowerCase() === 'error' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                      check.severity.toLowerCase() === 'warning' ? 'bg-neon-amber/10 text-neon-amber border border-neon-amber/20' :
                      'bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20'
                    }`}>
                      {check.severity}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right flex justify-end items-center">
                    {getStatusIcon(check.passed, check.severity)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
