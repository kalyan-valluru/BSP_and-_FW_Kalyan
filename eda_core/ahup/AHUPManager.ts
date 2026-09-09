import { AHUPPipeline } from './pipeline/AHUPPipeline';
import { HardwareUnderstandingReport } from './types/ahupTypes';

export class AHUPManager {
  private static instance: AHUPManager;

  public readonly pipeline = new AHUPPipeline();

  private constructor() {}

  public static getInstance(): AHUPManager {
    if (!AHUPManager.instance) {
      AHUPManager.instance = new AHUPManager();
    }
    return AHUPManager.instance;
  }

  /**
   * Processes uploaded hardware artifacts into a canonical HardwareUnderstandingReport
   */
  public async analyzeArtifact(filename: string, content: string | Buffer): Promise<HardwareUnderstandingReport> {
    return this.pipeline.executePipeline(filename, content);
  }
}
