import { ReliabilityPipeline } from './pipeline/ReliabilityPipeline';
import { ReliabilityDashboard, ReliabilityReport } from './types/reliabilityTypes';

export class ReliabilityManager {
  private static instance: ReliabilityManager;

  public readonly pipeline = new ReliabilityPipeline();

  private constructor() {}

  public static getInstance(): ReliabilityManager {
    if (!ReliabilityManager.instance) {
      ReliabilityManager.instance = new ReliabilityManager();
    }
    return ReliabilityManager.instance;
  }

  /**
   * Executes controlled failure injection scenarios and evaluates MTTR & resilience
   */
  public async testReliability(): Promise<ReliabilityDashboard> {
    return this.pipeline.testReliability();
  }

  /**
   * Synthesizes reliability report
   */
  public generateReport(dash: ReliabilityDashboard): ReliabilityReport {
    return this.pipeline.generateReport(dash);
  }
}
