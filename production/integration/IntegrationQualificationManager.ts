import { QualificationPipeline } from './pipeline/QualificationPipeline';
import { IntegrationQualificationReport } from './types/integrationTypes';

export class IntegrationQualificationManager {
  private static instance: IntegrationQualificationManager;

  public readonly pipeline = new QualificationPipeline();

  private constructor() {}

  public static getInstance(): IntegrationQualificationManager {
    if (!IntegrationQualificationManager.instance) {
      IntegrationQualificationManager.instance = new IntegrationQualificationManager();
    }
    return IntegrationQualificationManager.instance;
  }

  /**
   * Qualifies the complete 15-stage engineering workflow from document ingestion to release certification
   */
  public async qualifyIntegration(projectPayload: Record<string, any>): Promise<IntegrationQualificationReport> {
    return this.pipeline.qualifyIntegration(projectPayload);
  }
}
