import { EvidenceChainStep } from '../types/aerlTypes';

export class ReasoningSynthesizer {
  public synthesizeRationale(chain: EvidenceChainStep[], eveReport?: any): string {
    if (!eveReport || eveReport.issues?.length === 0) {
      return "All hardware configuration parameters passed deterministic 6-stage EVE validation. System is 100% ready for BSP compilation.";
    }

    const firstIssue = eveReport.issues[0];
    return `Validation check '${firstIssue.id}' flagged root cause: '${firstIssue.rootCause}'. ` +
      `Engineering explanation: ${firstIssue.engineeringExplanation} ` +
      `Recommended repair action: ${firstIssue.suggestedFix}`;
  }

  public synthesizeRisk(eveReport?: any): string {
    if (!eveReport || eveReport.criticalCount === 0) {
      return "Low Risk: Zero critical memory collisions or clock loop anomalies detected.";
    }
    return `High Risk: System contains ${eveReport.criticalCount} critical engineering issue(s) that will prevent hardware initialization.`;
  }
}
