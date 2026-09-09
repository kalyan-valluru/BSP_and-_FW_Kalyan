import { PAFPipeline } from './pipeline/PAFPipeline';
import { CanonicalProcessorModel, EvidenceItem, ProcessorAdaptationReport } from './types/pafTypes';

export class PAFManager {
  private static instance: PAFManager;

  public readonly pipeline = new PAFPipeline();

  private constructor() {}

  public static getInstance(): PAFManager {
    if (!PAFManager.instance) {
      PAFManager.instance = new PAFManager();
    }
    return PAFManager.instance;
  }

  /**
   * Adapts unknown or partially known processors into Canonical Processor Models
   */
  public async adaptProcessor(input: { filename?: string; content?: string; evidence?: EvidenceItem[] }): Promise<CanonicalProcessorModel> {
    return this.pipeline.adaptProcessor(input);
  }

  /**
   * Synthesizes processor statistics and adaptation report
   */
  public generateReport(model: CanonicalProcessorModel): ProcessorAdaptationReport {
    return this.pipeline.generateReport(model);
  }
}
