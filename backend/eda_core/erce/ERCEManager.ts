import { ERCEPipeline } from './pipeline/ERCEPipeline';
import { ReleaseReport } from './types/erceTypes';

export class ERCEManager {
  private static instance: ERCEManager;

  public readonly pipeline = new ERCEPipeline();

  private constructor() {}

  public static getInstance(): ERCEManager {
    if (!ERCEManager.instance) {
      ERCEManager.instance = new ERCEManager();
    }
    return ERCEManager.instance;
  }

  /**
   * Packages and certifies an engineering release bundle across all platform phases
   */
  public async createReleaseBundle(pipelineOutputs: Record<string, any>, context: Record<string, any>): Promise<ReleaseReport> {
    return this.pipeline.executeReleasePipeline(pipelineOutputs, context);
  }
}
