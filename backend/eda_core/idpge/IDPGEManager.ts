import { IDPGEPipeline } from './pipeline/IDPGEPipeline';
import { DriverGenerationReport } from './types/idpgeTypes';

export class IDPGEManager {
  private static instance: IDPGEManager;

  public readonly pipeline = new IDPGEPipeline();

  private constructor() {}

  public static getInstance(): IDPGEManager {
    if (!IDPGEManager.instance) {
      IDPGEManager.instance = new IDPGEManager();
    }
    return IDPGEManager.instance;
  }

  /**
   * Generates peripheral driver sources and manifests
   */
  public async generateDrivers(context: Record<string, any>): Promise<DriverGenerationReport> {
    return this.pipeline.executePipeline(context);
  }
}
