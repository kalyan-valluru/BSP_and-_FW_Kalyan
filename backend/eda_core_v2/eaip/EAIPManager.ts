import { EAIPPipeline } from './pipeline/EAIPPipeline';
import { AnalyticsDashboard, EAIPReport } from './types/eaipTypes';

export class EAIPManager {
  private static instance: EAIPManager;

  public readonly pipeline = new EAIPPipeline();

  private constructor() {}

  public static getInstance(): EAIPManager {
    if (!EAIPManager.instance) {
      EAIPManager.instance = new EAIPManager();
    }
    return EAIPManager.instance;
  }

  /**
   * Generates read-only engineering analytics dashboard and operational KPIs
   */
  public async generateDashboard(): Promise<AnalyticsDashboard> {
    return this.pipeline.generateDashboard();
  }

  /**
   * Synthesizes analytics report
   */
  public generateReport(dash: AnalyticsDashboard): EAIPReport {
    return this.pipeline.generateReport(dash);
  }
}
