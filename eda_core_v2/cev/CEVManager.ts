import { CEVPipeline } from './pipeline/CEVPipeline';
import { VerificationPlan, CEVReport, VerificationPolicy } from './types/cevTypes';

export class CEVManager {
  private static instance: CEVManager;

  public readonly pipeline = new CEVPipeline();

  private constructor() {}

  public static getInstance(): CEVManager {
    if (!CEVManager.instance) {
      CEVManager.instance = new CEVManager();
    }
    return CEVManager.instance;
  }

  /**
   * Evaluates asset change events and schedules dependency-aware incremental verification plans
   */
  public async evaluateChanges(modifiedFiles: { path: string; type: 'CREATED' | 'MODIFIED' | 'DELETED' }[], policy: VerificationPolicy = 'IMMEDIATE'): Promise<VerificationPlan> {
    return this.pipeline.evaluateChanges(modifiedFiles, policy);
  }

  /**
   * Synthesizes continuous verification statistics and report
   */
  public generateReport(plan: VerificationPlan): CEVReport {
    return this.pipeline.generateReport(plan);
  }
}
