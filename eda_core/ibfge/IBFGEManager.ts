import { IBFGEPipeline } from './pipeline/IBFGEPipeline';
import { BSPGenerationReport } from './types/ibfgeTypes';

export class IBFGEManager {
  private static instance: IBFGEManager;

  public readonly pipeline = new IBFGEPipeline();

  private constructor() {}

  public static getInstance(): IBFGEManager {
    if (!IBFGEManager.instance) {
      IBFGEManager.instance = new IBFGEManager();
    }
    return IBFGEManager.instance;
  }

  /**
   * Generates production BSP & firmware artifacts from canonical context
   */
  public async generateBSP(context: Record<string, any>): Promise<BSPGenerationReport> {
    return this.pipeline.executePipeline(context);
  }
}
