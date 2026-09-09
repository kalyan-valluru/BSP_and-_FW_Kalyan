import { MTBEEPipeline } from './pipeline/MTBEEPipeline';
import { BuildExecutionReport } from './types/mtbeeTypes';

export class MTBEEManager {
  private static instance: MTBEEManager;

  public readonly pipeline = new MTBEEPipeline();

  private constructor() {}

  public static getInstance(): MTBEEManager {
    if (!MTBEEManager.instance) {
      MTBEEManager.instance = new MTBEEManager();
    }
    return MTBEEManager.instance;
  }

  /**
   * Executes multi-toolchain build plans and returns normalized reports
   */
  public async executePlan(plan: any): Promise<BuildExecutionReport> {
    return this.pipeline.executeBuild(plan);
  }
}
