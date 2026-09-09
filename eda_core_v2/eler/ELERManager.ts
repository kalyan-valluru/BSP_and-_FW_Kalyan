import { ELERPipeline } from './pipeline/ELERPipeline';
import { ExperienceRecord, ExperienceReport, SimilarityMatch } from './types/elerTypes';

export class ELERManager {
  private static instance: ELERManager;

  public readonly pipeline = new ELERPipeline();

  private constructor() {}

  public static getInstance(): ELERManager {
    if (!ELERManager.instance) {
      ELERManager.instance = new ELERManager();
    }
    return ELERManager.instance;
  }

  /**
   * Persists completed engineering session into Experience Repository
   */
  public recordExperience(record: ExperienceRecord): void {
    this.pipeline.recordSession(record);
  }

  /**
   * Searches for similar historical engineering experiences
   */
  public querySimilarExperiences(query: { vendor?: string; processor?: string; board?: string; toolchain?: string }): SimilarityMatch[] {
    const records = this.pipeline.repository.listRecords();
    return this.pipeline.similarityEngine.findSimilar(records, query);
  }

  /**
   * Synthesizes repository statistics and experience report
   */
  public generateReport(): ExperienceReport {
    return this.pipeline.generateReport();
  }
}
