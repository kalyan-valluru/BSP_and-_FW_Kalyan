import { ExperienceRepository } from '../repository/ExperienceRepository';
import { SimilarityEngine } from '../repository/SimilarityEngine';
import { StatisticsEngine } from '../repository/StatisticsEngine';
import { ExperienceRecord, ExperienceReport } from '../types/elerTypes';

export class ELERPipeline {
  public repository = new ExperienceRepository();
  public similarityEngine = new SimilarityEngine();
  public statisticsEngine = new StatisticsEngine();

  public recordSession(record: ExperienceRecord): void {
    this.repository.addRecord(record);
  }

  public generateReport(): ExperienceReport {
    const timestamp = new Date().toISOString();
    const records = this.repository.listRecords();
    const stats = this.statisticsEngine.computeStatistics(records);

    return {
      reportId: `ELER-REP-${Date.now()}`,
      timestamp,
      statistics: stats,
      recentSessions: records.slice(-10)
    };
  }
}
