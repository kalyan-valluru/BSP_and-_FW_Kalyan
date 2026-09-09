import { AKEEPipeline } from './pipeline/AKEEPipeline';
import { KnowledgeObject, KnowledgeExpansionReport } from './types/akeeTypes';

export class AKEEManager {
  private static instance: AKEEManager;

  public readonly pipeline = new AKEEPipeline();

  private constructor() {}

  public static getInstance(): AKEEManager {
    if (!AKEEManager.instance) {
      AKEEManager.instance = new AKEEManager();
    }
    return AKEEManager.instance;
  }

  /**
   * Ingests vendor documentation artifact and enriches knowledge repository
   */
  public async ingestVendorDocument(filename: string, content: string): Promise<KnowledgeObject> {
    return this.pipeline.ingestDocument(filename, content);
  }

  /**
   * Synthesizes knowledge statistics and expansion report
   */
  public generateReport(): KnowledgeExpansionReport {
    return this.pipeline.generateReport();
  }
}
