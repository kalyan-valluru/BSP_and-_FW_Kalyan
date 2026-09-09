import { IBSPSEPipeline } from './pipeline/IBSPSEPipeline';
import { BuildProjectReport } from './types/ibspseTypes';

export class IBSPSEManager {
  private static instance: IBSPSEManager;

  public readonly pipeline = new IBSPSEPipeline();

  private constructor() {}

  public static getInstance(): IBSPSEManager {
    if (!IBSPSEManager.instance) {
      IBSPSEManager.instance = new IBSPSEManager();
    }
    return IBSPSEManager.instance;
  }

  /**
   * Assembles a complete production-ready embedded software project tree
   */
  public async assembleProject(context: Record<string, any>, upstreamArtifacts: any[]): Promise<BuildProjectReport> {
    return this.pipeline.executePipeline(context, upstreamArtifacts);
  }
}
