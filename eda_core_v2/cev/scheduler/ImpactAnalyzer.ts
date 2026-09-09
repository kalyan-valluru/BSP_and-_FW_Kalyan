import { ChangeEvent, ImpactAnalysisReport } from '../types/cevTypes';

export class CrossStageDependencyGraph {
  public determineAffectedStages(events: ChangeEvent[]): { required: string[]; skipped: string[]; risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' } {
    const allStages = ['EVE_VALIDATION', 'IBFGE_BSP_GEN', 'IDPGE_DRIVER_GEN', 'ISLMCE_LINKER_GEN', 'MTBEE_COMPILE', 'SEE_SIMULATION', 'HILVE_HARDWARE_VAL', 'ERCE_CERTIFICATION'];
    const requiredSet = new Set<string>();

    let risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';

    for (const evt of events) {
      if (evt.category === 'PROCESSOR_MODEL' || evt.category === 'BOARD_MODEL') {
        allStages.forEach(s => requiredSet.add(s));
        risk = 'CRITICAL';
      } else if (evt.category === 'LINKER_SCRIPT' || evt.category === 'BSP_SOURCE') {
        requiredSet.add('MTBEE_COMPILE');
        requiredSet.add('SEE_SIMULATION');
        requiredSet.add('HILVE_HARDWARE_VAL');
        requiredSet.add('ERCE_CERTIFICATION');
        if (risk !== 'CRITICAL') risk = 'HIGH';
      } else if (evt.category === 'DOCUMENT') {
        requiredSet.add('EVE_VALIDATION');
        requiredSet.add('IBFGE_BSP_GEN');
        requiredSet.add('MTBEE_COMPILE');
        requiredSet.add('SEE_SIMULATION');
      }
    }

    if (requiredSet.size === 0) {
      requiredSet.add('EVE_VALIDATION');
    }

    const required = Array.from(requiredSet);
    const skipped = allStages.filter(s => !requiredSet.has(s));

    return { required, skipped, risk };
  }
}

export class ImpactAnalyzer {
  private depGraph = new CrossStageDependencyGraph();

  public analyzeImpact(events: ChangeEvent[]): ImpactAnalysisReport {
    const timestamp = new Date().toISOString();
    const result = this.depGraph.determineAffectedStages(events);

    const fullTimeSeconds = 120;
    const requiredTimeSeconds = (result.required.length / 8) * fullTimeSeconds;
    const timeSavings = Math.round(((fullTimeSeconds - requiredTimeSeconds) / fullTimeSeconds) * 100);

    return {
      analysisId: `IMP-${Date.now()}`,
      timestamp,
      changedAssets: events,
      affectedModules: result.required,
      requiredStages: result.required,
      skippedStages: result.skipped,
      riskLevel: result.risk,
      estimatedTimeSeconds: Math.round(requiredTimeSeconds),
      timeSavingsPercentage: Math.max(0, timeSavings)
    };
  }
}
