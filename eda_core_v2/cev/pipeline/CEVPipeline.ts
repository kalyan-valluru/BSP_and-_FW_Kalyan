import { AssetChangeWatcher } from '../watchers/AssetChangeWatcher';
import { ImpactAnalyzer } from '../scheduler/ImpactAnalyzer';
import { VerificationRepository } from '../repository/VerificationRepository';
import { VerificationPlan, CEVReport, VerificationPolicy } from '../types/cevTypes';

export class CEVPipeline {
  private watcher = new AssetChangeWatcher();
  private analyzer = new ImpactAnalyzer();
  public repository = new VerificationRepository();

  /**
   * Executes 7-Stage Continuous Engineering Verification Pipeline
   */
  public async evaluateChanges(modifiedFiles: { path: string; type: 'CREATED' | 'MODIFIED' | 'DELETED' }[], policy: VerificationPolicy = 'IMMEDIATE'): Promise<VerificationPlan> {
    const timestamp = new Date().toISOString();

    // Stage 1 & 2: Detect & catalog change events
    const events = this.watcher.detectChanges(modifiedFiles);

    // Stage 3 & 4: Execute Cross-Stage Dependency Graph & Impact Analysis
    const impactReport = this.analyzer.analyzeImpact(events);

    // Stage 5 & 6: Schedule incremental verification & persist plan
    const plan: VerificationPlan = {
      planId: `CEV-PLAN-${Date.now()}`,
      timestamp,
      policy,
      impactReport,
      scheduledStages: impactReport.requiredStages,
      executionStatus: 'COMPLETED'
    };

    this.repository.addPlan(plan);

    return plan;
  }

  public generateReport(plan: VerificationPlan): CEVReport {
    const timestamp = new Date().toISOString();
    const stats = this.repository.computeStatistics();

    return {
      reportId: `CEV-REP-${Date.now()}`,
      timestamp,
      plan,
      statistics: stats
    };
  }
}
