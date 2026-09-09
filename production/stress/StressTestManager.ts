import { StressPipeline } from './pipeline/StressPipeline';
import { StressDashboard, StressReport } from './types/stressTypes';

export class StressTestManager {
  private static instance: StressTestManager;

  public readonly pipeline = new StressPipeline();

  private constructor() {}

  public static getInstance(): StressTestManager {
    if (!StressTestManager.instance) {
      StressTestManager.instance = new StressTestManager();
    }
    return StressTestManager.instance;
  }

  /**
   * Executes stress & scalability testing across 1 to 1000 concurrent user workloads
   */
  public async executeStressTest(): Promise<StressDashboard> {
    return this.pipeline.executeStressTest();
  }

  /**
   * Synthesizes stress report
   */
  public generateReport(dash: StressDashboard): StressReport {
    return this.pipeline.generateReport(dash);
  }
}
