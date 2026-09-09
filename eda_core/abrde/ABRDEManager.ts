import { ABRDEPipeline } from './pipeline/ABRDEPipeline';
import { DiagnosticReport } from './types/abrdeTypes';

export class ABRDEManager {
  private static instance: ABRDEManager;

  public readonly pipeline = new ABRDEPipeline();

  private constructor() {}

  public static getInstance(): ABRDEManager {
    if (!ABRDEManager.instance) {
      ABRDEManager.instance = new ABRDEManager();
    }
    return ABRDEManager.instance;
  }

  /**
   * Evaluates compilation and simulation failures to produce diagnostic reports and repair plans
   */
  public async analyzeDiagnostics(pipelineOutputs: { mtbeeResult?: any; seeResult?: any; eveReport?: any }, context: Record<string, any>): Promise<DiagnosticReport> {
    return this.pipeline.executePipeline(pipelineOutputs, context);
  }
}
