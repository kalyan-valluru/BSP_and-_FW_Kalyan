import { FailureCorrelator } from '../analyzers/FailureCorrelator';
import { RepairPlanner, AutoRepairExecutor } from '../repair/RepairPlanner';
import { DiagnosticReport, DiagnosticClassification } from '../types/abrdeTypes';

export class ABRDEPipeline {
  private correlator = new FailureCorrelator();
  private planner = new RepairPlanner();
  private autoRepair = new AutoRepairExecutor();

  /**
   * Executes 7-Stage Diagnostic & Auto-Repair Pipeline
   */
  public async executePipeline(pipelineOutputs: { mtbeeResult?: any; seeResult?: any; eveReport?: any }, context: Record<string, any>): Promise<DiagnosticReport> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    const procId = context.targetProcessorId || 'zynq-7000';
    const autoRepairMode = context.autoRepairMode === true;

    // Stage 1, 2, 3: Collect outputs & correlate failure issues
    const issues = this.correlator.correlateFailures(pipelineOutputs);

    // Stage 4 & 5: Construct deterministic Repair Plan & Validate with EVE
    const repairPlan = this.planner.planRepairs(issues, procId);

    // Stage 6: (Optional Auto-Repair) Execute ETE transformations
    let history: any[] = [];
    let finalClassification: DiagnosticClassification = repairPlan.classification;

    if (autoRepairMode && repairPlan.candidates.length > 0) {
      history = this.autoRepair.executeAutoRepair(repairPlan);
      finalClassification = 'REPAIR_SUCCESSFUL';
    }

    const endTime = Date.now();

    return {
      reportId: `ABRDE-REP-${Date.now()}`,
      timestamp,
      targetProcessor: procId,
      classification: finalClassification,
      issues,
      repairPlan,
      repairHistory: history,
      diagnosticTimeMs: endTime - startTime
    };
  }
}
